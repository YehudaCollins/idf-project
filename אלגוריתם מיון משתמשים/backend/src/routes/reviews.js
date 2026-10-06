const { Router } = require('express');
const { OrgChangeRequest, OrgUnit, User, UserOrgHistory } = require('../models/index');
const { escapeRegex } = require('../lib/escapeRegex');
const { normalizeSegment } = require('../modules/parser/normalizer');
const { stringSimilarity } = require('../modules/parser/fuzzy');
const { logDecision } = require('../modules/ai-decisions/logDecision');
const { applyReviewApproval } = require('../modules/reviews/applyReviewApproval');
const { reingestUser } = require('../modules/ingest/reingestUser');
const { rejectCommanderChange } = require('../modules/org/commanderReview');
const { syncStatsAfterUserMove } = require('../modules/org/orgStats');
const { resolveSoldierPlacement } = require('../modules/org/placementRules');
const { parseReviewNoteDirectives } = require('../modules/reviews/reviewNoteDirectives');
const router = Router();
const CHOICE_REVIEW_TYPES = new Set(['conflict_match', 'medium_confidence', 'alias_proposal']);
const USER_ROUTE_REVIEW_TYPES = new Set(['conflict_match', 'medium_confidence']);
function parentQuery(parentId) {
    return parentId
        ? { parentId }
        : { $or: [{ parentId: null }, { parentId: { $exists: false } }] };
}
function requestNote(body) {
    return typeof body.note === 'string' && body.note.trim() ? body.note.trim() : undefined;
}
function scoreUnitQuery(query, unit) {
    const normalizedQuery = normalizeSegment(query);
    const normalizedName = unit.normalizedName || normalizeSegment(unit.canonicalName);
    const normalizedPath = normalizeSegment(unit.pathText || unit.canonicalName);
    if (normalizedName === normalizedQuery || normalizedPath === normalizedQuery)
        return 1;
    if (normalizedPath.includes(normalizedQuery) || normalizedQuery.includes(normalizedName))
        return 0.96;
    return Math.max(stringSimilarity(normalizedQuery, normalizedName), stringSimilarity(normalizedQuery, normalizedPath));
}
async function resolveSelectedUnitFromNote(item, directives) {
    const query = directives.targetUnitQuery?.trim();
    if (!query)
        return undefined;
    if (item.conflict?.candidates?.length) {
        const ids = item.conflict.candidates.map((candidate) => candidate.unitId);
        const units = await OrgUnit.find({ _id: { $in: ids } }).select('_id canonicalName normalizedName pathText').lean();
        const scored = units
            .map((unit) => ({ unitId: String(unit._id), score: scoreUnitQuery(query, unit) }))
            .sort((a, b) => b.score - a.score);
        if (scored[0] && scored[0].score >= 0.58)
            return scored[0].unitId;
    }
    const safe = escapeRegex(query);
    const normalized = normalizeSegment(query);
    const filters = [
        { normalizedName: normalized },
        { canonicalName: new RegExp(safe, 'i') },
        { pathText: new RegExp(safe, 'i') },
    ];
    if (item.parentId) {
        filters.unshift({ parentId: item.parentId, normalizedName: normalized });
        filters.unshift({ parentId: item.parentId, canonicalName: new RegExp(safe, 'i') });
    }
    const units = await OrgUnit.find({ $or: filters }).select('_id canonicalName normalizedName pathText').limit(20).lean();
    const scored = units
        .map((unit) => ({ unitId: String(unit._id), score: scoreUnitQuery(query, unit) }))
        .sort((a, b) => b.score - a.score);
    return scored[0] && scored[0].score >= 0.58 ? scored[0].unitId : undefined;
}
async function resolveCommanderFromNote(directives) {
    if (directives.commanderPersonalNumber)
        return directives.commanderPersonalNumber;
    const query = directives.commanderQuery?.trim();
    if (!query)
        return undefined;
    const personalNumber = query.match(/\b[cC]?\d{6,10}\b/)?.[0];
    if (personalNumber)
        return personalNumber;
    const safe = escapeRegex(query);
    const user = await User.findOne({
        $or: [
            { fullName: new RegExp(safe, 'i') },
            { firstName: new RegExp(safe, 'i') },
            { lastName: new RegExp(safe, 'i') },
        ],
    }).select('personalNumber').lean();
    return user?.personalNumber;
}
async function applyCommanderDirectiveToReview(item, commanderPersonalNumber) {
    if (item.changeType !== 'commander_change' || !commanderPersonalNumber)
        return;
    const user = await User.findOne({ personalNumber: commanderPersonalNumber })
        .select('personalNumber firstName lastName fullName rank role profileImageUrl')
        .lean();
    item.rawValue = commanderPersonalNumber;
    if (!item.commanderChange)
        return;
    item.commanderChange = {
        ...item.commanderChange,
        proposedCommander: user
            ? {
                personalNumber: user.personalNumber,
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: user.fullName,
                rank: user.rank,
                role: user.role,
                profileImageUrl: user.profileImageUrl,
                confidence: 1,
                reason: 'נבחר מהערת ביקורת',
            }
            : {
                personalNumber: commanderPersonalNumber,
                firstName: '',
                lastName: '',
                fullName: commanderPersonalNumber,
                confidence: 1,
                reason: 'נבחר מהערת ביקורת',
            },
    };
}
async function enrichChoiceCandidates(item) {
    const rawValue = String(item.rawValue || item.proposedAlias || item.conflict?.rawValue || '').trim();
    if (item.conflict?.candidates?.length) {
        const ids = item.conflict.candidates.map((candidate) => candidate.unitId);
        const units = await OrgUnit.find({ _id: { $in: ids } }).select('_id canonicalName pathText').lean();
        const byId = new Map(units.map((unit) => [String(unit._id), unit]));
        return {
            ...item,
            conflict: {
                ...item.conflict,
                candidates: item.conflict.candidates.map((candidate) => {
                    const unit = byId.get(candidate.unitId);
                    return {
                        ...candidate,
                        canonicalName: unit?.pathText || unit?.canonicalName || candidate.canonicalName,
                    };
                }),
            },
        };
    }
    if (!CHOICE_REVIEW_TYPES.has(item.changeType) || !rawValue)
        return item;
    let parentId = item.parentId;
    if (!parentId && item.targetUnitId) {
        const target = await OrgUnit.findById(item.targetUnitId).select('parentId').lean();
        parentId = target?.parentId;
    }
    const siblings = await OrgUnit.find(parentQuery(parentId)).select('_id canonicalName normalizedName pathText').lean();
    if (!siblings.length)
        return item;
    const normalized = normalizeSegment(rawValue);
    const targetId = item.targetUnitId ? String(item.targetUnitId) : undefined;
    const candidates = siblings
        .map((unit) => {
        const unitId = String(unit._id);
        const similarity = stringSimilarity(normalized, unit.normalizedName);
        const boostedConfidence = unitId === targetId ? Math.max(item.confidence ?? 0.7, similarity) : similarity;
        return {
            unitId,
            canonicalName: unit.pathText || unit.canonicalName,
            confidence: Math.max(0.01, Math.min(1, boostedConfidence)),
        };
    })
        .sort((a, b) => {
        if (a.unitId === targetId)
            return -1;
        if (b.unitId === targetId)
            return 1;
        return b.confidence - a.confidence;
    })
        .slice(0, 8);
    return {
        ...item,
        conflict: {
            rawValue,
            candidates,
        },
    };
}
async function forceSelectedLeafForUser(personalNumber, expectedUnitId, rawPath, changeSource) {
    const [user, targetUnit] = await Promise.all([
        User.findOne({ personalNumber }),
        OrgUnit.findById(expectedUnitId),
    ]);
    if (!user || !targetUnit)
        return null;
    const oldPathIds = user.currentOrgPathIds ?? [];
    const oldUnitId = user.currentOrgUnitId;
    const selectedPathIds = [...(targetUnit.pathIds ?? []), targetUnit._id];
    const selectedPathUnitsRaw = await OrgUnit.find({ _id: { $in: selectedPathIds } }).lean();
    const byId = new Map(selectedPathUnitsRaw.map((unit) => [String(unit._id), unit]));
    const selectedPathUnits = selectedPathIds.map((id) => byId.get(String(id))).filter(Boolean);
    const placement = await resolveSoldierPlacement({
        pathIds: selectedPathIds,
        pathUnits: selectedPathUnits,
        pathText: targetUnit.pathText,
        personalNumber,
        user: {
            fullName: user.fullName,
            role: user.role,
            rank: user.rank,
        },
    });
    const finalUnit = placement.pathUnits[placement.pathUnits.length - 1];
    if (!finalUnit)
        return null;
    const finalUnitIdText = String(finalUnit._id);
    if (String(user.currentOrgUnitId ?? '') === finalUnitIdText) {
        return { applied: false, reason: 'המשתמש כבר משויך ליחידה שנבחרה', pathText: user.currentOrgPathText };
    }
    await UserOrgHistory.create({
        personalNumber,
        fromOrgUnitId: oldUnitId,
        toOrgUnitId: finalUnit._id,
        fromPathIds: oldPathIds,
        toPathIds: placement.pathIds,
        rawPath,
        changeSource,
        confidence: 1,
        changedAt: new Date(),
    });
    user.currentOrgUnitId = finalUnit._id;
    user.currentOrgPathIds = placement.pathIds;
    user.currentOrgPathText = placement.pathText;
    user.lastSeenAt = new Date();
    await user.save();
    await syncStatsAfterUserMove(oldPathIds, placement.pathIds);
    return {
        applied: true,
        pathText: placement.pathText,
        unitId: finalUnitIdText,
        selectedUnitId: String(targetUnit._id),
        placementWarning: placement.warning,
    };
}
async function reingestAffectedUserIfNeeded(item, expectedUnitId) {
    if (!item.proposedBy || !USER_ROUTE_REVIEW_TYPES.has(item.changeType))
        return null;
    const user = await User.findOne({ personalNumber: item.proposedBy }).select('personalNumber').lean();
    if (!user)
        return null;
    try {
        const result = await reingestUser(item.proposedBy);
        const expectedInPath = expectedUnitId ? result.user.currentOrgPathIds.includes(expectedUnitId) : true;
        const forced = !expectedInPath && expectedUnitId
            ? await forceSelectedLeafForUser(item.proposedBy, expectedUnitId, item.rawValue || item.conflict?.rawValue || item.proposedAlias || '', 'human_review_force_selected_unit')
            : null;
        return {
            personalNumber: result.user.personalNumber,
            fullName: result.user.fullName,
            pathText: forced?.pathText || result.user.currentOrgPathText,
            reviewIds: result.reviewIds,
            expectedUnitApplied: expectedInPath || !!forced?.applied,
            forcedSelectedUnit: forced,
        };
    }
    catch (error) {
        return { error: String(error) };
    }
}
router.get('/', async (req, res) => {
    try {
        const status = req.query.status || 'needs_review';
        const items = await OrgChangeRequest.find({ status }).sort({ createdAt: -1 }).lean();
        const enriched = await Promise.all(items.map(async (item) => {
            let affectedUsersCount = 0;
            if (item.targetUnitId) {
                affectedUsersCount = await User.countDocuments({
                    currentOrgUnitId: item.targetUnitId,
                });
            }
            else if (item.parentId) {
                affectedUsersCount = await User.countDocuments({
                    currentOrgUnitId: item.parentId,
                });
            }
            return enrichChoiceCandidates({ ...item, affectedUsersCount });
        }));
        res.json(enriched);
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});
router.post('/:id/approve', async (req, res) => {
    try {
        const item = await OrgChangeRequest.findById(req.params.id);
        if (!item) {
            res.status(404).json({ error: 'Review not found' });
            return;
        }
        if (item.status !== 'needs_review') {
            res.status(400).json({ error: 'Already reviewed' });
            return;
        }
        const note = requestNote(req.body ?? {});
        const noteDirectives = parseReviewNoteDirectives(note);
        const commanderFromNote = await resolveCommanderFromNote(noteDirectives);
        if (commanderFromNote)
            noteDirectives.commanderPersonalNumber = commanderFromNote;
        await applyCommanderDirectiveToReview(item, noteDirectives.commanderPersonalNumber);
        const selectedUnitFromNote = await resolveSelectedUnitFromNote(item, noteDirectives);
        const createNew = req.body.resolution === 'create_new' || req.body.createNew === true || (noteDirectives.createNew && !selectedUnitFromNote);
        const selectedUnitId = createNew
            ? undefined
            : selectedUnitFromNote ||
                req.body.selectedUnitId ||
                (item.changeType === 'conflict_match' ? item.conflict?.candidates?.[0]?.unitId : undefined) ||
                (item.targetUnitId ? String(item.targetUnitId) : undefined);
        const { aliasAdded, aliasValue, aliasAlreadyExisted, targetUnitId, targetCanonicalName, createdNew, } = await applyReviewApproval(item, selectedUnitId, { createNew, noteDirectives });
        item.status = 'approved';
        item.reviewedAt = new Date();
        item.reviewedBy = req.body.reviewedBy || 'admin';
        item.reviewNote = note;
        await item.save();
        const reingestedUser = await reingestAffectedUserIfNeeded(item, targetUnitId);
        await logDecision({
            decisionType: 'human_review',
            rawValue: item.rawValue || item.proposedAlias || '',
            normalizedRawValue: normalizeSegment(item.rawValue || item.proposedAlias || ''),
            matchedUnitId: item.selectedUnitId || item.targetUnitId,
            matchedCanonicalName: targetCanonicalName || item.targetCanonicalName,
            confidence: 1,
            action: createdNew ? 'admin_created_new_unit' : 'admin_approved',
            reason: `אושר על ידי ${item.reviewedBy}${item.reviewNote ? `: ${item.reviewNote}` : ''}${createdNew ? ' · יחידה חדשה נוצרה' : aliasAdded ? ' · כינוי נוסף לעץ' : aliasAlreadyExisted ? ' · הכינוי כבר היה קיים' : ''}${reingestedUser && !('error' in reingestedUser) ? ' · המשתמש עודכן בפועל' : ''}`,
            signals: {
                reviewId: String(item._id),
                changeType: item.changeType,
                aliasAdded,
                aliasValue,
                aliasAlreadyExisted,
                targetUnitId,
                selectedUnitFromNote,
                createdNew,
                reingestedUser,
                noteActions: noteDirectives.actions,
            },
            personalNumber: item.proposedBy,
        });
        res.json({
            ...item.toObject(),
            aliasAdded,
            aliasValue,
            aliasAlreadyExisted,
            targetUnitId,
            targetCanonicalName,
            createdNew,
            reingestedUser,
            noteActions: noteDirectives.actions,
        });
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});
router.post('/:id/reject', async (req, res) => {
    try {
        const item = await OrgChangeRequest.findById(req.params.id);
        if (!item) {
            res.status(404).json({ error: 'Review not found' });
            return;
        }
        item.status = 'rejected';
        item.reviewedAt = new Date();
        item.reviewedBy = req.body.reviewedBy || 'admin';
        item.reviewNote = requestNote(req.body ?? {});
        await item.save();
        if (item.changeType === 'commander_change' && item.targetUnitId) {
            await rejectCommanderChange(item.targetUnitId, item.commanderChange?.proposedCommander.personalNumber || item.rawValue);
        }
        await logDecision({
            decisionType: 'human_review',
            rawValue: item.rawValue || item.proposedAlias || '',
            normalizedRawValue: normalizeSegment(item.rawValue || item.proposedAlias || ''),
            confidence: 0,
            action: 'admin_rejected',
            reason: `נדחה על ידי ${item.reviewedBy}${item.reviewNote ? `: ${item.reviewNote}` : ''}`,
            signals: { reviewId: String(item._id), changeType: item.changeType },
            personalNumber: item.proposedBy,
        });
        res.json(item);
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

module.exports = router;
