const SHAREPOINT_SITE_URL = String(import.meta.env.VITE_SHAREPOINT_SITE_URL || '').replace(/\/+$/, '');

function sharePointUrl(path: string) {
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

async function fetchSharePointJson(url: string, timeoutMs: number) {
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

function propertyBag(rows: unknown): Record<string, string> {
  const root = rows as { results?: Array<{ Key?: string; key?: string; Value?: unknown; value?: unknown }> } | unknown[];
  const list = Array.isArray((root as { results?: unknown[] })?.results)
    ? ((root as { results: Array<{ Key?: string; key?: string; Value?: unknown; value?: unknown }> }).results)
    : Array.isArray(root)
      ? (root as Array<{ Key?: string; key?: string; Value?: unknown; value?: unknown }>)
      : [];

  return list.reduce<Record<string, string>>((acc, item) => {
    const key = item?.Key || item?.key;
    if (!key) return acc;
    const value = item?.Value ?? item?.value ?? '';
    acc[key] = value == null ? '' : String(value);
    return acc;
  }, {});
}

function personalNumberFromText(value: string) {
  const text = String(value || '');
  const matches = [...text.matchAll(/(?:^|[^a-zA-Z0-9])([a-zA-Z]\d{6,10}|[a-zA-Z]{2,10}-\d{3,10}|\d{6,10})(?=$|[^a-zA-Z0-9])/g)];
  return matches.at(-1)?.[1] || '';
}

function splitName(displayName: string) {
  const parts = String(displayName || '')
    .replace(/\([^)]*\)/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
}

function buildProfileFromMyProperties(payload: unknown): Record<string, unknown> | null {
  const root = (payload as { d?: Record<string, unknown> })?.d || (payload as Record<string, unknown>);
  if (!root || typeof root !== 'object') return null;

  const props = propertyBag(root.UserProfileProperties);
  const preferredName = String(root.DisplayName || props.PreferredName || props['SPS-PhoneticDisplayName'] || '');
  const nameParts = splitName(preferredName);
  const accountName = String(root.AccountName || props.AccountName || props.UserName || '');
  const email = String(root.Email || props.WorkEmail || props['SPS-UserPrincipalName'] || props.UserName || '');
  const personalNumber = personalNumberFromText(
    [
      props.personalNumber,
      props.PersonalNumber,
      props.UserName,
      accountName,
      email,
      props['SPS-ClaimID'],
      props['SPS-ResourceAccountName'],
      props['SPS-MasterAccountName'],
    ]
      .filter(Boolean)
      .join(' ')
  );

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
    PictureURL: String(root.PictureUrl || props.PictureURL || ''),
    UserName: props.UserName || email || accountName,
    WorkEmail: email.includes('@') ? email : '',
    CellPhone: props.CellPhone || '',
    Office: props.Office || '',
    'SPS-JobTitle': props['SPS-JobTitle'] || props.Title || '',
    'SPS-DataSource': props['SPS-DataSource'] || 'Microsoft SharePoint',
    'SPS-UserPrincipalName': props['SPS-UserPrincipalName'] || (email.includes('@') ? email : ''),
  };
}

function buildProfileFromCurrentUser(payload: unknown): Record<string, unknown> | null {
  const root = (payload as { d?: Record<string, unknown> })?.d || (payload as Record<string, unknown>);
  if (!root || typeof root !== 'object') return null;

  const preferredName = String(root.Title || '');
  const nameParts = splitName(preferredName);
  const accountName = String(root.LoginName || root.UserName || '');
  const email = String(root.Email || '');
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

/** קורא את פרופיל המשתמש המחובר מ-SharePoint (GetMyProperties → currentUser) */
export async function getMicrosoftCurrentUserProfile({ timeoutMs = 3000 } = {}): Promise<Record<string, unknown> | null> {
  const myProperties = await fetchSharePointJson(
    sharePointUrl('/_api/SP.UserProfiles.PeopleManager/GetMyProperties'),
    timeoutMs
  ).catch(() => null);
  const profile = buildProfileFromMyProperties(myProperties);
  if (profile?.personalNumber || profile?.AccountName || profile?.WorkEmail) return profile;

  const currentUser = await fetchSharePointJson(
    sharePointUrl('/_api/web/currentUser?$select=LoginName,Title,Email,Id'),
    timeoutMs
  ).catch(() => null);
  const fallback = buildProfileFromCurrentUser(currentUser);
  if (fallback?.personalNumber || fallback?.AccountName || fallback?.WorkEmail) return fallback;

  return null;
}
