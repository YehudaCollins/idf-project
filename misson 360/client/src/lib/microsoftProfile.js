const SHAREPOINT_SITE_URL = String(import.meta.env.VITE_SHAREPOINT_SITE_URL || '').replace(/\/+$/, '');

function sharePointUrl(path) {
  return SHAREPOINT_SITE_URL ? `${SHAREPOINT_SITE_URL}${path}` : path;
}

function withTimeout(ms = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    done: () => clearTimeout(timer),
  };
}

async function fetchSharePointJson(url, timeoutMs) {
  const timeout = withTimeout(timeoutMs);
  try {
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        Accept: 'application/json;odata=verbose',
      },
      signal: timeout.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } finally {
    timeout.done();
  }
}

function propertyBag(rows) {
  const list = Array.isArray(rows?.results) ? rows.results : (Array.isArray(rows) ? rows : []);
  return list.reduce((acc, item) => {
    const key = item?.Key || item?.key;
    if (!key) return acc;
    acc[key] = item?.Value ?? item?.value ?? '';
    return acc;
  }, {});
}

function compactIdentifier(value) {
  return String(value || '').replace(/[\s._-]/g, '').toLowerCase();
}

function personalNumberFromText(value) {
  const text = String(value || '');
  const matches = [...text.matchAll(/(?:^|[^a-zA-Z0-9])([a-zA-Z]\d{6,10}|[a-zA-Z]{2,10}-\d{3,10}|\d{6,10})(?=$|[^a-zA-Z0-9])/g)];
  return matches.at(-1)?.[1] || '';
}

function splitName(displayName) {
  const parts = String(displayName || '').replace(/\([^)]*\)/g, '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
}

function buildProfileFromMyProperties(payload) {
  const root = payload?.d || payload;
  if (!root) return null;

  const props = propertyBag(root.UserProfileProperties);
  const preferredName = root.DisplayName || props.PreferredName || props['SPS-PhoneticDisplayName'] || '';
  const nameParts = splitName(preferredName);
  const accountName = root.AccountName || props.AccountName || props.UserName || '';
  const email = root.Email || props.WorkEmail || props['SPS-UserPrincipalName'] || props.UserName || '';
  const personalNumber = personalNumberFromText([
    props.personalNumber,
    props.PersonalNumber,
    props.UserName,
    accountName,
    email,
    props['SPS-ClaimID'],
    props['SPS-ResourceAccountName'],
    props['SPS-MasterAccountName'],
  ].filter(Boolean).join(' '));

  return {
    ...props,
    personalNumber: props.personalNumber || personalNumber,
    UserProfile_GUID: props.UserProfile_GUID || '',
    AccountName: accountName,
    FirstName: props.FirstName || props['SPS-PhoneticFirstName'] || nameParts.firstName,
    LastName: props.LastName || props['SPS-PhoneticLastName'] || nameParts.lastName,
    PreferredName: preferredName,
    WorkPhone: props.WorkPhone || '',
    Department: props.Department || props['SPS-Department'] || props.Office || props['SPS-Location'] || '',
    Title: props.Title || props['SPS-JobTitle'] || '',
    'SPS-Department': props['SPS-Department'] || props.Department || '',
    Manager: props.Manager || '',
    PictureURL: root.PictureUrl || props.PictureURL || '',
    UserName: props.UserName || email || accountName,
    WorkEmail: email.includes('@') ? email : '',
    CellPhone: props.CellPhone || '',
    Office: props.Office || '',
    'SPS-JobTitle': props['SPS-JobTitle'] || props.Title || '',
    'SPS-DataSource': props['SPS-DataSource'] || 'Microsoft SharePoint',
    'SPS-UserPrincipalName': props['SPS-UserPrincipalName'] || (email.includes('@') ? email : ''),
  };
}

function buildProfileFromCurrentUser(payload) {
  const root = payload?.d || payload;
  if (!root) return null;
  const preferredName = root.Title || '';
  const nameParts = splitName(preferredName);
  const accountName = root.LoginName || root.UserName || '';
  const email = root.Email || '';
  const personalNumber = personalNumberFromText([accountName, email].join(' '));

  return {
    personalNumber,
    AccountName: accountName,
    UserName: email || accountName,
    FirstName: nameParts.firstName,
    LastName: nameParts.lastName,
    PreferredName: preferredName,
    WorkEmail: email,
    'SPS-UserPrincipalName': email,
    'SPS-DataSource': 'Microsoft SharePoint currentUser',
  };
}

export async function getMicrosoftCurrentUserProfile({ timeoutMs = 3000 } = {}) {
  const myProperties = await fetchSharePointJson(sharePointUrl('/_api/SP.UserProfiles.PeopleManager/GetMyProperties'), timeoutMs)
    .catch(() => null);
  const profile = buildProfileFromMyProperties(myProperties);
  if (profile?.personalNumber || profile?.AccountName || profile?.WorkEmail) return profile;

  const currentUser = await fetchSharePointJson(sharePointUrl('/_api/web/currentUser?$select=LoginName,Title,Email,Id'), timeoutMs)
    .catch(() => null);
  const fallback = buildProfileFromCurrentUser(currentUser);
  if (fallback?.personalNumber || fallback?.AccountName || fallback?.WorkEmail) return fallback;

  return null;
}

export function sameMicrosoftIdentity(a, b) {
  const left = compactIdentifier(a?.personalNumber || a?.AccountName || a?.WorkEmail || a?.UserName);
  const right = compactIdentifier(b?.personalNumber || b?.AccountName || b?.WorkEmail || b?.UserName);
  return Boolean(left && right && left === right);
}
