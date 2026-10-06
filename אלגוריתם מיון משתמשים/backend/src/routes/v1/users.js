const { Router } = require('express');
const { User, UserOrgHistory, AiDecisionLog } = require('../../models/index');
const { ingestLogin } = require('../../modules/ingest/ingestLogin');
const { formatUserRecord, formatIngestResponse } = require('../../services/userApiResponse');
const { OrgUnit } = require('../../models/index');
const { escapeRegex } = require('../../lib/escapeRegex');
const { exactSourceSystemRegex, normalizeSourceSystem, sourceSystemFromRequest } = require('../../modules/ingest/sourceSystem');
const { mapSharePointProfileToIngest, sharePointProfileFromPayload } = require('../../modules/ingest/sharePointProfile');
const { safeProfileImageUrl } = require('../../modules/ingest/profileImage');
const router = Router();
async function pathTextFromIds(ids) {
    if (!ids?.length)
        return '';
    const units = await OrgUnit.find({ _id: { $in: ids } }).lean();
    const map = new Map(units.map((u) => [String(u._id), u.canonicalName]));
    return ids.map((id) => map.get(String(id)) ?? '?').join(' / ');
}
function optionalText(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function sourceSystemUserFilter(sourceSystem, match = 'any') {
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
    if (match === 'seen')
        return { sourceSystems: exact };
    return {
        $or: [
            { sourceSystem: exact },
            { registeredSourceSystem: exact },
            { sourceSystems: exact },
        ],
    };
}
/** POST /api/v1/users — שליחת משתמש חדש / עדכון (ingest מלא) */
router.post('/', async (req, res) => {
    try {
        const sourceSystem = sourceSystemFromRequest(req);
        const sharePointProfile = sharePointProfileFromPayload(req.body);
        const mappedSharePoint = sharePointProfile
            ? mapSharePointProfileToIngest(sharePointProfile, {
                sourceSystem,
                source: optionalText(req.body?.source) || 'external-api',
            })
            : null;
        const { personalNumber, firstName, lastName, rawOrgPath, source, rank, role, email, phone, profileImageUrl, attributes, } = req.body;
        const bodyAttributes = attributes && typeof attributes === 'object' && !Array.isArray(attributes)
            ? attributes
            : undefined;
        const mergedAttributes = mappedSharePoint
            ? { ...(mappedSharePoint.attributes ?? {}), ...(bodyAttributes ?? {}) }
            : bodyAttributes;
        const personalNumberText = optionalText(mappedSharePoint?.personalNumber ?? personalNumber);
        const firstNameText = optionalText(mappedSharePoint?.firstName ?? firstName);
        const lastNameText = optionalText(mappedSharePoint?.lastName ?? lastName);
        const rawOrgPathText = optionalText(mappedSharePoint?.rawOrgPath ?? rawOrgPath);
        const resolvedSourceSystem = mappedSharePoint?.sourceSystem ?? sourceSystem;
        if (!personalNumberText || !firstNameText || !lastNameText || !rawOrgPathText) {
            res.status(400).json({
                ok: false,
                error: 'Required: personalNumber, firstName, lastName, rawOrgPath',
                missing: mappedSharePoint?.missing?.length ? mappedSharePoint.missing : undefined,
            });
            return;
        }
        if (!resolvedSourceSystem) {
            res.status(400).json({
                ok: false,
                error: 'Required: sourceSystem. Send it in body.sourceSystem or header X-Source-System',
            });
            return;
        }
        const result = await ingestLogin({
            personalNumber: personalNumberText,
            firstName: firstNameText,
            lastName: lastNameText,
            rawOrgPath: rawOrgPathText,
            source: optionalText(mappedSharePoint?.source ?? source) || 'external-api',
            rank: optionalText(mappedSharePoint?.rank ?? rank),
            role: optionalText(mappedSharePoint?.role ?? role),
            email: optionalText(mappedSharePoint?.email ?? email),
            phone: optionalText(mappedSharePoint?.phone ?? phone),
            profileImageUrl: safeProfileImageUrl(mappedSharePoint?.profileImageUrl ?? profileImageUrl),
            sourceSystem: resolvedSourceSystem?.trim(),
            attributes: mergedAttributes,
        });
        res.status(result.user.created ? 201 : 200).json({
            ok: true,
            data: formatIngestResponse(result),
        });
    }
    catch (e) {
        console.error('[v1/users POST]', e);
        res.status(500).json({ ok: false, error: String(e) });
    }
});
/** GET /api/v1/users?q= — חיפוש משתמשים */
router.get('/', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        const limit = Math.min(Number(req.query.limit) || 50, 100);
        const sourceSystem = normalizeSourceSystem(req.query.sourceSystem ?? req.query.seenVia);
        const registeredSourceSystem = normalizeSourceSystem(req.query.registeredSourceSystem ?? req.query.registeredVia);
        const source = optionalText(req.query.source);
        const sourceMatch = optionalText(req.query.sourceMatch) ?? 'any';
        const filter = {};
        const and = [];
        if (q) {
            const safe = escapeRegex(q);
            and.push({ $or: [
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
                ] });
        }
        if (sourceSystem)
            and.push(sourceSystemUserFilter(sourceSystem, sourceMatch));
        if (registeredSourceSystem)
            and.push(sourceSystemUserFilter(registeredSourceSystem, 'registered'));
        if (source)
            and.push({ sources: new RegExp(escapeRegex(source), 'i') });
        if (and.length)
            filter.$and = and;
        const users = await User.find(filter).sort({ lastSeenAt: -1 }).limit(limit).lean();
        const data = await Promise.all(users.map((u) => formatUserRecord(u)));
        res.json({
            ok: true,
            data,
            meta: {
                count: data.length,
                query: q || null,
                sourceSystem: sourceSystem || null,
                registeredSourceSystem: registeredSourceSystem || null,
                source: source || null,
                sourceMatch,
            },
        });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: String(e) });
    }
});
/** GET /api/v1/users/:personalNumber — משיכת מידע מלא על משתמש */
router.get('/:personalNumber', async (req, res) => {
    try {
        const pn = req.params.personalNumber;
        const user = await User.findOne({ personalNumber: pn }).lean();
        if (!user) {
            res.status(404).json({ ok: false, error: 'User not found' });
            return;
        }
        const includeHistory = req.query.history !== 'false';
        const includeDecisions = req.query.decisions !== 'false';
        const [profile, historyRaw, decisions] = await Promise.all([
            formatUserRecord(user),
            includeHistory
                ? UserOrgHistory.find({ personalNumber: pn }).sort({ changedAt: -1 }).limit(50).lean()
                : Promise.resolve([]),
            includeDecisions
                ? AiDecisionLog.find({ personalNumber: pn }).sort({ createdAt: -1 }).limit(30).lean()
                : Promise.resolve([]),
        ]);
        const history = includeHistory
            ? await Promise.all(historyRaw.map(async (h) => ({
                rawPath: h.rawPath,
                changedAt: h.changedAt,
                fromPathText: await pathTextFromIds(h.fromPathIds ?? []),
                toPathText: await pathTextFromIds(h.toPathIds ?? []),
                changeSource: h.changeSource,
            })))
            : undefined;
        res.json({
            ok: true,
            data: {
                ...profile,
                history,
                decisions: includeDecisions
                    ? decisions.map((d) => ({
                        id: String(d._id),
                        action: d.action,
                        rawValue: d.rawValue,
                        matchedName: d.matchedCanonicalName,
                        confidence: d.confidence,
                        reason: d.reason,
                        createdAt: d.createdAt,
                    }))
                    : undefined,
            },
        });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: String(e) });
    }
});

module.exports = router;
