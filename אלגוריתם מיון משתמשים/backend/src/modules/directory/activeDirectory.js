const { mapSharePointProfileToIngest } = require('../ingest/sharePointProfile');
const { safeProfileImageUrl } = require('../ingest/profileImage');
const ActiveDirectoryPromise = require('activedirectory2').promiseWrapper;
const DEFAULT_USER_ATTRIBUTES = [
    'dn',
    'distinguishedName',
    'objectGUID',
    'objectSid',
    'userPrincipalName',
    'sAMAccountName',
    'mail',
    'employeeID',
    'employeeNumber',
    'givenName',
    'sn',
    'cn',
    'displayName',
    'title',
    'department',
    'manager',
    'telephoneNumber',
    'mobile',
    'physicalDeliveryOfficeName',
    'company',
    'memberOf',
    'thumbnailPhoto',
    'jpegPhoto',
];
const DEFAULT_PERSONAL_NUMBER_ATTRIBUTES = [
    'sAMAccountName',
    'employeeID',
    'employeeNumber',
    'userPrincipalName',
    'mail',
    'cn',
    'displayName',
];
let cachedClient = null;
let cachedKey = '';
function envText(name) {
    const value = process.env[name]?.trim();
    return value || undefined;
}
function envNumber(name, fallback) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}
function envList(name, fallback) {
    const raw = envText(name);
    if (!raw)
        return fallback;
    const values = raw.split(',').map((value) => value.trim()).filter(Boolean);
    return values.length ? values : fallback;
}
function safeAttributeNames(values) {
    return values.filter((value) => /^[a-zA-Z][a-zA-Z0-9;-]*$/.test(value));
}
function getConfig() {
    const enabled = process.env.ACTIVE_DIRECTORY_ENABLED !== 'false';
    const personalNumberAttributes = safeAttributeNames(envList('ACTIVE_DIRECTORY_PERSONAL_NUMBER_ATTRIBUTES', DEFAULT_PERSONAL_NUMBER_ATTRIBUTES));
    const userAttributes = safeAttributeNames([
        ...envList('ACTIVE_DIRECTORY_USER_ATTRIBUTES', DEFAULT_USER_ATTRIBUTES),
        ...personalNumberAttributes,
        envText('ACTIVE_DIRECTORY_ORG_PATH_ATTRIBUTE') ?? 'department',
        envText('ACTIVE_DIRECTORY_TITLE_ATTRIBUTE') ?? 'title',
    ]);
    return {
        enabled,
        url: envText('ACTIVE_DIRECTORY_URL'),
        baseDN: envText('ACTIVE_DIRECTORY_BASE_DN'),
        username: envText('ACTIVE_DIRECTORY_USERNAME'),
        password: envText('ACTIVE_DIRECTORY_PASSWORD'),
        sourceSystem: envText('ACTIVE_DIRECTORY_SOURCE_SYSTEM') ?? 'ActiveDirectory',
        orgPathAttribute: envText('ACTIVE_DIRECTORY_ORG_PATH_ATTRIBUTE') ?? 'department',
        titleAttribute: envText('ACTIVE_DIRECTORY_TITLE_ATTRIBUTE') ?? 'title',
        firstNameAttribute: envText('ACTIVE_DIRECTORY_FIRST_NAME_ATTRIBUTE') ?? 'givenName',
        lastNameAttribute: envText('ACTIVE_DIRECTORY_LAST_NAME_ATTRIBUTE') ?? 'sn',
        displayNameAttribute: envText('ACTIVE_DIRECTORY_DISPLAY_NAME_ATTRIBUTE') ?? 'displayName',
        emailAttribute: envText('ACTIVE_DIRECTORY_EMAIL_ATTRIBUTE') ?? 'mail',
        phoneAttribute: envText('ACTIVE_DIRECTORY_PHONE_ATTRIBUTE') ?? 'telephoneNumber',
        mobileAttribute: envText('ACTIVE_DIRECTORY_MOBILE_ATTRIBUTE') ?? 'mobile',
        managerAttribute: envText('ACTIVE_DIRECTORY_MANAGER_ATTRIBUTE') ?? 'manager',
        photoAttribute: envText('ACTIVE_DIRECTORY_PHOTO_ATTRIBUTE') ?? 'thumbnailPhoto',
        personalNumberAttributes,
        userAttributes,
        timeout: envNumber('ACTIVE_DIRECTORY_TIMEOUT_MS', 8000),
        connectTimeout: envNumber('ACTIVE_DIRECTORY_CONNECT_TIMEOUT_MS', 8000),
        pageSize: envNumber('ACTIVE_DIRECTORY_PAGE_SIZE', 1000),
    };
}
function missingConfig(config = getConfig()) {
    return [
        !config.url ? 'ACTIVE_DIRECTORY_URL' : '',
        !config.baseDN ? 'ACTIVE_DIRECTORY_BASE_DN' : '',
        !config.username ? 'ACTIVE_DIRECTORY_USERNAME' : '',
        !config.password ? 'ACTIVE_DIRECTORY_PASSWORD' : '',
    ].filter(Boolean);
}
function activeDirectoryStatus() {
    const config = getConfig();
    const missing = missingConfig(config);
    return {
        enabled: config.enabled,
        configured: config.enabled && missing.length === 0,
        sourceSystem: config.sourceSystem,
        url: config.url,
        baseDN: config.baseDN,
        personalNumberAttributes: config.personalNumberAttributes,
        userAttributes: config.userAttributes,
        missing,
    };
}
function getClient(config = getConfig()) {
    const missing = missingConfig(config);
    if (!config.enabled)
        throw new Error('Active Directory integration disabled');
    if (missing.length)
        throw new Error(`Active Directory config missing: ${missing.join(', ')}`);
    const key = JSON.stringify({
        url: config.url,
        baseDN: config.baseDN,
        username: config.username,
        sourceSystem: config.sourceSystem,
        userAttributes: config.userAttributes,
        timeout: config.timeout,
        connectTimeout: config.connectTimeout,
        pageSize: config.pageSize,
    });
    if (cachedClient && cachedKey === key)
        return cachedClient;
    cachedClient = new ActiveDirectoryPromise({
        url: config.url,
        baseDN: config.baseDN,
        username: config.username,
        password: config.password,
        timeout: config.timeout,
        connectTimeout: config.connectTimeout,
        pageSize: config.pageSize,
        attributes: {
            user: config.userAttributes,
        },
    });
    cachedKey = key;
    return cachedClient;
}
function ldapEscape(value) {
    return value.replace(/[\0()*\\]/g, (char) => {
        switch (char) {
            case '\0': return '\\00';
            case '(': return '\\28';
            case ')': return '\\29';
            case '*': return '\\2a';
            case '\\': return '\\5c';
            default: return char;
        }
    });
}
function text(value) {
    if (typeof value === 'string') {
        const cleaned = value.trim().replace(/\s+/g, ' ');
        return cleaned || undefined;
    }
    if (typeof value === 'number' || typeof value === 'boolean')
        return String(value);
    return undefined;
}
function directoryValue(user, attr) {
    return text(user[attr]);
}
function buildPersonalNumberFilter(personalNumber, config) {
    const escaped = ldapEscape(personalNumber.trim());
    const compacted = ldapEscape(personalNumber.trim().replace(/\s+/g, ''));
    const clauses = new Set();
    for (const attr of config.personalNumberAttributes) {
        if (attr === 'userPrincipalName' || attr === 'mail') {
            clauses.add(`(${attr}=${escaped}*)`);
            clauses.add(`(${attr}=${compacted}*)`);
        }
        else {
            clauses.add(`(${attr}=${escaped})`);
            clauses.add(`(${attr}=${compacted})`);
        }
    }
    return `(&(|(objectClass=user)(objectClass=person))(!(objectClass=computer))(!(objectClass=group))(|${[...clauses].join('')}))`;
}
function imageDataUrl(value) {
    if (!value)
        return undefined;
    if (typeof value === 'string') {
        return safeProfileImageUrl(value);
    }
    if (Buffer.isBuffer(value) && value.length > 0) {
        return `data:image/jpeg;base64,${value.toString('base64')}`;
    }
    return undefined;
}
function firstString(value) {
    if (Array.isArray(value)) {
        for (const item of value) {
            const itemText = text(item);
            if (itemText)
                return itemText;
        }
        return undefined;
    }
    return text(value);
}
function directoryUserToSharePointProfile(user, personalNumber, config = getConfig()) {
    const sAMAccountName = directoryValue(user, 'sAMAccountName') ?? personalNumber;
    const displayName = directoryValue(user, config.displayNameAttribute) ?? directoryValue(user, 'cn');
    const email = directoryValue(user, config.emailAttribute) ?? directoryValue(user, 'userPrincipalName');
    const department = directoryValue(user, config.orgPathAttribute);
    const title = directoryValue(user, config.titleAttribute);
    const phone = directoryValue(user, config.mobileAttribute) ?? directoryValue(user, config.phoneAttribute);
    return {
        UserProfile_GUID: directoryValue(user, 'objectGUID') ?? '',
        SID: directoryValue(user, 'objectSid') ?? '',
        ADGuid: directoryValue(user, 'objectGUID') ?? '',
        AccountName: sAMAccountName,
        FirstName: directoryValue(user, config.firstNameAttribute) ?? '',
        LastName: directoryValue(user, config.lastNameAttribute) ?? '',
        PreferredName: displayName ?? '',
        WorkPhone: directoryValue(user, config.phoneAttribute) ?? '',
        Department: department ?? '',
        Title: title ?? '',
        'SPS-Department': department ?? '',
        Manager: directoryValue(user, config.managerAttribute) ?? '',
        PictureURL: imageDataUrl(user[config.photoAttribute]) ?? imageDataUrl(user.jpegPhoto) ?? '',
        UserName: email ?? sAMAccountName,
        'SPS-JobTitle': title ?? '',
        'SPS-DataSource': config.sourceSystem,
        'SPS-MemberOf': firstString(user.memberOf) ?? department ?? '',
        'SPS-SipAddress': email ?? '',
        'SPS-ClaimID': directoryValue(user, 'distinguishedName') ?? directoryValue(user, 'dn') ?? '',
        'SPS-ResourceSID': directoryValue(user, 'objectSid') ?? '',
        'SPS-ResourceAccountName': sAMAccountName,
        'SPS-MasterAccountName': sAMAccountName,
        'SPS-UserPrincipalName': directoryValue(user, 'userPrincipalName') ?? email ?? '',
        WorkEmail: email ?? '',
        CellPhone: phone ?? '',
        Office: directoryValue(user, 'physicalDeliveryOfficeName') ?? '',
        'SPS-Location': department ?? '',
        'SPS-UserType': 'ActiveDirectory',
    };
}
async function lookupDirectoryUserByPersonalNumber(personalNumber) {
    const cleanPersonalNumber = personalNumber.trim();
    if (!cleanPersonalNumber)
        throw new Error('personalNumber is required');
    const config = getConfig();
    const ad = getClient(config);
    const opts = {
        attributes: config.userAttributes,
    };
    let rawUser = await ad.findUser(opts, cleanPersonalNumber, false);
    let strategy = rawUser ? 'findUser' : 'none';
    if (!rawUser) {
        const users = await ad.findUsers({
            attributes: config.userAttributes,
            filter: buildPersonalNumberFilter(cleanPersonalNumber, config),
            sizeLimit: 5,
        }, false);
        rawUser = users?.[0];
        strategy = rawUser ? 'attribute-search' : 'none';
    }
    if (!rawUser) {
        return {
            found: false,
            sourceSystem: config.sourceSystem,
            strategy,
            personalNumber: cleanPersonalNumber,
        };
    }
    const sharePointProfile = directoryUserToSharePointProfile(rawUser, cleanPersonalNumber, config);
    const mapped = mapSharePointProfileToIngest(sharePointProfile, {
        sourceSystem: config.sourceSystem,
        source: 'active-directory',
    });
    return {
        found: true,
        sourceSystem: config.sourceSystem,
        strategy,
        personalNumber: cleanPersonalNumber,
        rawUser,
        sharePointProfile,
        mapped,
    };
}

module.exports = { activeDirectoryStatus, directoryUserToSharePointProfile, lookupDirectoryUserByPersonalNumber };
