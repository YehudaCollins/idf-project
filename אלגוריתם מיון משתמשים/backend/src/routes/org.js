const { Router } = require('express');
const mongoose = require('mongoose');
const { OrgUnit, User, AiDecisionLog, OrgChangeRequest } = require('../models/index');
const { normalizeSegment } = require('../modules/parser/normalizer');
const { isPersonalIdentifierSegment } = require('../modules/parser/pathParser');
const { createReview } = require('../modules/reviews/createReview');
const { repairOrphanRoots } = require('../modules/org/repairOrphanRoots');
const { actorUser, isAdmin, resolveActor } = require('../modules/auth/demoAuth');
const { detectUnitCommander, sortUsersForUnitDisplay, } = require('../modules/org/commanderDetection');
const { allowsDirectSoldiers } = require('../modules/org/orgUnitRules');
const router = Router();
async function structurePermission(actor, targetUnit) {
    if (isAdmin(actor))
        return { canEdit: true, reason: 'מנהל מערכת' };
    const user = await actorUser(actor);
    if (!user?.currentOrgUnitId)
        return { canEdit: false, reason: 'המשתמש אינו משויך ליחידה' };
    const commandUnitId = String(user.currentOrgUnitId);
    const commandUnit = await OrgUnit.findById(user.currentOrgUnitId).select('commanderPersonalNumber').lean();
    if (commandUnit?.commanderPersonalNumber) {
        if (commandUnit.commanderPersonalNumber !== actor.personalNumber) {
            return { canEdit: false, reason: 'רק מפקד יחידה יכול לערוך מבנה' };
        }
    }
    else {
        const usersInCommandUnit = await User.find({ currentOrgUnitId: user.currentOrgUnitId })
            .select('personalNumber firstName lastName fullName rank role profileImageUrl currentOrgUnitId')
            .lean();
        const usersForCommanderDetection = usersInCommandUnit.map((candidate) => (candidate.personalNumber === actor.personalNumber
            ? {
                ...candidate,
                rank: candidate.rank || actor.rank,
                role: candidate.role || actor.role,
            }
            : candidate));
        const commander = detectUnitCommander(usersForCommanderDetection);
        if (commander?.personalNumber !== actor.personalNumber) {
            return { canEdit: false, reason: 'רק מפקד יחידה יכול לערוך מבנה' };
        }
    }
    const targetId = String(targetUnit._id);
    const pathIds = (targetUnit.pathIds ?? []).map(String);
    const inScope = targetId === commandUnitId || pathIds.includes(commandUnitId);
    return {
        canEdit: inScope,
        reason: inScope ? 'מפקד היחידה' : 'אפשר לערוך רק את היחידה שלך ומה שתחתיה',
    };
}
async function structureReviewReasons(parentId, name, currentUnitId) {
    const reasons = [];
    const canonicalName = name.trim();
    const normalizedName = normalizeSegment(canonicalName);
    if (canonicalName.length < 2)
        reasons.push('שם קצר מדי');
    if (isPersonalIdentifierSegment(canonicalName))
        reasons.push('שם היחידה נראה כמו מספר אישי');
    const duplicate = await OrgUnit.findOne({
        parentId,
        normalizedName,
        ...(currentUnitId ? { _id: { $ne: currentUnitId } } : {}),
    }).lean();
    if (duplicate)
        reasons.push(`כבר קיימת יחידה דומה: ${duplicate.canonicalName}`);
    return reasons;
}
function buildReviewIndex(reviews) {
    const counts = new Map();
    const bump = (id) => {
        if (!id)
            return;
        counts.set(id, (counts.get(id) ?? 0) + 1);
    };
    for (const r of reviews) {
        bump(r.parentId ? String(r.parentId) : undefined);
        bump(r.targetUnitId ? String(r.targetUnitId) : undefined);
        for (const c of r.conflict?.candidates ?? [])
            bump(c.unitId);
    }
    return counts;
}
function buildTree(unitsByParent, reviewCounts, commandersByUnitId, directUserCounts, parentId = null, showManagementData = true) {
    return (unitsByParent.get(parentId ?? 'root') ?? [])
        .map((u) => {
        const id = String(u._id);
        const stats = (u.stats ?? {});
        return withDataQuality({
            ...u,
            stats: {
                ...stats,
                userCount: showManagementData ? directUserCounts.get(id) ?? 0 : 0,
            },
            pendingReviews: showManagementData ? reviewCounts.get(id) ?? 0 : 0,
            commander: commandersByUnitId.get(id) ?? null,
            children: buildTree(unitsByParent, reviewCounts, commandersByUnitId, directUserCounts, id, showManagementData),
        });
    });
}
function buildUnitsByParent(units) {
    const byParent = new Map();
    for (const unit of units) {
        const key = unit.parentId ? String(unit.parentId) : 'root';
        const list = byParent.get(key) ?? [];
        list.push(unit);
        byParent.set(key, list);
    }
    return byParent;
}
function commanderFromUser(user, reason, confidence = 1) {
    return {
        personalNumber: user.personalNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        rank: user.rank,
        role: user.role,
        profileImageUrl: user.profileImageUrl,
        confidence,
        reason,
    };
}
function commanderReason(status) {
    if (status === 'pending_review')
        return 'מפקד מאושר · יש הצעה חדשה בביקורת';
    if (status === 'approved')
        return 'מפקד מאושר בביקורת';
    return 'מפקד שמור במערכת';
}
function buildCommandersByUnitId(users, units) {
    const usersByUnitId = new Map();
    const usersByPersonalNumber = new Map();
    for (const user of users) {
        usersByPersonalNumber.set(user.personalNumber, user);
        if (!user.currentOrgUnitId)
            continue;
        const key = String(user.currentOrgUnitId);
        const list = usersByUnitId.get(key) ?? [];
        list.push(user);
        usersByUnitId.set(key, list);
    }
    const commanders = new Map();
    for (const [unitId, unitUsers] of usersByUnitId) {
        commanders.set(unitId, detectUnitCommander(unitUsers));
    }
    for (const unit of units) {
        if (!unit.commanderPersonalNumber)
            continue;
        const unitId = String(unit._id);
        const commanderUser = usersByPersonalNumber.get(unit.commanderPersonalNumber);
        if (commanderUser && String(commanderUser.currentOrgUnitId) === unitId) {
            commanders.set(unitId, commanderFromUser(commanderUser, commanderReason(unit.commanderStatus), unit.commanderStatus === 'approved' ? 1 : 0.95));
        }
    }
    return commanders;
}
function buildDirectSoldierCounts(users, units, unitsByParent) {
    const unitsById = new Map(units.map((unit) => [String(unit._id), unit]));
    const counts = new Map();
    for (const user of users) {
        if (!user.currentOrgUnitId)
            continue;
        const key = String(user.currentOrgUnitId);
        const unit = unitsById.get(key);
        if (!unit)
            continue;
        const hasChildren = (unitsByParent.get(key)?.length ?? 0) > 0;
        if (!allowsDirectSoldiers(unit, hasChildren))
            continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
}
async function buildActorTreeScope(actor, units) {
    if (isAdmin(actor))
        return null;
    const user = await actorUser(actor);
    if (!user?.currentOrgUnitId) {
        return { scopeUnitIds: [], scopePathIds: [] };
    }
    const focusUnitId = String(user.currentOrgUnitId);
    const scopeUnitIds = units
        .filter((unit) => {
        const unitId = String(unit._id);
        const pathIds = (unit.pathIds ?? []).map(String);
        return unitId === focusUnitId || pathIds.includes(focusUnitId);
    })
        .map((unit) => String(unit._id));
    return {
        focusUnitId,
        scopeUnitIds,
        scopePathIds: user.currentOrgPathIds.map(String),
    };
}
function withDirectUserCount(unit, directUserCounts) {
    const stats = (unit.stats ?? {});
    return withDataQuality({
        ...unit,
        stats: {
            ...stats,
            userCount: directUserCounts.get(String(unit._id)) ?? 0,
        },
    });
}
function withDataQuality(unit) {
    const name = String(unit.canonicalName ?? unit.normalizedName ?? '');
    const reasons = [];
    if (isPersonalIdentifierSegment(name)) {
        reasons.push('שם היחידה נראה כמו מספר אישי');
    }
    if (name.includes('\n')) {
        reasons.push('שם היחידה מכיל מעבר שורה');
    }
    if (!reasons.length)
        return unit;
    return {
        ...unit,
        dataQuality: {
            suspicious: true,
            reasons,
        },
    };
}
function countDescendants(node) {
    const kids = (node.children ?? []);
    return kids.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
}
/** מיזוג שורשים יתומים לעץ אחד — מונע תצוגה של "יער" מנותק */
function normalizeTreeRoots(tree) {
    if (tree.length <= 1)
        return { tree, orphanRootCount: 0 };
    const ranked = [...tree].sort((a, b) => {
        const score = (n) => countDescendants(n) +
            (n.isVerified ? 10_000 : 0) +
            (String(n.canonicalName ?? '').includes('(דמו)') ? 5_000 : 0);
        return score(b) - score(a);
    });
    const [primary, ...orphans] = ranked;
    const primaryChildren = primary.children ?? [];
    const mergedOrphans = orphans.map((orphan) => ({
        ...orphan,
        detachedRoot: true,
    }));
    return {
        tree: [{ ...primary, children: [...primaryChildren, ...mergedOrphans] }],
        orphanRootCount: orphans.length,
    };
}
router.get('/tree', async (req, res) => {
    try {
        const actor = await resolveActor(req);
        const showManagementData = isAdmin(actor);
        const [units, users, pendingReviews] = await Promise.all([
            OrgUnit.find().lean(),
            User.find().select('personalNumber firstName lastName fullName rank role profileImageUrl currentOrgUnitId').lean(),
            OrgChangeRequest.find({ status: 'needs_review' }).lean(),
        ]);
        const reviewCounts = buildReviewIndex(pendingReviews);
        const unitsByParent = buildUnitsByParent(units);
        const commandersByUnitId = buildCommandersByUnitId(users, units);
        const directUserCounts = buildDirectSoldierCounts(users, units, unitsByParent);
        const rawTree = buildTree(unitsByParent, reviewCounts, commandersByUnitId, directUserCounts, null, showManagementData);
        const viewScope = await buildActorTreeScope(actor, units);
        const { tree, orphanRootCount } = normalizeTreeRoots(rawTree);
        res.json({
            tree,
            total: units.length,
            pendingReviewCount: showManagementData ? pendingReviews.length : 0,
            orphanRootCount: showManagementData ? orphanRootCount : 0,
            viewScope,
        });
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});
router.get('/units/:id', async (req, res) => {
    try {
        const actor = await resolveActor(req);
        const id = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ error: 'Invalid id' });
            return;
        }
        const unit = await OrgUnit.findById(id).lean();
        if (!unit) {
            res.status(404).json({ error: 'Unit not found' });
            return;
        }
        const [childrenRaw, usersRaw] = await Promise.all([
            OrgUnit.find({ parentId: id }).lean(),
            User.find({ currentOrgUnitId: id }).select('-__v').lean(),
        ]);
        const childIds = childrenRaw.map((child) => child._id);
        const [childUserCounts, childChildrenCounts] = childIds.length
            ? await Promise.all([
                User.aggregate([
                    { $match: { currentOrgUnitId: { $in: childIds } } },
                    { $group: { _id: '$currentOrgUnitId', count: { $sum: 1 } } },
                ]),
                OrgUnit.aggregate([
                    { $match: { parentId: { $in: childIds } } },
                    { $group: { _id: '$parentId', count: { $sum: 1 } } },
                ]),
            ])
            : [[], []];
        const users = usersRaw;
        const usersForCommanderDetection = users.map((candidate) => (candidate.personalNumber === actor.personalNumber
            ? {
                ...candidate,
                rank: candidate.rank || actor.rank,
                role: candidate.role || actor.role,
            }
            : candidate));
        const detectedCommander = detectUnitCommander(usersForCommanderDetection);
        const storedCommander = unit.commanderPersonalNumber
            ? users.find((candidate) => candidate.personalNumber === unit.commanderPersonalNumber)
            : undefined;
        const commander = storedCommander
            ? commanderFromUser(storedCommander, commanderReason(unit.commanderStatus), unit.commanderStatus === 'approved' ? 1 : 0.95)
            : detectedCommander;
        const sortedUsers = sortUsersForUnitDisplay(users, commander);
        const unitAllowsSoldiers = allowsDirectSoldiers(unit, childrenRaw.length > 0);
        const visibleUsers = unitAllowsSoldiers
            ? sortedUsers
            : commander
                ? sortedUsers.filter((candidate) => candidate.personalNumber === commander.personalNumber)
                : [];
        const childChildrenCountById = new Map(childChildrenCounts.map(({ _id, count }) => [String(_id), count]));
        const childrenById = new Map(childrenRaw.map((child) => [String(child._id), child]));
        const directUserCounts = new Map([
            [id, unitAllowsSoldiers ? users.length : 0],
            ...childUserCounts.map(({ _id, count }) => {
                const childId = String(_id);
                const child = childrenById.get(childId);
                const childAllowsSoldiers = child
                    ? allowsDirectSoldiers(child, (childChildrenCountById.get(childId) ?? 0) > 0)
                    : false;
                return [childId, childAllowsSoldiers ? count : 0];
            }),
        ]);
        const showManagementData = isAdmin(actor);
        const sanitizedDirectUserCounts = showManagementData ? directUserCounts : new Map();
        const children = childrenRaw.map((child) => withDirectUserCount(child, sanitizedDirectUserCounts));
        const unitWithDirectCount = withDirectUserCount(unit, sanitizedDirectUserCounts);
        const permissions = await structurePermission(actor, unit);
        const parent = unit.parentId ? await OrgUnit.findById(unit.parentId).lean() : null;
        const decisions = await AiDecisionLog.find({
            $or: [{ matchedUnitId: id }, { parentId: id }],
        })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();
        const reviews = await OrgChangeRequest.find({
            $or: [{ targetUnitId: id }, { parentId: id }],
            status: 'needs_review',
        }).lean();
        res.json({
            unit: unitWithDirectCount,
            parent,
            children,
            users: isAdmin(actor) ? visibleUsers : [],
            commander,
            decisions: isAdmin(actor) ? decisions : [],
            reviews: isAdmin(actor) ? reviews : [],
            permissions: {
                actorRole: actor.accessRole,
                canViewUsers: isAdmin(actor),
                canEditStructure: permissions.canEdit,
                reason: permissions.reason,
            },
        });
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});
router.patch('/units/:id', async (req, res) => {
    try {
        const actor = await resolveActor(req);
        const id = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ error: 'Invalid id' });
            return;
        }
        const unit = await OrgUnit.findById(id);
        if (!unit) {
            res.status(404).json({ error: 'Unit not found' });
            return;
        }
        const permission = await structurePermission(actor, unit);
        if (!permission.canEdit) {
            res.status(403).json({ error: permission.reason });
            return;
        }
        const canonicalName = String(req.body?.canonicalName ?? unit.canonicalName).trim();
        const type = String(req.body?.type ?? unit.type ?? 'unknown').trim() || 'unknown';
        const reasons = await structureReviewReasons(unit.parentId, canonicalName, id);
        const review = await createReview({
            changeType: 'structure_update',
            targetUnitId: unit._id,
            targetCanonicalName: unit.canonicalName,
            proposedType: type,
            rawValue: canonicalName,
            parentId: unit.parentId,
            reason: reasons.length
                ? `AI סימן שינוי מבנה לבדיקה: ${reasons.join(' · ')}`
                : 'עדכון מבנה נשלח לבדיקת AI לפני החלה בעץ',
            proposedBy: actor.personalNumber,
            confidence: reasons.length ? 0.45 : 0.9,
        });
        res.status(202).json({ status: 'needs_review', review, reasons });
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});
router.post('/units/:id/children', async (req, res) => {
    try {
        const actor = await resolveActor(req);
        const id = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ error: 'Invalid id' });
            return;
        }
        const parent = await OrgUnit.findById(id);
        if (!parent) {
            res.status(404).json({ error: 'Unit not found' });
            return;
        }
        const permission = await structurePermission(actor, parent);
        if (!permission.canEdit) {
            res.status(403).json({ error: permission.reason });
            return;
        }
        const canonicalName = String(req.body?.canonicalName ?? '').trim();
        if (!canonicalName) {
            res.status(400).json({ error: 'canonicalName required' });
            return;
        }
        const reasons = await structureReviewReasons(parent._id, canonicalName);
        const type = String(req.body?.type ?? 'unknown').trim() || 'unknown';
        const review = await createReview({
            changeType: 'structure_create',
            targetCanonicalName: canonicalName,
            proposedType: type,
            rawValue: canonicalName,
            parentId: parent._id,
            reason: reasons.length
                ? `AI סימן יחידה חדשה לבדיקה: ${reasons.join(' · ')}`
                : 'יחידה חדשה נשלחה לבדיקת AI לפני החלה בעץ',
            proposedBy: actor.personalNumber,
            confidence: reasons.length ? 0.45 : 0.9,
        });
        res.status(202).json({ status: 'needs_review', review, reasons });
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});
router.post('/units/:id/propose-alias', async (req, res) => {
    try {
        const actor = await resolveActor(req);
        const id = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ error: 'Invalid id' });
            return;
        }
        const { aliasValue, proposedBy } = req.body;
        if (!aliasValue?.trim()) {
            res.status(400).json({ error: 'aliasValue required' });
            return;
        }
        const unit = await OrgUnit.findById(id);
        if (!unit) {
            res.status(404).json({ error: 'Unit not found' });
            return;
        }
        const trimmedAlias = aliasValue.trim();
        const norm = normalizeSegment(trimmedAlias);
        const exists = unit.aliases.some((a) => a.normalizedValue === norm && a.value.trim() === trimmedAlias && a.status === 'active');
        if (exists) {
            res.status(409).json({ error: 'Alias already exists on unit' });
            return;
        }
        const review = await createReview({
            changeType: 'alias_proposal',
            targetUnitId: unit._id,
            targetCanonicalName: unit.canonicalName,
            proposedAlias: trimmedAlias,
            rawValue: trimmedAlias,
            parentId: unit.parentId,
            reason: `הצעת כינוי ידנית ל"${unit.canonicalName}"`,
            proposedBy: proposedBy || actor.personalNumber,
            confidence: 1,
        });
        res.status(201).json(review);
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});
/** מחבר שורשים יתומים לשורש הראשי במסד */
router.post('/repair-orphans', async (req, res) => {
    try {
        const actor = await resolveActor(req);
        if (!isAdmin(actor)) {
            res.status(403).json({ error: 'רק מנהל יכול לתקן שורשים מנותקים' });
            return;
        }
        const result = await repairOrphanRoots();
        res.json({ ok: true, ...result });
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

module.exports = router;
