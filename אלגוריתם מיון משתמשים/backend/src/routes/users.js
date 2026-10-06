const { Router } = require('express');
const { User, UserOrgHistory, AiDecisionLog, OrgUnit } = require('../models/index');
const { escapeRegex } = require('../lib/escapeRegex');
const { reingestUser } = require('../modules/ingest/reingestUser');
const { isAdmin, resolveActor } = require('../modules/auth/demoAuth');
const { safeProfileImageUrl } = require('../modules/ingest/profileImage');
const router = Router();
const PROFILE_FIELDS = ['firstName', 'lastName', 'rank', 'role', 'email', 'phone', 'profileImageUrl'];
function pickProfilePatch(body) {
    const patch = {};
    for (const field of PROFILE_FIELDS) {
        if (body[field] == null)
            continue;
        if (field === 'profileImageUrl') {
            patch[field] = safeProfileImageUrl(body[field]) ?? '';
            continue;
        }
        patch[field] = String(body[field]).trim();
    }
    if (patch.firstName || patch.lastName) {
        const firstName = patch.firstName;
        const lastName = patch.lastName;
        if (firstName && lastName)
            patch.fullName = `${firstName} ${lastName}`;
    }
    return patch;
}
router.get('/', async (req, res) => {
    try {
        const actor = await resolveActor(req);
        if (!isAdmin(actor)) {
            const user = await User.findOne({ personalNumber: actor.personalNumber }).lean();
            res.json(user ? [user] : []);
            return;
        }
        const q = String(req.query.q || '').trim();
        const filter = {};
        if (q) {
            const safe = escapeRegex(q);
            filter.$or = [
                { personalNumber: new RegExp(safe, 'i') },
                { fullName: new RegExp(safe, 'i') },
                { firstName: new RegExp(safe, 'i') },
                { lastName: new RegExp(safe, 'i') },
                { currentOrgPathText: new RegExp(safe, 'i') },
                { email: new RegExp(safe, 'i') },
                { phone: new RegExp(safe, 'i') },
                { rank: new RegExp(safe, 'i') },
                { role: new RegExp(safe, 'i') },
                { sourceSystem: new RegExp(safe, 'i') },
                { registeredSourceSystem: new RegExp(safe, 'i') },
                { sourceSystems: new RegExp(safe, 'i') },
                { accessRole: new RegExp(safe, 'i') },
            ];
        }
        if (typeof req.query.sourceSystem === 'string' && req.query.sourceSystem.trim()) {
            const safe = escapeRegex(req.query.sourceSystem.trim());
            filter.$and = [
                ...(Array.isArray(filter.$and) ? filter.$and : []),
                {
                    $or: [
                        { sourceSystem: new RegExp(`^${safe}$`, 'i') },
                        { registeredSourceSystem: new RegExp(`^${safe}$`, 'i') },
                        { sourceSystems: new RegExp(`^${safe}$`, 'i') },
                    ],
                },
            ];
        }
        const requestedLimit = Number(req.query.limit);
        const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 1000) : 500;
        const users = await User.find(filter).sort({ lastSeenAt: -1 }).limit(limit).lean();
        res.json(users);
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});
async function pathTextFromIds(ids) {
    if (!ids?.length)
        return '—';
    const units = await OrgUnit.find({ _id: { $in: ids } }).lean();
    const map = new Map(units.map((u) => [String(u._id), u.canonicalName]));
    return ids.map((id) => map.get(String(id)) ?? '?').join(' / ');
}
router.get('/:personalNumber', async (req, res) => {
    try {
        const actor = await resolveActor(req);
        const pn = req.params.personalNumber;
        if (!isAdmin(actor) && actor.personalNumber !== pn) {
            res.status(403).json({ error: 'אין הרשאה לצפות בפרופיל משתמש אחר' });
            return;
        }
        const user = await User.findOne({ personalNumber: pn }).lean();
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const [historyRaw, decisions] = await Promise.all([
            UserOrgHistory.find({ personalNumber: pn }).sort({ changedAt: -1 }).lean(),
            AiDecisionLog.find({ personalNumber: pn }).sort({ createdAt: -1 }).limit(30).lean(),
        ]);
        const history = await Promise.all(historyRaw.map(async (h) => ({
            ...h,
            fromPathText: await pathTextFromIds(h.fromPathIds ?? []),
            toPathText: await pathTextFromIds(h.toPathIds ?? []),
        })));
        res.json({ user, history, decisions });
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});
router.patch('/:personalNumber/profile', async (req, res) => {
    try {
        const actor = await resolveActor(req);
        const pn = req.params.personalNumber;
        if (!isAdmin(actor) && actor.personalNumber !== pn) {
            res.status(403).json({ error: 'אין הרשאה לערוך פרופיל משתמש אחר' });
            return;
        }
        const user = await User.findOne({ personalNumber: pn });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const patch = pickProfilePatch(req.body ?? {});
        if (patch.firstName && !patch.lastName)
            patch.fullName = `${patch.firstName} ${user.lastName}`;
        if (!patch.firstName && patch.lastName)
            patch.fullName = `${user.firstName} ${patch.lastName}`;
        Object.assign(user, patch);
        await user.save();
        res.json(user);
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});
router.patch('/:personalNumber/access-role', async (req, res) => {
    try {
        const actor = await resolveActor(req);
        if (!isAdmin(actor)) {
            res.status(403).json({ error: 'רק מנהל יכול לשנות הרשאות' });
            return;
        }
        const accessRole = req.body?.accessRole === 'admin' ? 'admin' : 'regular';
        const user = await User.findOneAndUpdate({ personalNumber: req.params.personalNumber }, { $set: { accessRole } }, { new: true });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json(user);
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});
router.post('/:personalNumber/reingest', async (req, res) => {
    try {
        const actor = await resolveActor(req);
        if (!isAdmin(actor)) {
            res.status(403).json({ error: 'רק מנהל יכול להריץ ingest מחדש' });
            return;
        }
        const result = await reingestUser(req.params.personalNumber, req.body?.rawOrgPath);
        res.json(result);
    }
    catch (e) {
        const msg = String(e);
        res.status(msg.includes('not found') ? 404 : 400).json({ error: msg });
    }
});

module.exports = router;
