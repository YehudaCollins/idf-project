const { User } = require('../../models/index');
const DEMO_ACTORS = {
    admin: {
        id: 'admin',
        personalNumber: 'DEMO-2001',
        accessRole: 'admin',
        label: 'מנהל דמו',
        rank: 'סרן',
        role: 'קמ"ד דיגיטל',
        fallbackName: 'יונתן הררי',
    },
    regular: {
        id: 'regular',
        personalNumber: 'DEMO-2004',
        accessRole: 'regular',
        label: 'משתמש רגיל',
        rank: 'סרן',
        role: 'מפקד צוות ב׳',
        fallbackName: 'נדב שפירא',
    },
};
function headerText(req, name) {
    return String(req.header(name) || '').trim();
}
function readDemoActorId(req) {
    const value = headerText(req, 'x-demo-actor');
    return value === 'regular' ? 'regular' : 'admin';
}
function actorFromDbUser(user, source = 'sharepoint') {
    const fullName = user.fullName?.trim() ||
        [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
        user.personalNumber;
    return {
        id: 'session',
        personalNumber: user.personalNumber,
        fullName,
        accessRole: user.accessRole === 'admin' ? 'admin' : 'regular',
        label: user.accessRole === 'admin' ? 'מנהל' : 'משתמש',
        source,
        rank: user.rank || undefined,
        role: user.role || undefined,
        profileImageUrl: user.profileImageUrl || undefined,
        currentOrgPathText: user.currentOrgPathText || undefined,
    };
}
async function resolveByPersonalNumber(personalNumber) {
    const clean = personalNumber.trim();
    if (!clean)
        return null;
    const user = await User.findOne({ personalNumber: clean })
        .select('personalNumber fullName firstName lastName accessRole rank role profileImageUrl currentOrgPathText')
        .lean();
    if (!user)
        return null;
    return actorFromDbUser(user, 'sharepoint');
}
async function resolveActor(req) {
    const sessionPn = headerText(req, 'x-session-personal-number') ||
        headerText(req, 'x-demo-personal-number');
    // אם נשלח מספר אישי שאינו של שחקן דמו — זהה לפי SP/סשן
    const demoIds = new Set(Object.values(DEMO_ACTORS).map((a) => a.personalNumber));
    if (sessionPn && !demoIds.has(sessionPn)) {
        const sessionActor = await resolveByPersonalNumber(sessionPn);
        if (sessionActor)
            return sessionActor;
    }
    // מצב דמו / פיתוח
    const id = readDemoActorId(req);
    const seed = DEMO_ACTORS[id];
    const user = await User.findOne({ personalNumber: seed.personalNumber })
        .select('fullName rank role profileImageUrl currentOrgPathText accessRole')
        .lean();
    return {
        id,
        personalNumber: seed.personalNumber,
        accessRole: (user?.accessRole === 'admin' || user?.accessRole === 'regular'
            ? user.accessRole
            : seed.accessRole),
        label: seed.label,
        source: 'demo',
        fullName: user?.fullName ?? seed.fallbackName,
        rank: user?.rank || seed.rank,
        role: user?.role || seed.role,
        profileImageUrl: user?.profileImageUrl || seed.profileImageUrl,
        currentOrgPathText: user?.currentOrgPathText,
    };
}
async function actorUser(actor) {
    return User.findOne({ personalNumber: actor.personalNumber });
}
function isAdmin(actor) {
    return actor.accessRole === 'admin';
}
function publicActor(actor) {
    return {
        id: actor.id,
        personalNumber: actor.personalNumber,
        fullName: actor.fullName,
        accessRole: actor.accessRole,
        label: actor.label,
        source: actor.source,
        rank: actor.rank,
        role: actor.role,
        profileImageUrl: actor.profileImageUrl,
        currentOrgPathText: actor.currentOrgPathText,
    };
}
async function demoActors() {
    const actors = await Promise.all(Object.keys(DEMO_ACTORS).map(async (id) => {
        const seed = DEMO_ACTORS[id];
        const user = await User.findOne({ personalNumber: seed.personalNumber })
            .select('fullName rank role profileImageUrl currentOrgPathText accessRole')
            .lean();
        return {
            id,
            personalNumber: seed.personalNumber,
            fullName: user?.fullName ?? seed.fallbackName,
            accessRole: (user?.accessRole === 'admin' || user?.accessRole === 'regular'
                ? user.accessRole
                : seed.accessRole),
            label: seed.label,
            source: 'demo',
            rank: user?.rank || seed.rank,
            role: user?.role || seed.role,
            profileImageUrl: user?.profileImageUrl || seed.profileImageUrl,
            currentOrgPathText: user?.currentOrgPathText,
        };
    }));
    return actors;
}

module.exports = { resolveActor, actorUser, isAdmin, publicActor, demoActors };
