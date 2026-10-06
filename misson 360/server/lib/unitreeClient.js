const DEFAULT_BASE_URL = 'http://localhost:3002/api/v1';
const { safeProfileImageUrl } = require('./safeProfileImage');

function cleanBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function unitreeConfig() {
  return {
    baseUrl: cleanBaseUrl(process.env.UNITREE_API_BASE_URL),
    apiKey: (process.env.UNITREE_API_KEY || '').trim(),
    sourceSystem: (process.env.UNITREE_SOURCE_SYSTEM || 'Mission360').trim(),
    enabled: process.env.UNITREE_API_ENABLED !== 'false',
  };
}

function configured() {
  const cfg = unitreeConfig();
  return cfg.enabled && Boolean(cfg.apiKey);
}

function headers(extra = {}) {
  const cfg = unitreeConfig();
  return {
    'Content-Type': 'application/json',
    'X-API-Key': cfg.apiKey,
    'X-Source-System': cfg.sourceSystem,
    ...extra,
  };
}

async function request(path, options = {}) {
  const cfg = unitreeConfig();
  if (!configured()) {
    const err = new Error('Unitree API is not configured');
    err.code = 'UNITREE_NOT_CONFIGURED';
    throw err;
  }

  const res = await fetch(`${cfg.baseUrl}${path}`, {
    ...options,
    headers: headers(options.headers),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(body?.error || body?.message || `Unitree request failed (${res.status})`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function status() {
  const cfg = unitreeConfig();
  if (!configured()) {
    return {
      enabled: cfg.enabled,
      configured: false,
      baseUrl: cfg.baseUrl,
      sourceSystem: cfg.sourceSystem,
      missing: [!cfg.apiKey ? 'UNITREE_API_KEY' : ''].filter(Boolean),
    };
  }

  const root = await request('/');
  return {
    enabled: cfg.enabled,
    configured: true,
    baseUrl: cfg.baseUrl,
    sourceSystem: cfg.sourceSystem,
    unitree: root?.data || root,
    missing: [],
  };
}

async function getUserByPersonalNumber(personalNumber) {
  const pn = String(personalNumber || '').trim();
  if (!pn) return null;
  try {
    const body = await request(`/users/${encodeURIComponent(pn)}?history=false&decisions=false`);
    return body?.data || null;
  } catch (err) {
    if (err.status !== 404) throw err;
  }

  const search = await request(`/users?q=${encodeURIComponent(pn)}&limit=5`);
  const rows = Array.isArray(search?.data) ? search.data : [];
  return rows.find(u => String(u.personalNumber).toLowerCase() === pn.toLowerCase()) || rows[0] || null;
}

async function lookupDirectoryUser(personalNumber) {
  const body = await request(`/directory/users/${encodeURIComponent(personalNumber)}`);
  return body?.data || null;
}

async function ingestDirectoryUser(personalNumber, overrides = {}) {
  const cfg = unitreeConfig();
  const body = await request(`/directory/users/${encodeURIComponent(personalNumber)}/ingest`, {
    method: 'POST',
    body: JSON.stringify({
      source: 'mission360-directory-ingest',
      sourceSystem: cfg.sourceSystem,
      ...overrides,
    }),
  });
  return body?.data || null;
}

async function ingestSharePointProfile(sharePointProfile, overrides = {}) {
  const cfg = unitreeConfig();
  const body = await request('/users', {
    method: 'POST',
    body: JSON.stringify({
      sharePointProfile,
      source: 'mission360-microsoft-current-user',
      sourceSystem: cfg.sourceSystem,
      ...overrides,
    }),
  });
  const data = body?.data || null;
  const ingestedUser = data?.user;
  if (!ingestedUser?.personalNumber) return null;

  const refreshed = await getUserByPersonalNumber(ingestedUser.personalNumber).catch(() => null);
  return {
    source: 'unitree-sharepoint-profile',
    user: refreshed || {
      ...ingestedUser,
      orgPathText: ingestedUser.orgPathText || data?.ingest?.pathText || '',
    },
    ingest: data,
  };
}

async function lookupOrIngestPersonalNumber(personalNumber) {
  const existing = await getUserByPersonalNumber(personalNumber);
  if (existing) return { source: 'unitree-user', user: existing };

  const directory = await ingestDirectoryUser(personalNumber).catch(async (err) => {
    if (err.status === 404 || err.status === 422 || err.status === 503) return null;
    throw err;
  });
  const ingestedUser = directory?.ingest?.user;
  if (ingestedUser?.personalNumber) {
    const refreshed = await getUserByPersonalNumber(ingestedUser.personalNumber).catch(() => null);
    return { source: 'unitree-directory-ingest', user: refreshed || ingestedUser, directory };
  }

  const lookup = await lookupDirectoryUser(personalNumber).catch((err) => {
    if (err.status === 404 || err.status === 503) return null;
    throw err;
  });
  if (lookup?.mapped?.personalNumber) {
    return { source: 'unitree-directory-lookup', user: unitreeUserFromDirectoryLookup(lookup), directory: lookup };
  }

  return null;
}

function unitreeUserFromDirectoryLookup(lookup) {
  const mapped = lookup.mapped || {};
  return {
    personalNumber: mapped.personalNumber,
    fullName: [mapped.firstName, mapped.lastName].filter(Boolean).join(' ') || mapped.personalNumber,
    firstName: mapped.firstName || '',
    lastName: mapped.lastName || '',
    rank: mapped.rank || '',
    role: mapped.role || '',
    email: mapped.email || '',
    phone: mapped.phone || '',
    profileImageUrl: safeProfileImageUrl(mapped.profileImageUrl),
    sourceSystem: mapped.sourceSystem || lookup.sourceSystem,
    registeredVia: mapped.sourceSystem || lookup.sourceSystem,
    orgPathText: mapped.rawOrgPath || '',
    orgPath: [],
    attributes: {
      sharePointProfile: lookup.sharePointProfile || null,
    },
  };
}

function levelsFromUnitreeUser(unitreeUser) {
  const orgPath = Array.isArray(unitreeUser?.orgPath) ? unitreeUser.orgPath : [];
  const names = orgPath.length
    ? orgPath.map(part => part?.name).filter(Boolean)
    : String(unitreeUser?.orgPathText || unitreeUser?.currentOrgPathText || unitreeUser?.unitreeOrgPathText || '')
      .split(/[/>|]+/)
      .map(part => part.trim())
      .filter(Boolean);

  return names.slice(0, 5).reduce((acc, name, index) => {
    acc[`level${index + 1}`] = name;
    return acc;
  }, { level1: '', level2: '', level3: '', level4: '', level5: '' });
}

function userPayloadFromUnitree(unitreeUser, fallbackTagId = '') {
  const attributes = unitreeUser?.attributes && typeof unitreeUser.attributes === 'object' ? unitreeUser.attributes : {};
  const sharePointProfile = attributes.sharePointProfile && typeof attributes.sharePointProfile === 'object'
    ? attributes.sharePointProfile
    : {};
  const tagId = String(unitreeUser?.personalNumber || fallbackTagId || '').trim();
  const levels = levelsFromUnitreeUser(unitreeUser);
  const fullName = unitreeUser?.fullName
    || [unitreeUser?.firstName, unitreeUser?.lastName].filter(Boolean).join(' ')
    || sharePointProfile.PreferredName
    || tagId;
  const rank = unitreeUser?.rank || sharePointProfile.Rank || sharePointProfile['SPS-Rank'] || '';
  const militaryRole = unitreeUser?.role || sharePointProfile.Title || sharePointProfile['SPS-JobTitle'] || '';
  const jobTitle = [rank, militaryRole].filter(Boolean).join(' ') || militaryRole || '';
  const sourceSystem = unitreeUser?.sourceSystem || unitreeUser?.registeredSourceSystem || unitreeUser?.registeredVia || 'Unitree';
  const registeredVia = unitreeUser?.registeredVia || unitreeUser?.registeredSourceSystem || sourceSystem;
  const sourceSystems = Array.isArray(unitreeUser?.sourceSystems)
    ? unitreeUser.sourceSystems.filter(Boolean)
    : [sourceSystem].filter(Boolean);

  return {
    tagId,
    name: fullName,
    username: unitreeUser?.email || sharePointProfile.WorkEmail || sharePointProfile.UserName || tagId,
    jobTitle,
    rank,
    militaryRole,
    email: unitreeUser?.email || sharePointProfile.WorkEmail || '',
    phone: unitreeUser?.phone || sharePointProfile.CellPhone || sharePointProfile.WorkPhone || '',
    profileImageUrl: safeProfileImageUrl(unitreeUser?.profileImageUrl || sharePointProfile.PictureURL),
    sourceSystem,
    registeredVia,
    sourceSystems,
    managerTagId: attributes.managerPersonalNumber || '',
    unitreeOrgPathText: unitreeUser?.orgPathText || unitreeUser?.currentOrgPathText || '',
    unitreeOrgPathIds: Array.isArray(unitreeUser?.orgPath)
      ? unitreeUser.orgPath.map(part => String(part.id || '')).filter(Boolean)
      : [],
    knownNames: Array.isArray(unitreeUser?.knownNames) ? unitreeUser.knownNames.filter(Boolean) : [],
    rawOrgPaths: Array.isArray(unitreeUser?.rawPaths) ? unitreeUser.rawPaths.filter(Boolean) : [],
    ...levels,
    meta: {
      ...attributes,
      unitreeUser,
    },
  };
}

module.exports = {
  unitreeConfig,
  status,
  configured,
  getUserByPersonalNumber,
  lookupDirectoryUser,
  ingestDirectoryUser,
  ingestSharePointProfile,
  lookupOrIngestPersonalNumber,
  userPayloadFromUnitree,
  levelsFromUnitreeUser,
};
