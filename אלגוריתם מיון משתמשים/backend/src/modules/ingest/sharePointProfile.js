const { safeProfileImageUrl } = require('./profileImage');
const { normalizeSourceSystem } = require('./sourceSystem');
const SHAREPOINT_MARKER_FIELDS = [
    'UserProfile_GUID',
    'SPS-UserPrincipalName',
    'SPS-Department',
    'SPS-DataSource',
    'SPS-MemberOf',
    'PictureURL',
    'PreferredName',
    'AccountName',
];
const PERSONAL_NUMBER_FIELDS = [
    'personalNumber',
    'PersonalNumber',
    'UserName',
    'AccountName',
    'SPS-UserPrincipalName',
    'SPS-ClaimID',
    'SPS-ResourceAccountName',
    'SPS-MasterAccountName',
    'WorkEmail',
    'SPS-SipAddress',
];
const ORG_PATH_FIELDS = [
    'rawOrgPath',
    'Department',
    'SPS-Department',
    'Office',
    'SPS-Location',
    'SPS-MemberOf',
];
const TITLE_FIELDS = ['Title', 'SPS-JobTitle', 'role', 'Role'];
const RANK_FIELDS = ['Rank', 'rank', 'SPS-Rank'];
const SOURCE_SYSTEM_FIELDS = ['sourceSystem', 'sourceSystemName', 'systemName', 'integrationName', 'SPS-DataSource', 'SPS-ClaimProviderID'];
const RANKS = [
    'רא"ל',
    'ראל',
    'אלוף',
    'תא"ל',
    'תאל',
    'אל"ם',
    'אלמ',
    'סא"ל',
    'סאל',
    'רס"ן',
    'רסן',
    'סרן',
    'סגן',
    'סג"ם',
    'סגמ',
    'רנ"ג',
    'רנג',
    'רנ"מ',
    'רנמ',
    'רס"ב',
    'רסב',
    'רס"ם',
    'רסם',
    'רס"ר',
    'רסר',
    'רס"ל',
    'רסל',
    'סמ"ר',
    'סמר',
    'סמל',
    'רב"ט',
    'רבט',
    'טר"ש',
    'טרש',
    'טוראי',
];
function text(value) {
    if (typeof value === 'string') {
        const cleaned = value.trim().replace(/\s+/g, ' ');
        return cleaned || undefined;
    }
    if (typeof value === 'number' || typeof value === 'boolean')
        return String(value);
    return undefined;
}
function field(profile, names) {
    for (const name of names) {
        const value = text(profile[name]);
        if (value)
            return value;
    }
    return undefined;
}
function compactIdentifier(value) {
    return value.replace(/[\s._-]/g, '').toLowerCase();
}
function extractPersonalNumberFromValue(value) {
    const matches = [...value.matchAll(/(?:^|[^a-zA-Z0-9])([a-zA-Z]\d{6,10}|[a-zA-Z]{2,10}-\d{3,10}|\d{6,10})(?=$|[^a-zA-Z0-9])/g)];
    if (!matches.length)
        return undefined;
    return matches[matches.length - 1]?.[1]?.trim();
}
function extractPersonalNumber(profile) {
    for (const name of PERSONAL_NUMBER_FIELDS) {
        const value = text(profile[name]);
        if (!value)
            continue;
        const direct = extractPersonalNumberFromValue(value);
        if (direct)
            return direct;
        const lastPart = value.split(/[\\/@|#;,\s]+/).filter(Boolean).at(-1);
        if (lastPart && /^(?:[a-zA-Z]\d{6,10}|[a-zA-Z]{2,10}-\d{3,10}|\d{6,10})$/.test(lastPart)) {
            return lastPart;
        }
    }
    return undefined;
}
function splitPreferredName(value) {
    if (!value)
        return {};
    const cleaned = value.replace(/\([^)]*\)/g, '').trim().replace(/\s+/g, ' ');
    if (!cleaned)
        return {};
    const parts = cleaned.split(' ').filter(Boolean);
    if (parts.length === 1)
        return { firstName: parts[0] };
    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
    };
}
function extractName(profile, personalNumber) {
    const preferredName = field(profile, ['PreferredName', 'SPS-PhoneticDisplayName']);
    const preferred = splitPreferredName(preferredName);
    const firstName = field(profile, ['FirstName', 'SPS-PhoneticFirstName']) ?? preferred.firstName;
    const lastName = field(profile, ['LastName', 'SPS-PhoneticLastName']) ?? preferred.lastName;
    if (firstName || lastName)
        return { firstName, lastName, preferredName };
    const account = field(profile, ['UserName', 'AccountName', 'SPS-UserPrincipalName', 'WorkEmail']);
    const local = account?.split('@')[0]?.split('\\').at(-1);
    if (local && personalNumber && compactIdentifier(local) !== compactIdentifier(personalNumber)) {
        return { firstName: local, lastName: undefined, preferredName };
    }
    return { preferredName };
}
function cleanPathCandidate(value) {
    if (!value)
        return undefined;
    const cleaned = value
        .replace(/\s*[;|]\s*/g, ' / ')
        .replace(/\s*[\\>]\s*/g, ' / ')
        .replace(/\s+\/\s+/g, ' / ')
        .trim();
    return cleaned || undefined;
}
function extractOrgPath(profile) {
    for (const name of ORG_PATH_FIELDS) {
        const value = cleanPathCandidate(text(profile[name]));
        if (value)
            return value;
    }
    return undefined;
}
function splitRankAndRole(profile) {
    const rank = field(profile, RANK_FIELDS);
    const title = field(profile, TITLE_FIELDS);
    if (!title)
        return { rank };
    const normalizedTitle = title.replace(/\s+/g, ' ').trim();
    for (const candidate of RANKS) {
        const pattern = new RegExp(`^${candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+|$)`);
        if (pattern.test(normalizedTitle)) {
            return {
                rank: rank ?? candidate,
                role: normalizedTitle.replace(pattern, '').trim() || undefined,
            };
        }
    }
    return { rank, role: normalizedTitle };
}
function pickPhone(profile) {
    return field(profile, ['CellPhone', 'WorkPhone', 'HomePhone', 'Fax']);
}
function pickEmail(profile) {
    const email = field(profile, ['WorkEmail', 'SPS-SipAddress', 'SPS-UserPrincipalName', 'UserName']);
    return email?.includes('@') ? email : undefined;
}
function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
function sharePointProfileFromPayload(payload) {
    if (!isPlainObject(payload))
        return undefined;
    const wrapped = (payload.sharePointProfile ?? payload.sharepointProfile ?? payload.userProfile ?? payload.profile);
    if (isPlainObject(wrapped) && looksLikeSharePointProfile(wrapped))
        return wrapped;
    return looksLikeSharePointProfile(payload) ? payload : undefined;
}
function looksLikeSharePointProfile(payload) {
    return SHAREPOINT_MARKER_FIELDS.some((name) => Object.prototype.hasOwnProperty.call(payload, name));
}
function mapSharePointProfileToIngest(profile, fallback) {
    const personalNumber = extractPersonalNumber(profile);
    const { firstName, lastName, preferredName } = extractName(profile, personalNumber);
    const rawOrgPath = extractOrgPath(profile);
    const { rank, role } = splitRankAndRole(profile);
    const sourceSystem = normalizeSourceSystem(fallback?.sourceSystem) ??
        normalizeSourceSystem(field(profile, SOURCE_SYSTEM_FIELDS)) ??
        'SharePoint User Profile';
    const attributes = {
        ...(isPlainObject(profile.attributes) ? profile.attributes : {}),
        sharePointProfile: profile,
    };
    for (const [key, value] of Object.entries(profile)) {
        const valueText = text(value);
        if (valueText)
            attributes[`sharePoint.${key}`] = valueText;
    }
    const manager = field(profile, ['Manager']);
    const managerPersonalNumber = manager ? extractPersonalNumberFromValue(manager) : undefined;
    if (managerPersonalNumber)
        attributes.managerPersonalNumber = managerPersonalNumber;
    if (preferredName)
        attributes.preferredName = preferredName;
    const mapped = {
        personalNumber,
        firstName,
        lastName,
        rawOrgPath,
        source: fallback?.source ?? 'sharepoint-profile',
        rank,
        role,
        email: pickEmail(profile),
        phone: pickPhone(profile),
        profileImageUrl: safeProfileImageUrl(field(profile, ['PictureURL'])),
        sourceSystem,
        accessRole: fallback?.accessRole,
        attributes,
    };
    const missing = [
        !mapped.personalNumber ? 'personalNumber' : '',
        !mapped.firstName ? 'firstName' : '',
        !mapped.lastName ? 'lastName' : '',
        !mapped.rawOrgPath ? 'rawOrgPath' : '',
    ].filter(Boolean);
    return { ...mapped, missing };
}

module.exports = { sharePointProfileFromPayload, looksLikeSharePointProfile, mapSharePointProfileToIngest };
