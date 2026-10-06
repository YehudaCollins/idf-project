const { OrgUnit, User } = require('../models/index');
const { normalizeSegment } = require('../modules/parser/normalizer');
const { MILITARY_ORG_TREE, ROOT_PATH } = require('./militaryTree.he');
const BASE_ORG_TREE = MILITARY_ORG_TREE;
const P = ROOT_PATH;
/** משתמשים מראש על העץ (שמות עבריים) */
const BASE_SEED_USERS = [
    { personalNumber: 'DEMO-1001', firstName: 'יהודה', lastName: 'כהן', orgPath: `${P}/אגף התקשוב/ענף צפון/מדור תומר/צוות א׳` },
    { personalNumber: 'DEMO-1002', firstName: 'ישראל', lastName: 'לוי', orgPath: `${P}/אגף התקשוב/ענף צפון/מדור תומר/צוות א׳` },
    { personalNumber: 'DEMO-2004', firstName: 'נדב', lastName: 'שפירא', orgPath: `${P}/אגף התקשוב/ענף צפון/מדור תומר/צוות ב׳` },
    { personalNumber: 'DEMO-1003', firstName: 'דוד', lastName: 'מזרחי', orgPath: `${P}/אגף התקשוב/ענף צפון/מדור תומר/צוות ב׳` },
    { personalNumber: 'DEMO-1010', firstName: 'אלי', lastName: 'רוזן', orgPath: `${P}/אגף הלוגיסטיקה/ענף אספקה/מדור מחסנים צפון` },
    { personalNumber: 'DEMO-1013', firstName: 'טל', lastName: 'בן דוד', orgPath: `${P}/אגף המודיעין/ענף ניתוח/מדור שולחן א׳` },
];
const pathIndex = new Map();
const SEED_RANKS = ['רב"ט', 'סמל', 'סמ"ר', 'רס"ל', 'סגן', 'סרן'];
const SEED_AVATAR_COLORS = ['111827', '1f2937', '334155', '0f766e', '4338ca', '7c3aed'];
function seedProfileImageUrl(user, index) {
    const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}` || user.personalNumber.slice(-2);
    const color = SEED_AVATAR_COLORS[index % SEED_AVATAR_COLORS.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="32" fill="#${color}"/><text x="80" y="94" text-anchor="middle" font-size="52" font-family="Arial, sans-serif" font-weight="700" fill="#fff">${initials}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
const SEED_PROFILE_BY_PERSONAL_NUMBER = {
    'DEMO-1001': { rank: 'סרן', role: 'קמ"ד צוות א׳' },
    'DEMO-2004': { rank: 'סרן', role: 'מפקד צוות ב׳' },
    'DEMO-1003': { rank: 'סמל', role: 'חייל צוות' },
    'DEMO-1010': { rank: 'רס"ן', role: 'רת"ח אספקה' },
    'DEMO-1013': { rank: 'רס"ן', role: 'רת"ח שולחן א׳' },
};
async function createUnit(node, parent, level) {
    const ancestorIds = parent ? [...parent.ancestorIds, parent.id] : [];
    const pathText = parent ? `${parent.pathText}/${node.name}` : node.name;
    const aliases = (node.aliases ?? []).map((a) => ({
        value: a.value,
        normalizedValue: normalizeSegment(a.value),
        confidence: a.confidence ?? 0.9,
        seenCount: 3,
        scope: 'parent',
        source: 'seed',
        status: 'active',
    }));
    const doc = await OrgUnit.create({
        canonicalName: node.name,
        normalizedName: normalizeSegment(node.name),
        parentId: parent?.id,
        pathIds: ancestorIds,
        pathText,
        level,
        type: node.type ?? 'לא ידוע',
        aliases,
        isVerified: node.isVerified ?? false,
        verificationStatus: node.isVerified ? 'מאומת' : 'לא מאומת',
        stats: { userCount: 0, aliasCount: aliases.length, loginCount: 0 },
    });
    const unitId = doc._id;
    const created = {
        id: unitId,
        pathText,
        ancestorIds,
        fullPathIds: [...ancestorIds, unitId],
    };
    pathIndex.set(pathText, created);
    for (const child of node.children ?? []) {
        await createUnit(child, created, level + 1);
    }
    return created;
}
async function recalcAllUserCountsInSeed() {
    const { recalcAllUserCounts } = require('../modules/org/orgStats');
    await recalcAllUserCounts();
}
async function seedBaseOrgTree() {
    pathIndex.clear();
    await createUnit(MILITARY_ORG_TREE, null, 0);
    const now = new Date();
    let userCount = 0;
    for (const [index, u] of BASE_SEED_USERS.entries()) {
        const unit = pathIndex.get(u.orgPath);
        if (!unit) {
            console.warn(`[seed] נתיב לא נמצא: ${u.personalNumber} → ${u.orgPath}`);
            continue;
        }
        const fullName = `${u.firstName} ${u.lastName}`;
        const profile = {
            rank: SEED_RANKS[index % SEED_RANKS.length],
            role: index % 6 === 0 ? 'אחראי צוות' : 'חייל צוות',
            ...u,
            ...SEED_PROFILE_BY_PERSONAL_NUMBER[u.personalNumber],
        };
        const profileImageUrl = profile.profileImageUrl ?? seedProfileImageUrl(u, index);
        await User.create({
            personalNumber: u.personalNumber,
            firstName: u.firstName,
            lastName: u.lastName,
            fullName,
            rank: profile.rank,
            role: profile.role,
            profileImageUrl,
            currentOrgUnitId: unit.id,
            currentOrgPathIds: unit.fullPathIds,
            currentOrgPathText: unit.pathText,
            rawPaths: [`${u.orgPath}/${fullName}`],
            knownNames: [fullName],
            sources: ['seed'],
            sourceSystem: 'Seed',
            registeredSourceSystem: 'Seed',
            sourceSystems: ['Seed'],
            loginCount: 1,
            firstSeenAt: now,
            lastSeenAt: now,
        });
        userCount++;
    }
    await OrgUnit.updateMany({}, { $set: { 'stats.loginCount': 1 } });
    await recalcAllUserCountsInSeed();
    return {
        unitCount: await OrgUnit.countDocuments(),
        userCount,
        rootPath: ROOT_PATH,
    };
}

module.exports = { BASE_ORG_TREE, ROOT_PATH, seedBaseOrgTree, BASE_SEED_USERS };
