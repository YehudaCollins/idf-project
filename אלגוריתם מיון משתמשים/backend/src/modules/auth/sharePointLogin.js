const { User } = require('../../models/index');
const { ingestLogin } = require('../ingest/ingestLogin');
const { mapSharePointProfileToIngest, sharePointProfileFromPayload, } = require('../ingest/sharePointProfile');
const FALLBACK_ORG_PATH = 'ללא שיוך ארגוני';
function optionalText(value) {
    if (typeof value !== 'string')
        return undefined;
    const cleaned = value.trim();
    return cleaned || undefined;
}
function actorFromUser(user) {
    const fullName = optionalText(user.fullName) ||
        [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
        user.personalNumber;
    return {
        id: 'session',
        personalNumber: user.personalNumber,
        fullName,
        accessRole: user.accessRole === 'admin' ? 'admin' : 'regular',
        label: user.accessRole === 'admin' ? 'מנהל' : 'משתמש',
        source: 'sharepoint',
        rank: optionalText(user.rank),
        role: optionalText(user.role),
        profileImageUrl: optionalText(user.profileImageUrl),
        currentOrgPathText: optionalText(user.currentOrgPathText),
    };
}
function buildIngestInput(profile) {
    const mapped = mapSharePointProfileToIngest(profile, { source: 'sharepoint-login' });
    const personalNumber = optionalText(mapped.personalNumber);
    if (!personalNumber) {
        return { error: 'לא זוהה מספר אישי בפרופיל SharePoint', mapped };
    }
    const firstName = optionalText(mapped.firstName) || optionalText(mapped.lastName) || 'משתמש';
    const lastName = optionalText(mapped.lastName) ||
        (optionalText(mapped.firstName) ? 'SharePoint' : personalNumber);
    const rawOrgPath = optionalText(mapped.rawOrgPath) || FALLBACK_ORG_PATH;
    return {
        mapped,
        input: {
            personalNumber,
            firstName,
            lastName,
            rawOrgPath,
            source: 'sharepoint-login',
            rank: optionalText(mapped.rank),
            role: optionalText(mapped.role),
            email: optionalText(mapped.email),
            phone: optionalText(mapped.phone),
            profileImageUrl: optionalText(mapped.profileImageUrl),
            sourceSystem: optionalText(mapped.sourceSystem) || 'SharePoint User Profile',
            attributes: mapped.attributes,
        },
    };
}
async function touchExistingUser(personalNumber, profile) {
    const mapped = mapSharePointProfileToIngest(profile, { source: 'sharepoint-login' });
    const user = await User.findOne({ personalNumber });
    if (!user)
        return null;
    const firstName = optionalText(mapped.firstName);
    const lastName = optionalText(mapped.lastName);
    if (firstName)
        user.firstName = firstName;
    if (lastName)
        user.lastName = lastName;
    if (firstName || lastName) {
        user.fullName = `${user.firstName} ${user.lastName}`.trim();
    }
    if (optionalText(mapped.rank))
        user.rank = mapped.rank;
    if (optionalText(mapped.role))
        user.role = mapped.role;
    if (optionalText(mapped.email))
        user.email = mapped.email;
    if (optionalText(mapped.phone))
        user.phone = mapped.phone;
    if (optionalText(mapped.profileImageUrl))
        user.profileImageUrl = mapped.profileImageUrl;
    if (mapped.attributes && typeof mapped.attributes === 'object') {
        user.attributes = { ...(user.attributes ?? {}), ...mapped.attributes };
    }
    user.loginCount = (user.loginCount ?? 0) + 1;
    user.lastSeenAt = new Date();
    if (!user.sources.includes('sharepoint-login'))
        user.sources.push('sharepoint-login');
    await user.save();
    return user;
}
async function loginFromSharePointProfile(payload) {
    const profile = sharePointProfileFromPayload(payload);
    if (!profile) {
        throw Object.assign(new Error('חסר פרופיל Microsoft/SharePoint'), { status: 400 });
    }
    const prepared = buildIngestInput(profile);
    if ('error' in prepared) {
        throw Object.assign(new Error(prepared.error), { status: 422, missing: prepared.mapped.missing });
    }
    const existing = await User.findOne({ personalNumber: prepared.input.personalNumber }).lean();
    const hasRealOrgPath = Boolean(optionalText(mapSharePointProfileToIngest(profile).rawOrgPath));
    // משתמש קיים בלי נתיב ארגוני אמיתי בפרופיל — רק מרעננים זהות וסופרים התחברות
    if (existing && !hasRealOrgPath) {
        const touched = await touchExistingUser(prepared.input.personalNumber, profile);
        if (!touched) {
            throw Object.assign(new Error('משתמש לא נמצא'), { status: 404 });
        }
        return {
            actor: actorFromUser(touched),
            created: false,
            updated: true,
        };
    }
    const ingest = await ingestLogin(prepared.input);
    const user = await User.findOne({ personalNumber: prepared.input.personalNumber });
    if (!user) {
        throw Object.assign(new Error('השמירה הצליחה אבל המשתמש לא נמצא'), { status: 500 });
    }
    return {
        actor: actorFromUser(user),
        created: ingest.user.created,
        updated: ingest.user.updated,
        ingest,
    };
}

module.exports = { loginFromSharePointProfile };
