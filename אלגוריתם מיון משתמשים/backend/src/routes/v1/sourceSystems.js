const { Router } = require('express');
const { RawIngestEvent, User } = require('../../models/index');
const { escapeRegex } = require('../../lib/escapeRegex');
const { exactSourceSystemRegex, normalizeSourceSystem } = require('../../modules/ingest/sourceSystem');
const { formatUserRecord } = require('../../services/userApiResponse');
const router = Router();
function parseLimit(value, fallback = 100, max = 500) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
        return fallback;
    return Math.min(Math.max(Math.floor(parsed), 1), max);
}
function parseMatch(value) {
    return value === 'latest' || value === 'registered' || value === 'seen' ? value : 'any';
}
function userFilterForSystem(sourceSystem, match) {
    const exact = exactSourceSystemRegex(sourceSystem);
    if (match === 'latest')
        return { sourceSystem: exact };
    if (match === 'registered') {
        return {
            $or: [
                { registeredSourceSystem: exact },
                { registeredSourceSystem: { $exists: false }, sourceSystem: exact },
            ],
        };
    }
    if (match === 'seen') {
        return {
            $or: [
                { sourceSystems: exact },
                { sourceSystems: { $exists: false }, sourceSystem: exact },
            ],
        };
    }
    return {
        $or: [
            { sourceSystem: exact },
            { registeredSourceSystem: exact },
            { sourceSystems: exact },
        ],
    };
}
function addSummary(map, systemName) {
    const current = map.get(systemName);
    if (current)
        return current;
    const created = {
        name: systemName,
        latestUserCount: 0,
        registeredUserCount: 0,
        seenUserCount: 0,
        ingestEventCount: 0,
        firstSeenAt: undefined,
        lastSeenAt: undefined,
    };
    map.set(systemName, created);
    return created;
}
function touchDates(summary, firstSeenAt, lastSeenAt) {
    if (firstSeenAt && (!summary.firstSeenAt || firstSeenAt < summary.firstSeenAt))
        summary.firstSeenAt = firstSeenAt;
    if (lastSeenAt && (!summary.lastSeenAt || lastSeenAt > summary.lastSeenAt))
        summary.lastSeenAt = lastSeenAt;
}
/** GET /api/v1/source-systems — סיכום מערכות מקור */
router.get('/', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        const limit = parseLimit(req.query.limit, 100, 500);
        const summaries = new Map();
        const [users, eventCounts] = await Promise.all([
            User.find()
                .select('sourceSystem registeredSourceSystem sourceSystems firstSeenAt lastSeenAt')
                .lean(),
            RawIngestEvent.aggregate([
                { $match: { sourceSystem: { $type: 'string', $ne: '' } } },
                { $group: { _id: '$sourceSystem', count: { $sum: 1 }, lastSeenAt: { $max: '$createdAt' } } },
            ]),
        ]);
        for (const user of users) {
            const latest = normalizeSourceSystem(user.sourceSystem);
            const registered = normalizeSourceSystem(user.registeredSourceSystem ?? user.sourceSystem);
            const seenSystems = new Set([...(user.sourceSystems ?? []), latest, registered]
                .map((value) => normalizeSourceSystem(value))
                .filter((value) => !!value));
            if (latest) {
                const summary = addSummary(summaries, latest);
                summary.latestUserCount += 1;
                touchDates(summary, user.firstSeenAt, user.lastSeenAt);
            }
            if (registered) {
                const summary = addSummary(summaries, registered);
                summary.registeredUserCount += 1;
                touchDates(summary, user.firstSeenAt, user.lastSeenAt);
            }
            for (const system of seenSystems) {
                const summary = addSummary(summaries, system);
                summary.seenUserCount += 1;
                touchDates(summary, user.firstSeenAt, user.lastSeenAt);
            }
        }
        for (const row of eventCounts) {
            const name = normalizeSourceSystem(row._id);
            if (!name)
                continue;
            const summary = addSummary(summaries, name);
            summary.ingestEventCount = row.count;
            touchDates(summary, undefined, row.lastSeenAt);
        }
        const safe = q ? new RegExp(escapeRegex(q), 'i') : null;
        const data = [...summaries.values()]
            .filter((item) => !safe || safe.test(item.name))
            .sort((a, b) => {
            const lastA = a.lastSeenAt?.getTime() ?? 0;
            const lastB = b.lastSeenAt?.getTime() ?? 0;
            return lastB - lastA || a.name.localeCompare(b.name);
        })
            .slice(0, limit);
        res.json({ ok: true, data, meta: { count: data.length, query: q || null } });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: String(e) });
    }
});
/** GET /api/v1/source-systems/:sourceSystem/users?match=any|latest|registered|seen */
router.get('/:sourceSystem/users', async (req, res) => {
    try {
        const sourceSystem = normalizeSourceSystem(req.params.sourceSystem);
        if (!sourceSystem) {
            res.status(400).json({ ok: false, error: 'sourceSystem is required' });
            return;
        }
        const match = parseMatch(req.query.match);
        const q = String(req.query.q || '').trim();
        const limit = parseLimit(req.query.limit, 100, 500);
        const filters = [userFilterForSystem(sourceSystem, match)];
        if (q) {
            const safe = escapeRegex(q);
            filters.push({
                $or: [
                    { personalNumber: new RegExp(safe, 'i') },
                    { fullName: new RegExp(safe, 'i') },
                    { currentOrgPathText: new RegExp(safe, 'i') },
                    { email: new RegExp(safe, 'i') },
                    { phone: new RegExp(safe, 'i') },
                    { rank: new RegExp(safe, 'i') },
                    { role: new RegExp(safe, 'i') },
                ],
            });
        }
        const users = await User.find({ $and: filters }).sort({ lastSeenAt: -1 }).limit(limit).lean();
        const data = await Promise.all(users.map((user) => formatUserRecord(user)));
        res.json({ ok: true, data, meta: { count: data.length, sourceSystem, match, query: q || null } });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: String(e) });
    }
});
/** GET /api/v1/source-systems/:sourceSystem/ingest-events */
router.get('/:sourceSystem/ingest-events', async (req, res) => {
    try {
        const sourceSystem = normalizeSourceSystem(req.params.sourceSystem);
        if (!sourceSystem) {
            res.status(400).json({ ok: false, error: 'sourceSystem is required' });
            return;
        }
        const limit = parseLimit(req.query.limit, 100, 500);
        const personalNumber = typeof req.query.personalNumber === 'string' ? req.query.personalNumber.trim() : '';
        const createdFrom = typeof req.query.from === 'string' ? new Date(req.query.from) : null;
        const createdTo = typeof req.query.to === 'string' ? new Date(req.query.to) : null;
        const filter = { sourceSystem: exactSourceSystemRegex(sourceSystem) };
        if (personalNumber)
            filter.personalNumber = personalNumber;
        if ((createdFrom && !Number.isNaN(createdFrom.getTime())) || (createdTo && !Number.isNaN(createdTo.getTime()))) {
            filter.createdAt = {
                ...(createdFrom && !Number.isNaN(createdFrom.getTime()) ? { $gte: createdFrom } : {}),
                ...(createdTo && !Number.isNaN(createdTo.getTime()) ? { $lte: createdTo } : {}),
            };
        }
        const events = await RawIngestEvent.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
        const data = events.map((event) => ({
            id: String(event._id),
            personalNumber: event.personalNumber,
            fullName: `${event.firstName} ${event.lastName}`,
            rawOrgPath: event.rawOrgPath,
            source: event.source,
            sourceSystem: event.sourceSystem,
            finalResult: event.finalResult,
            createdAt: event.createdAt,
        }));
        res.json({ ok: true, data, meta: { count: data.length, sourceSystem, personalNumber: personalNumber || null } });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: String(e) });
    }
});

module.exports = router;
