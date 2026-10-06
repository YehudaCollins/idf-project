const mongoose = require('mongoose');
const { OrgUnit } = require('../../models/index');
const { normalizeSegment } = require('../parser/normalizer');
const { stringSimilarity } = require('../parser/fuzzy');
const { refreshUnitPathTextsAndUsers } = require('../org/pathMaintenance');
const { approveCommanderChange } = require('../org/commanderReview');
const UNIT_TYPES_BY_LEVEL = ['מפקדה', 'אגף', 'ענף', 'מדור', 'מחלקה', 'צוות', 'תת-יחידה'];
function inferUnitType(level) {
    return UNIT_TYPES_BY_LEVEL[Math.min(level, UNIT_TYPES_BY_LEVEL.length - 1)] ?? 'unknown';
}
function reviewRawSegments(item, directives) {
    const raw = reviewRawValue(item, directives);
    return raw
        .split(/[\\/]+/)
        .map((part) => part.trim())
        .filter(Boolean);
}
function reviewRawValue(item, directives) {
    return directives?.aliasValue || item.rawValue || item.conflict?.rawValue || item.proposedAlias || item.targetCanonicalName || '';
}
async function createUnitUnderParent(displayName, parentId) {
    const normalizedName = normalizeSegment(displayName);
    const parent = parentId ? await OrgUnit.findById(parentId) : null;
    const duplicateQuery = parentId
        ? { parentId, normalizedName }
        : { $or: [{ parentId: null }, { parentId: { $exists: false } }], normalizedName };
    const existing = await OrgUnit.findOne(duplicateQuery);
    if (existing)
        return existing;
    const pathIds = parent ? [...parent.pathIds, parent._id] : [];
    const level = parent ? parent.level + 1 : 0;
    const pathText = parent ? `${parent.pathText}/${displayName}` : displayName;
    return OrgUnit.create({
        canonicalName: displayName,
        normalizedName,
        parentId: parentId || undefined,
        pathIds,
        pathText,
        level,
        type: inferUnitType(level),
        aliases: [],
        isVerified: true,
        verificationStatus: 'מאומת ידנית',
        stats: { userCount: 0, aliasCount: 0, loginCount: 0 },
    });
}
async function createNewUnitFromReview(item, directives) {
    const segments = directives?.canonicalName
        ? directives.canonicalName.split(/[\\/]+/).map((part) => part.trim()).filter(Boolean)
        : reviewRawSegments(item, directives);
    if (!segments.length) {
        throw new Error('אין ערך גולמי שממנו ניתן ליצור יחידה חדשה');
    }
    let parentId = item.parentId ? new mongoose.Types.ObjectId(String(item.parentId)) : null;
    let created = null;
    for (const segment of segments) {
        created = await createUnitUnderParent(segment, parentId);
        parentId = created._id;
    }
    if (!created) {
        throw new Error('לא נוצרה יחידה חדשה');
    }
    item.selectedUnitId = created._id;
    item.targetCanonicalName = created.canonicalName;
    return created;
}
async function applyStructureUpdate(item, directives) {
    if (!item.targetUnitId) {
        throw new Error('חסר יעד לעדכון מבנה');
    }
    const unit = await OrgUnit.findById(item.targetUnitId);
    if (!unit) {
        throw new Error('יחידת היעד לא נמצאה');
    }
    const canonicalName = String(directives?.canonicalName || item.rawValue || item.targetCanonicalName || unit.canonicalName).trim();
    if (!canonicalName) {
        throw new Error('שם יחידה ריק');
    }
    unit.canonicalName = canonicalName;
    unit.normalizedName = normalizeSegment(canonicalName);
    if (directives?.unitType?.trim() || item.proposedType?.trim()) {
        unit.type = (directives?.unitType || item.proposedType || '').trim();
    }
    unit.isVerified = true;
    unit.verificationStatus = 'מאומת ידנית';
    await unit.save();
    await refreshUnitPathTextsAndUsers(unit._id);
    item.selectedUnitId = unit._id;
    item.targetCanonicalName = unit.canonicalName;
    return unit;
}
async function applyStructureCreate(item, directives) {
    const canonicalName = String(directives?.canonicalName || item.rawValue || item.targetCanonicalName || '').trim();
    if (!canonicalName) {
        throw new Error('שם יחידה ריק');
    }
    const parentId = item.parentId ? new mongoose.Types.ObjectId(String(item.parentId)) : null;
    const unit = await createUnitUnderParent(canonicalName, parentId);
    if (directives?.unitType?.trim() || item.proposedType?.trim()) {
        unit.type = (directives?.unitType || item.proposedType || '').trim();
        await unit.save();
    }
    item.selectedUnitId = unit._id;
    item.targetCanonicalName = unit.canonicalName;
    return unit;
}
async function addAliasToUnit(unitId, aliasValue, confidence, source = 'admin_approved') {
    const unit = await OrgUnit.findById(unitId);
    if (!unit || !aliasValue.trim())
        return { added: false };
    const norm = normalizeSegment(aliasValue);
    const trimmed = aliasValue.trim();
    if (unit.normalizedName === norm) {
        return {
            added: false,
            value: unit.canonicalName,
            alreadyExisted: true,
            targetCanonicalName: unit.canonicalName,
        };
    }
    const activeAlias = unit.aliases.find((a) => a.normalizedValue === norm && a.status === 'active');
    if (activeAlias) {
        return {
            added: false,
            value: activeAlias.value,
            alreadyExisted: true,
            targetCanonicalName: unit.canonicalName,
        };
    }
    unit.aliases.push({
        value: trimmed,
        normalizedValue: norm,
        confidence,
        seenCount: 1,
        scope: 'parent',
        source,
        status: 'active',
    });
    unit.stats.aliasCount = unit.aliases.filter((a) => a.status === 'active').length;
    await unit.save();
    return { added: true, value: trimmed, targetCanonicalName: unit.canonicalName };
}
async function selectedPathUnits(unitId) {
    const leaf = await OrgUnit.findById(unitId).lean();
    if (!leaf)
        throw new Error('יחידת היעד שנבחרה לא נמצאה');
    const ids = [...(leaf.pathIds ?? []), leaf._id];
    const units = await OrgUnit.find({ _id: { $in: ids } }).lean();
    const byId = new Map(units.map((unit) => [String(unit._id), unit]));
    return ids.map((id) => byId.get(String(id))).filter(Boolean);
}
function scoreAliasAgainstUnit(unit, normalized) {
    if (unit.normalizedName === normalized)
        return 1;
    const alias = unit.aliases?.find((a) => a.status === 'active' && a.normalizedValue === normalized);
    if (alias)
        return alias.confidence ?? 1;
    return stringSimilarity(normalized, unit.normalizedName);
}
async function addReviewAliasesToSelectedUnit(item, selectedUnitId, confidence, directives) {
    const segments = reviewRawSegments(item, directives);
    if (segments.length <= 1) {
        const primary = await addAliasToUnit(selectedUnitId, reviewRawValue(item, directives), confidence);
        for (const alias of directives?.extraAliases ?? []) {
            await addAliasToUnit(selectedUnitId, alias, confidence);
        }
        return primary;
    }
    const pathUnits = await selectedPathUnits(selectedUnitId);
    let cursor = 0;
    let added = false;
    let alreadyExisted = false;
    let firstValue;
    for (const segment of segments) {
        const normalized = normalizeSegment(segment);
        let bestIndex = -1;
        let bestScore = 0;
        for (let i = cursor; i < pathUnits.length; i++) {
            const pathUnit = pathUnits[i];
            if (!pathUnit)
                continue;
            const score = scoreAliasAgainstUnit(pathUnit, normalized);
            if (score > bestScore) {
                bestScore = score;
                bestIndex = i;
            }
            if (score === 1)
                break;
        }
        if (bestIndex < 0 || bestScore < 0.45)
            continue;
        const unit = pathUnits[bestIndex];
        if (!unit)
            continue;
        const result = await addAliasToUnit(unit._id, segment, confidence);
        added = added || result.added;
        alreadyExisted = alreadyExisted || !!result.alreadyExisted;
        firstValue = firstValue ?? result.value ?? segment;
        cursor = bestIndex + 1;
    }
    if (!firstValue && segments.length > 0) {
        const result = await addAliasToUnit(selectedUnitId, segments[segments.length - 1], confidence);
        added = result.added;
        alreadyExisted = !!result.alreadyExisted;
        firstValue = result.value;
    }
    const leaf = pathUnits[pathUnits.length - 1];
    for (const alias of directives?.extraAliases ?? []) {
        const result = await addAliasToUnit(selectedUnitId, alias, confidence);
        added = added || result.added;
        alreadyExisted = alreadyExisted || !!result.alreadyExisted;
        firstValue = firstValue ?? result.value ?? alias;
    }
    return {
        added,
        value: firstValue,
        alreadyExisted: alreadyExisted && !added,
        targetCanonicalName: leaf?.canonicalName,
    };
}
/** מיישם למידה מביקורת שאושרה — כינוי פעיל לעתיד ingest */
async function applyReviewApproval(item, selectedUnitId, options) {
    let aliasAdded = false;
    let aliasValue;
    let aliasAlreadyExisted = false;
    let targetUnitId;
    const directives = options?.noteDirectives;
    if (options?.createNew) {
        const unit = await createNewUnitFromReview(item, directives);
        return {
            aliasAdded: false,
            targetUnitId: String(unit._id),
            targetCanonicalName: unit.canonicalName,
            createdNew: true,
        };
    }
    if (item.changeType === 'structure_update') {
        const unit = await applyStructureUpdate(item, directives);
        return {
            aliasAdded: false,
            targetUnitId: String(unit._id),
            targetCanonicalName: unit.canonicalName,
        };
    }
    if (item.changeType === 'structure_create') {
        const unit = await applyStructureCreate(item, directives);
        return {
            aliasAdded: false,
            targetUnitId: String(unit._id),
            targetCanonicalName: unit.canonicalName,
            createdNew: true,
        };
    }
    if (item.changeType === 'commander_change') {
        const commanderPersonalNumber = directives?.commanderPersonalNumber || item.commanderChange?.proposedCommander.personalNumber || item.rawValue;
        if (!item.targetUnitId || !commanderPersonalNumber) {
            throw new Error('חסר יעד או מפקד מוצע לאישור');
        }
        const unit = await approveCommanderChange(item.targetUnitId, commanderPersonalNumber);
        item.selectedUnitId = unit._id;
        item.targetCanonicalName = unit.canonicalName;
        return {
            aliasAdded: false,
            targetUnitId: String(unit._id),
            targetCanonicalName: unit.canonicalName,
        };
    }
    if (item.changeType === 'conflict_match' && item.conflict?.candidates?.length) {
        const winnerId = selectedUnitId || item.conflict.candidates[0].unitId;
        const aliasResult = await addReviewAliasesToSelectedUnit(item, winnerId, 1, directives);
        aliasAdded = aliasResult.added;
        aliasValue = aliasResult.value;
        aliasAlreadyExisted = !!aliasResult.alreadyExisted;
        targetUnitId = winnerId;
        item.selectedUnitId = new mongoose.Types.ObjectId(winnerId);
        const selectedUnit = await OrgUnit.findById(winnerId).select('canonicalName pathText').lean();
        const selectedCandidate = item.conflict.candidates.find((c) => c.unitId === winnerId);
        item.targetCanonicalName = selectedUnit?.canonicalName || selectedCandidate?.canonicalName || item.targetCanonicalName;
        return {
            aliasAdded,
            aliasValue,
            aliasAlreadyExisted,
            targetUnitId,
            targetCanonicalName: selectedUnit?.pathText || selectedUnit?.canonicalName || selectedCandidate?.canonicalName,
        };
    }
    const requestedAliasValue = directives?.aliasValue || item.proposedAlias || item.rawValue;
    const unitId = selectedUnitId || (item.targetUnitId ? String(item.targetUnitId) : undefined);
    if (unitId && requestedAliasValue) {
        const unit = await OrgUnit.findById(unitId);
        if (!unit) {
            throw new Error('יחידת היעד שנבחרה לא נמצאה');
        }
        const aliasResult = await addReviewAliasesToSelectedUnit(item, unitId, 1, directives);
        aliasAdded = aliasResult.added;
        aliasAlreadyExisted = !!aliasResult.alreadyExisted;
        targetUnitId = unitId;
        const storedAliasValue = aliasResult.value ?? requestedAliasValue;
        item.selectedUnitId = new mongoose.Types.ObjectId(unitId);
        item.targetCanonicalName = unit.canonicalName;
        return { aliasAdded, aliasValue: storedAliasValue, aliasAlreadyExisted, targetUnitId, targetCanonicalName: unit.canonicalName };
    }
    return { aliasAdded, targetUnitId, targetCanonicalName: item.targetCanonicalName };
}

module.exports = { addAliasToUnit, applyReviewApproval };
