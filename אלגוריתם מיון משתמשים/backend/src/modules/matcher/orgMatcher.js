const { OrgUnit } = require('../../models/index');
const { normalizeSegment } = require('../parser/normalizer');
const { isPersonalIdentifierSegment } = require('../parser/pathParser');
const { stringSimilarity, computeConfidence } = require('../parser/fuzzy');
const { logDecision } = require('../ai-decisions/logDecision');
const { createReview } = require('../reviews/createReview');
const { explainDecision } = require('../ai/explainDecision');
const { trySemanticMatch } = require('../ai/semanticMatch');
const { trackPromotion, getPromotionCount } = require('./promotionTracker');
const FUZZY_HIGH = 0.95;
const FUZZY_MED = 0.85;
const CONTEXTUAL_FUZZY_MIN = 0.68;
const CONTEXTUAL_PATH_MIN = 0.86;
const ALIAS_PROMOTE_COUNT = 3;
const UNIT_TYPES_BY_LEVEL = ['מפקדה', 'אגף', 'ענף', 'מדור', 'מחלקה', 'צוות', 'תת-יחידה'];
function inferUnitType(level) {
    return UNIT_TYPES_BY_LEVEL[Math.min(level, UNIT_TYPES_BY_LEVEL.length - 1)] ?? 'unknown';
}
async function applySemanticMatch(rawSegment, normalized, parentId, personalNumber, fuzzyCandidates, minConfidence) {
    if (fuzzyCandidates.length === 0)
        return null;
    const semantic = await trySemanticMatch(rawSegment, parentId, fuzzyCandidates.map((c) => ({
        unitId: String(c.unit._id),
        canonicalName: c.unit.canonicalName,
        score: c.confidence,
    })));
    if (!semantic || semantic.confidence < minConfidence)
        return null;
    const hit = fuzzyCandidates.find((c) => String(c.unit._id) === semantic.selectedUnitId);
    if (!hit)
        return null;
    const reason = semantic.explanation ||
        explainDecision({
            action: 'semantic_match',
            rawValue: rawSegment,
            matchedCanonicalName: hit.unit.canonicalName,
            confidence: semantic.confidence,
            signals: { llm: true, model: semantic.model },
        });
    await logDecision({
        decisionType: 'org_match',
        rawValue: rawSegment,
        normalizedRawValue: normalized,
        matchedUnitId: hit.unit._id,
        matchedCanonicalName: hit.unit.canonicalName,
        parentId: parentId || undefined,
        confidence: semantic.confidence,
        action: 'semantic_match',
        reason,
        signals: { llm: true, model: semantic.model },
        source: 'openai',
        personalNumber,
    });
    return {
        unit: hit.unit,
        created: false,
        confidence: semantic.confidence,
        action: 'semantic_match',
    };
}
async function getChildren(parentId) {
    if (parentId) {
        return (await OrgUnit.find({ parentId }).lean());
    }
    return (await OrgUnit.find({
        $or: [{ parentId: null }, { parentId: { $exists: false } }],
    }).lean());
}
function findExact(children, normalized) {
    return children.find((c) => c.normalizedName === normalized);
}
function findAlias(children, normalized) {
    for (const child of children) {
        const alias = child.aliases?.find((a) => a.status === 'active' && a.normalizedValue === normalized);
        if (alias)
            return { unit: child, confidence: alias.confidence };
    }
    return undefined;
}
function findFuzzy(children, normalized) {
    const candidates = [];
    for (const child of children) {
        const sim = stringSimilarity(normalized, child.normalizedName);
        if (sim >= FUZZY_MED) {
            candidates.push({ unit: child, confidence: sim, matchType: 'fuzzy' });
        }
        for (const alias of child.aliases || []) {
            if (alias.status !== 'active')
                continue;
            const aliasSim = stringSimilarity(normalized, alias.normalizedValue);
            if (aliasSim >= FUZZY_MED) {
                candidates.push({ unit: child, confidence: Math.max(sim, aliasSim), matchType: 'alias' });
            }
        }
    }
    candidates.sort((a, b) => b.confidence - a.confidence);
    return candidates;
}
function matchUnitName(unit, normalized, minFuzzy = FUZZY_HIGH) {
    if (unit.normalizedName === normalized) {
        return { unit, confidence: 1, matchType: 'exact' };
    }
    const alias = unit.aliases?.find((a) => a.status === 'active' && a.normalizedValue === normalized);
    if (alias) {
        return { unit, confidence: alias.confidence, matchType: 'alias' };
    }
    const sim = stringSimilarity(normalized, unit.normalizedName);
    if (sim >= minFuzzy) {
        return { unit, confidence: sim, matchType: 'fuzzy' };
    }
    return null;
}
function objectIdEquals(a, b) {
    return String(a) === String(b);
}
async function getOrderedUnitsByIds(ids) {
    const units = (await OrgUnit.find({ _id: { $in: ids } }).lean());
    const byId = new Map(units.map((unit) => [String(unit._id), unit]));
    return ids.map((id) => byId.get(String(id))).filter(Boolean);
}
function pathIdsOf(unit) {
    return [...(unit.pathIds ?? []), unit._id];
}
function scoreExistingPath(fullPathUnits, segments) {
    let searchFrom = 0;
    let totalConfidence = 0;
    const matchedIndexes = [];
    const matches = [];
    const weakSegmentIndexes = [];
    let strongMatchCount = 0;
    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
        const segment = segments[segmentIndex];
        const normalized = normalizeSegment(segment);
        let best = null;
        for (let i = searchFrom; i < fullPathUnits.length; i++) {
            const match = matchUnitName(fullPathUnits[i], normalized, CONTEXTUAL_FUZZY_MIN);
            if (!match)
                continue;
            if (!best || match.confidence > best.match.confidence) {
                best = { index: i, match };
            }
            if (match.confidence === 1)
                break;
        }
        if (!best)
            return null;
        matchedIndexes.push(best.index);
        matches.push(best.match);
        totalConfidence += best.match.confidence;
        if (best.match.confidence >= FUZZY_MED) {
            strongMatchCount++;
        }
        else {
            weakSegmentIndexes.push(segmentIndex);
        }
        searchFrom = best.index + 1;
    }
    if (matchedIndexes.length !== segments.length)
        return null;
    const skippedUnits = fullPathUnits.length - matchedIndexes.length;
    const averageConfidence = totalConfidence / segments.length;
    const downstreamSupportedWeakSegments = weakSegmentIndexes.filter((weakIndex) => matches.slice(weakIndex + 1).some((match) => match.confidence >= FUZZY_MED)).length;
    const contextConfidence = Math.min(1, averageConfidence +
        Math.min(0.08, strongMatchCount * 0.012) +
        Math.min(0.06, downstreamSupportedWeakSegments * 0.03) -
        Math.max(0, weakSegmentIndexes.length - downstreamSupportedWeakSegments) * 0.08);
    return {
        matchedIndexes,
        matches,
        averageConfidence,
        contextConfidence,
        weakSegmentIndexes,
        strongMatchCount,
        skippedUnits,
    };
}
function hasContextForWeakMatches(score) {
    if (score.weakSegmentIndexes.length === 0)
        return true;
    return score.weakSegmentIndexes.every((weakIndex) => score.matches.slice(weakIndex + 1).some((match) => match.confidence >= FUZZY_MED));
}
function shouldUseExistingPathScore(score, segmentCount) {
    if (score.averageConfidence >= FUZZY_HIGH && score.weakSegmentIndexes.length === 0)
        return true;
    if (score.weakSegmentIndexes.length === 0 && score.contextConfidence >= CONTEXTUAL_PATH_MIN)
        return true;
    if (segmentCount < 3)
        return false;
    if (!hasContextForWeakMatches(score))
        return false;
    if (score.weakSegmentIndexes.length > 2)
        return false;
    return score.contextConfidence >= CONTEXTUAL_PATH_MIN && score.strongMatchCount >= segmentCount - score.weakSegmentIndexes.length;
}
async function findExistingPathAlignment(segments, personalNumber) {
    if (segments.length === 0)
        return null;
    const allUnits = (await OrgUnit.find({}).lean());
    const byId = new Map(allUnits.map((unit) => [String(unit._id), unit]));
    const candidates = [];
    for (const leaf of allUnits) {
        const fullPathUnits = pathIdsOf(leaf)
            .map((id) => byId.get(String(id)))
            .filter(Boolean);
        if (fullPathUnits.length === 0)
            continue;
        const score = scoreExistingPath(fullPathUnits, segments);
        if (!score)
            continue;
        if (!shouldUseExistingPathScore(score, segments.length))
            continue;
        candidates.push({ leaf, fullPathUnits, ...score });
    }
    candidates.sort((a, b) => {
        if (b.contextConfidence !== a.contextConfidence)
            return b.contextConfidence - a.contextConfidence;
        if (a.weakSegmentIndexes.length !== b.weakSegmentIndexes.length) {
            return a.weakSegmentIndexes.length - b.weakSegmentIndexes.length;
        }
        if (b.averageConfidence !== a.averageConfidence)
            return b.averageConfidence - a.averageConfidence;
        if (a.skippedUnits !== b.skippedUnits)
            return a.skippedUnits - b.skippedUnits;
        return b.fullPathUnits.length - a.fullPathUnits.length;
    });
    const best = candidates[0];
    if (!best)
        return null;
    const second = candidates[1];
    let reviewId;
    let targetConfidence = best.averageConfidence;
    let targetAction = 'existing_path_match';
    if (second &&
        Math.abs(second.contextConfidence - best.contextConfidence) < 0.03 &&
        second.skippedUnits === best.skippedUnits) {
        const review = await createReview({
            changeType: 'conflict_match',
            reason: 'Existing-path search found multiple full paths with similar confidence',
            rawValue: segments.join('/'),
            confidence: best.contextConfidence,
            conflict: {
                rawValue: segments.join('/'),
                candidates: candidates.slice(0, 3).map((c) => ({
                    unitId: String(c.leaf._id),
                    canonicalName: c.leaf.pathText || c.leaf.canonicalName,
                    confidence: c.contextConfidence,
                })),
            },
            proposedBy: personalNumber,
        });
        reviewId = String(review._id);
        targetConfidence = 0.5;
        targetAction = 'review_existing_path_conflict';
    }
    else if (best.weakSegmentIndexes.length > 0 || best.contextConfidence > best.averageConfidence) {
        targetConfidence = best.contextConfidence;
        targetAction = 'contextual_existing_path_match';
    }
    const matchedByIndex = new Map();
    best.matchedIndexes.forEach((pathIndex, segmentIndex) => {
        matchedByIndex.set(pathIndex, {
            segment: segments[segmentIndex],
            match: best.matches[segmentIndex],
        });
    });
    const results = [];
    const pathSegments = [];
    for (let i = 0; i < best.fullPathUnits.length; i++) {
        const unit = best.fullPathUnits[i];
        const matched = matchedByIndex.get(i);
        const isFirstMatched = i === best.matchedIndexes[0];
        const isMatched = !!matched;
        const action = !isMatched
            ? 'fill_existing_path_gap'
            : isFirstMatched
                ? targetAction
                : matched.match.matchType === 'exact'
                    ? 'exact_match'
                    : `${matched.match.matchType}_match`;
        const confidence = !isMatched ? 0.98 : isFirstMatched ? targetConfidence : matched.match.confidence;
        const rawValue = matched?.segment ?? unit.canonicalName;
        const reason = explainDecision({
            action,
            rawValue,
            matchedCanonicalName: unit.canonicalName,
            confidence,
            signals: { existingPathSearch: true },
        });
        await logDecision({
            decisionType: 'org_match',
            rawValue,
            normalizedRawValue: matched ? normalizeSegment(matched.segment) : unit.normalizedName,
            matchedUnitId: unit._id,
            matchedCanonicalName: unit.canonicalName,
            parentId: unit.parentId,
            confidence,
            action,
            reason,
            signals: {
                existingPathSearch: true,
                contextualPathSearch: targetAction === 'contextual_existing_path_match',
                pathContextConfidence: best.contextConfidence,
                weakSegmentIndexes: best.weakSegmentIndexes,
                reviewId: isFirstMatched ? reviewId : undefined,
                matchedInput: isMatched,
            },
            personalNumber,
        });
        results.push({
            unit,
            created: false,
            confidence,
            action,
            suspectedMissingLevel: best.skippedUnits > 0,
            reviewId: isFirstMatched ? reviewId : undefined,
        });
        pathSegments.push(rawValue);
    }
    return {
        results,
        pathSegments,
        reviewIds: reviewId ? [reviewId] : [],
    };
}
async function findMissingLevelBridge(rawSegment, normalized, parentId, personalNumber) {
    const descendants = (await OrgUnit.find({
        pathIds: parentId,
    }).lean());
    const candidates = [];
    for (const unit of descendants) {
        if (unit.normalizedName === normalized) {
            candidates.push({ unit, confidence: 1, matchType: 'exact' });
            continue;
        }
        const alias = unit.aliases?.find((a) => a.status === 'active' && a.normalizedValue === normalized);
        if (alias) {
            candidates.push({ unit, confidence: alias.confidence, matchType: 'alias' });
            continue;
        }
        const sim = stringSimilarity(normalized, unit.normalizedName);
        if (sim >= FUZZY_MED) {
            candidates.push({ unit, confidence: sim, matchType: 'fuzzy' });
        }
    }
    candidates.sort((a, b) => b.confidence - a.confidence);
    const best = candidates[0];
    if (!best)
        return null;
    const second = candidates[1];
    let bridgeReviewId;
    let targetConfidence = best.confidence;
    let targetAction = 'missing_level_match';
    if (second && Math.abs(best.confidence - second.confidence) < 0.03) {
        const review = await createReview({
            changeType: 'conflict_match',
            reason: 'Missing-level search found multiple descendant paths with similar confidence',
            rawValue: rawSegment,
            parentId,
            confidence: best.confidence,
            conflict: {
                rawValue: rawSegment,
                candidates: candidates.slice(0, 3).map((c) => ({
                    unitId: String(c.unit._id),
                    canonicalName: c.unit.canonicalName,
                    confidence: c.confidence,
                })),
            },
            proposedBy: personalNumber,
        });
        bridgeReviewId = String(review._id);
        targetConfidence = 0.5;
        targetAction = 'review_missing_level_conflict';
    }
    const targetPathIds = best.unit.pathIds ?? [];
    const parentIdx = targetPathIds.findIndex((id) => objectIdEquals(id, parentId));
    if (parentIdx < 0)
        return null;
    const bridgeIds = [
        ...targetPathIds.slice(parentIdx + 1),
        best.unit._id,
    ];
    if (bridgeIds.length < 2)
        return null;
    const bridgeUnitsRaw = (await OrgUnit.find({ _id: { $in: bridgeIds } }).lean());
    const byId = new Map(bridgeUnitsRaw.map((unit) => [String(unit._id), unit]));
    const bridgeUnits = bridgeIds.map((id) => byId.get(String(id))).filter(Boolean);
    if (bridgeUnits.length !== bridgeIds.length)
        return null;
    const results = [];
    for (let i = 0; i < bridgeUnits.length; i++) {
        const unit = bridgeUnits[i];
        const isTarget = i === bridgeUnits.length - 1;
        const action = isTarget ? targetAction : 'fill_missing_level';
        const confidence = isTarget ? targetConfidence : 0.98;
        const reason = explainDecision({
            action,
            rawValue: isTarget ? rawSegment : unit.canonicalName,
            matchedCanonicalName: unit.canonicalName,
            confidence,
            signals: { suspectedMissingLevel: true },
        });
        await logDecision({
            decisionType: 'org_match',
            rawValue: isTarget ? rawSegment : unit.canonicalName,
            normalizedRawValue: isTarget ? normalized : unit.normalizedName,
            matchedUnitId: unit._id,
            matchedCanonicalName: unit.canonicalName,
            parentId: unit.parentId,
            confidence,
            action,
            reason,
            signals: {
                suspectedMissingLevel: true,
                filledFromAncestor: String(parentId),
                matchType: isTarget ? best.matchType : 'ancestor',
                reviewId: isTarget ? bridgeReviewId : undefined,
            },
            personalNumber,
        });
        results.push({
            unit,
            created: false,
            confidence,
            action,
            suspectedMissingLevel: true,
            reviewId: isTarget ? bridgeReviewId : undefined,
        });
    }
    return results;
}
async function scoreContinuation(startUnit, segments) {
    const matches = [{ unit: startUnit, confidence: 1, matchType: 'exact' }];
    let current = startUnit;
    let totalConfidence = 1;
    let consumedSegments = 1;
    for (let i = 1; i < segments.length; i++) {
        const normalized = normalizeSegment(segments[i]);
        const children = await getChildren(current._id);
        const candidates = children
            .map((child) => matchUnitName(child, normalized))
            .filter(Boolean);
        candidates.sort((a, b) => b.confidence - a.confidence);
        const best = candidates[0];
        if (!best)
            break;
        const second = candidates[1];
        if (second && Math.abs(best.confidence - second.confidence) < 0.03)
            break;
        matches.push(best);
        totalConfidence += best.confidence;
        consumedSegments++;
        current = best.unit;
    }
    return { consumedSegments, totalConfidence, matches };
}
async function findPrefixAlignment(segments, personalNumber) {
    if (segments.length === 0)
        return null;
    const normalizedFirst = normalizeSegment(segments[0]);
    const allUnits = (await OrgUnit.find({}).lean());
    const candidates = [];
    for (const unit of allUnits) {
        if (!unit.pathIds?.length)
            continue;
        const firstMatch = matchUnitName(unit, normalizedFirst);
        if (!firstMatch)
            continue;
        const continuation = await scoreContinuation(unit, segments);
        continuation.matches[0] = firstMatch;
        const totalConfidence = firstMatch.confidence +
            continuation.matches.slice(1).reduce((sum, match) => sum + match.confidence, 0);
        candidates.push({
            unit,
            firstMatch,
            consumedSegments: continuation.consumedSegments,
            averageConfidence: totalConfidence / continuation.consumedSegments,
            matches: continuation.matches,
        });
    }
    candidates.sort((a, b) => {
        if (b.consumedSegments !== a.consumedSegments)
            return b.consumedSegments - a.consumedSegments;
        if (b.averageConfidence !== a.averageConfidence)
            return b.averageConfidence - a.averageConfidence;
        return (a.unit.pathIds?.length ?? 0) - (b.unit.pathIds?.length ?? 0);
    });
    const best = candidates[0];
    if (!best)
        return null;
    if (best.consumedSegments === 1 && segments.length > 1 && best.averageConfidence < 1)
        return null;
    const second = candidates[1];
    let reviewId;
    let targetAction = 'prefix_alignment_match';
    let targetConfidence = best.averageConfidence;
    if (second &&
        second.consumedSegments === best.consumedSegments &&
        Math.abs(second.averageConfidence - best.averageConfidence) < 0.03) {
        const review = await createReview({
            changeType: 'conflict_match',
            reason: 'Prefix alignment found multiple existing paths with similar confidence',
            rawValue: segments.join('/'),
            confidence: best.averageConfidence,
            conflict: {
                rawValue: segments.join('/'),
                candidates: candidates.slice(0, 3).map((c) => ({
                    unitId: String(c.unit._id),
                    canonicalName: c.unit.pathText || c.unit.canonicalName,
                    confidence: c.averageConfidence,
                })),
            },
            proposedBy: personalNumber,
        });
        reviewId = String(review._id);
        targetAction = 'review_prefix_alignment_conflict';
        targetConfidence = 0.5;
    }
    const fullPathUnits = await getOrderedUnitsByIds([
        ...(best.unit.pathIds ?? []),
        best.unit._id,
    ]);
    if (fullPathUnits.length === 0)
        return null;
    const missingPrefixCount = fullPathUnits.length - 1;
    const results = [];
    const pathSegments = [];
    for (let i = 0; i < fullPathUnits.length; i++) {
        const unit = fullPathUnits[i];
        const isInputStart = i === fullPathUnits.length - 1;
        const action = isInputStart ? targetAction : 'fill_missing_prefix';
        const confidence = isInputStart ? targetConfidence : 0.98;
        const rawValue = isInputStart ? segments[0] : unit.canonicalName;
        const reason = explainDecision({
            action,
            rawValue,
            matchedCanonicalName: unit.canonicalName,
            confidence,
            signals: { missingPrefix: true },
        });
        await logDecision({
            decisionType: 'org_match',
            rawValue,
            normalizedRawValue: isInputStart ? normalizedFirst : unit.normalizedName,
            matchedUnitId: unit._id,
            matchedCanonicalName: unit.canonicalName,
            parentId: unit.parentId,
            confidence,
            action,
            reason,
            signals: {
                missingPrefix: true,
                reviewId: isInputStart ? reviewId : undefined,
                consumedSegments: best.consumedSegments,
            },
            personalNumber,
        });
        results.push({
            unit,
            created: false,
            confidence,
            action,
            suspectedMissingLevel: true,
            reviewId: isInputStart ? reviewId : undefined,
        });
        pathSegments.push(isInputStart ? segments[0] : unit.canonicalName);
    }
    let current = fullPathUnits[fullPathUnits.length - 1];
    for (let i = 1; i < best.consumedSegments; i++) {
        const match = best.matches[i];
        const action = match.matchType === 'exact' ? 'exact_match' : `${match.matchType}_match`;
        const reason = explainDecision({
            action,
            rawValue: segments[i],
            matchedCanonicalName: match.unit.canonicalName,
            confidence: match.confidence,
        });
        await logDecision({
            decisionType: 'org_match',
            rawValue: segments[i],
            normalizedRawValue: normalizeSegment(segments[i]),
            matchedUnitId: match.unit._id,
            matchedCanonicalName: match.unit.canonicalName,
            parentId: current._id,
            confidence: match.confidence,
            action,
            reason,
            signals: { continuationAfterMissingPrefix: true },
            personalNumber,
        });
        results.push({
            unit: match.unit,
            created: false,
            confidence: match.confidence,
            action,
        });
        pathSegments.push(segments[i]);
        current = match.unit;
    }
    return {
        results,
        pathSegments,
        consumedSegments: best.consumedSegments,
        reviewId,
    };
}
async function createOrgUnit(displayName, parentId, parentPathIds, level) {
    const normalizedName = normalizeSegment(displayName);
    const duplicateQuery = parentId
        ? { parentId, normalizedName }
        : { $or: [{ parentId: null }, { parentId: { $exists: false } }], normalizedName };
    const existing = await OrgUnit.findOne(duplicateQuery);
    if (existing)
        return existing;
    const pathIds = parentId ? [...parentPathIds, parentId] : [];
    let pathTextResolved = displayName;
    if (parentId) {
        const parent = await OrgUnit.findById(parentId);
        pathTextResolved = parent ? `${parent.pathText}/${displayName}` : displayName;
    }
    const unit = await OrgUnit.create({
        canonicalName: displayName,
        normalizedName,
        parentId: parentId || undefined,
        pathIds,
        pathText: pathTextResolved,
        level,
        type: inferUnitType(level),
        aliases: [],
        isVerified: false,
        verificationStatus: 'unverified',
        stats: { userCount: 0, aliasCount: 0, loginCount: 0 },
    });
    return unit;
}
/** Track raw→canonical promotions per parent for alias learning (persisted in MongoDB). */
async function matchOrgSegment(rawSegment, parentId, parentPathIds, level, personalNumber) {
    const normalized = normalizeSegment(rawSegment);
    const children = await getChildren(parentId);
    const parentKey = parentId?.toString() || 'root';
    const exact = findExact(children, normalized);
    if (exact) {
        const reason = explainDecision({
            action: 'exact_match',
            rawValue: rawSegment,
            matchedCanonicalName: exact.canonicalName,
            confidence: 1,
        });
        await logDecision({
            decisionType: 'org_match',
            rawValue: rawSegment,
            normalizedRawValue: normalized,
            matchedUnitId: exact._id,
            matchedCanonicalName: exact.canonicalName,
            parentId: parentId || undefined,
            confidence: 1,
            action: 'exact_match',
            reason,
            personalNumber,
        });
        return { unit: exact, created: false, confidence: 1, action: 'exact_match' };
    }
    const aliasHit = findAlias(children, normalized);
    if (aliasHit) {
        const reason = explainDecision({
            action: 'alias_match',
            rawValue: rawSegment,
            matchedCanonicalName: aliasHit.unit.canonicalName,
            confidence: aliasHit.confidence,
            signals: { alias: true },
        });
        await logDecision({
            decisionType: 'org_match',
            rawValue: rawSegment,
            normalizedRawValue: normalized,
            matchedUnitId: aliasHit.unit._id,
            matchedCanonicalName: aliasHit.unit.canonicalName,
            parentId: parentId || undefined,
            confidence: aliasHit.confidence,
            action: 'alias_match',
            reason,
            signals: { alias: true },
            personalNumber,
        });
        return {
            unit: aliasHit.unit,
            created: false,
            confidence: aliasHit.confidence,
            action: 'alias_match',
        };
    }
    const fuzzyCandidates = findFuzzy(children, normalized);
    if (fuzzyCandidates.length > 0) {
        const semanticAuto = await applySemanticMatch(rawSegment, normalized, parentId, personalNumber, fuzzyCandidates, FUZZY_HIGH);
        if (semanticAuto) {
            await trackPromotion(parentKey, normalized, String(semanticAuto.unit._id));
            await maybePromoteAlias(semanticAuto.unit, rawSegment, normalized, parentId);
            return semanticAuto;
        }
    }
    if (fuzzyCandidates.length >= 2) {
        const top = fuzzyCandidates[0];
        const second = fuzzyCandidates[1];
        if (top.confidence >= FUZZY_MED && second.confidence >= FUZZY_MED && Math.abs(top.confidence - second.confidence) < 0.05) {
            const semanticConflict = await applySemanticMatch(rawSegment, normalized, parentId, personalNumber, fuzzyCandidates, FUZZY_MED);
            if (semanticConflict) {
                await trackPromotion(parentKey, normalized, String(semanticConflict.unit._id));
                return semanticConflict;
            }
            const review = await createReview({
                changeType: 'conflict_match',
                reason: 'Two units match with similar confidence',
                rawValue: rawSegment,
                parentId: parentId || undefined,
                confidence: top.confidence,
                conflict: {
                    rawValue: rawSegment,
                    candidates: fuzzyCandidates.slice(0, 3).map((c) => ({
                        unitId: String(c.unit._id),
                        canonicalName: c.unit.canonicalName,
                        confidence: c.confidence,
                    })),
                },
                proposedBy: personalNumber,
            });
            const reason = explainDecision({
                action: 'review_conflict',
                rawValue: rawSegment,
                confidence: top.confidence,
                signals: { conflict: true, candidates: fuzzyCandidates.length },
            });
            await logDecision({
                decisionType: 'org_match',
                rawValue: rawSegment,
                normalizedRawValue: normalized,
                parentId: parentId || undefined,
                confidence: top.confidence,
                action: 'review_conflict',
                reason,
                signals: { conflict: true, candidates: fuzzyCandidates.length, reviewId: String(review._id) },
                personalNumber,
            });
            const unit = parentId === null && children.length > 0
                ? children[0]
                : await createOrgUnit(rawSegment, parentId, parentPathIds, level);
            return {
                unit,
                created: parentId !== null || children.length === 0,
                confidence: 0.5,
                action: parentId === null && children.length > 0 ? 'review_conflict' : 'create_due_to_conflict',
                reviewId: String(review._id),
            };
        }
    }
    if (fuzzyCandidates.length === 1 || (fuzzyCandidates.length > 0 && fuzzyCandidates[0].confidence - (fuzzyCandidates[1]?.confidence ?? 0) >= 0.05)) {
        const best = fuzzyCandidates[0];
        const seenCount = await getPromotionCount(parentKey, normalized, String(best.unit._id));
        const conf = computeConfidence({
            similarity: best.confidence,
            hasAlias: best.matchType === 'alias',
            seenCount,
            hasConflict: false,
        });
        if (conf >= FUZZY_HIGH) {
            await trackPromotion(parentKey, normalized, String(best.unit._id));
            const reason = explainDecision({
                action: 'fuzzy_auto',
                rawValue: rawSegment,
                matchedCanonicalName: best.unit.canonicalName,
                confidence: conf,
            });
            await logDecision({
                decisionType: 'org_match',
                rawValue: rawSegment,
                normalizedRawValue: normalized,
                matchedUnitId: best.unit._id,
                matchedCanonicalName: best.unit.canonicalName,
                parentId: parentId || undefined,
                confidence: conf,
                action: 'fuzzy_auto',
                reason,
                personalNumber,
            });
            await maybePromoteAlias(best.unit, rawSegment, normalized, parentId);
            return { unit: best.unit, created: false, confidence: conf, action: 'fuzzy_auto' };
        }
        if (conf >= FUZZY_MED && conf < FUZZY_HIGH) {
            const semanticMed = await applySemanticMatch(rawSegment, normalized, parentId, personalNumber, fuzzyCandidates, FUZZY_HIGH);
            if (semanticMed) {
                await trackPromotion(parentKey, normalized, String(semanticMed.unit._id));
                await maybePromoteAlias(semanticMed.unit, rawSegment, normalized, parentId);
                return semanticMed;
            }
            const count = await trackPromotion(parentKey, normalized, String(best.unit._id));
            if (count >= ALIAS_PROMOTE_COUNT) {
                const reason = explainDecision({
                    action: 'fuzzy_pattern',
                    rawValue: rawSegment,
                    matchedCanonicalName: best.unit.canonicalName,
                    confidence: conf,
                });
                await logDecision({
                    decisionType: 'org_match',
                    rawValue: rawSegment,
                    normalizedRawValue: normalized,
                    matchedUnitId: best.unit._id,
                    matchedCanonicalName: best.unit.canonicalName,
                    parentId: parentId || undefined,
                    confidence: conf,
                    action: 'fuzzy_pattern',
                    reason,
                    personalNumber,
                });
                await promoteAliasOnUnit(best.unit._id, rawSegment, normalized, conf);
                return { unit: best.unit, created: false, confidence: conf, action: 'fuzzy_pattern' };
            }
            const review = await createReview({
                changeType: 'medium_confidence',
                targetUnitId: best.unit._id,
                targetCanonicalName: best.unit.canonicalName,
                proposedAlias: rawSegment,
                reason: `Medium confidence ${conf.toFixed(3)} — needs pattern confirmation (${count}/${ALIAS_PROMOTE_COUNT})`,
                rawValue: rawSegment,
                parentId: parentId || undefined,
                confidence: conf,
                proposedBy: personalNumber,
            });
            const reason = explainDecision({
                action: 'review_medium',
                rawValue: rawSegment,
                matchedCanonicalName: best.unit.canonicalName,
                confidence: conf,
            });
            await logDecision({
                decisionType: 'org_match',
                rawValue: rawSegment,
                normalizedRawValue: normalized,
                matchedUnitId: best.unit._id,
                matchedCanonicalName: best.unit.canonicalName,
                parentId: parentId || undefined,
                confidence: conf,
                action: 'review_medium',
                reason,
                signals: { reviewId: String(review._id), patternCount: count },
                personalNumber,
            });
            return {
                unit: best.unit,
                created: false,
                confidence: conf,
                action: 'review_medium',
                reviewId: String(review._id),
            };
        }
    }
    // Weak fuzzy + LLM before creating — avoids duplicate roots when ingest path differs slightly
    if (children.length > 0) {
        const weakCandidates = children
            .map((child) => ({
            unit: child,
            confidence: stringSimilarity(normalized, child.normalizedName),
            matchType: 'fuzzy',
        }))
            .filter((c) => c.confidence >= 0.55)
            .sort((a, b) => b.confidence - a.confidence);
        if (weakCandidates.length > 0) {
            const semanticLast = await applySemanticMatch(rawSegment, normalized, parentId, personalNumber, weakCandidates, FUZZY_MED);
            if (semanticLast) {
                await trackPromotion(parentKey, normalized, String(semanticLast.unit._id));
                await maybePromoteAlias(semanticLast.unit, rawSegment, normalized, parentId);
                return semanticLast;
            }
        }
    }
    // בדיקה: האם קיים segment זהה תחת הורה אחר (רמות חסרות?)
    let suspectedMissing = false;
    if (parentId) {
        const sameNameElsewhere = await OrgUnit.findOne({
            normalizedName: normalized,
            parentId: { $ne: parentId },
        }).lean();
        if (sameNameElsewhere) {
            suspectedMissing = true;
        }
    }
    else {
        const existingRoots = await OrgUnit.find({
            $or: [{ parentId: null }, { parentId: { $exists: false } }],
            normalizedName: { $ne: normalized },
        }).lean();
        if (existingRoots.length > 0)
            suspectedMissing = true;
    }
    // Do not spawn a second root when a seeded tree already exists
    if (parentId === null && children.length > 0) {
        suspectedMissing = true;
        const review = await createReview({
            changeType: 'medium_confidence',
            targetCanonicalName: children[0].canonicalName,
            reason: `שורש לא מוכר "${rawSegment}" — העץ הקיים מתחיל ב"${children[0].canonicalName}"`,
            rawValue: rawSegment,
            confidence: 0.5,
            proposedBy: personalNumber,
        });
        const reason = explainDecision({
            action: 'review_medium',
            rawValue: rawSegment,
            matchedCanonicalName: children[0].canonicalName,
            confidence: 0.5,
        });
        await logDecision({
            decisionType: 'org_match',
            rawValue: rawSegment,
            normalizedRawValue: normalized,
            matchedUnitId: children[0]._id,
            matchedCanonicalName: children[0].canonicalName,
            confidence: 0.5,
            action: 'review_medium',
            reason,
            signals: { reviewId: String(review._id), unknownRoot: true },
            personalNumber,
        });
        return {
            unit: children[0],
            created: false,
            confidence: 0.5,
            action: 'review_medium',
            reviewId: String(review._id),
            suspectedMissingLevel: true,
        };
    }
    if (parentId) {
        const bridge = await findMissingLevelBridge(rawSegment, normalized, parentId, personalNumber);
        if (bridge) {
            return {
                ...bridge[bridge.length - 1],
                filledPath: bridge,
            };
        }
    }
    const unit = await createOrgUnit(rawSegment, parentId, parentPathIds, level);
    const action = 'create_unit';
    const reason = explainDecision({
        action,
        rawValue: rawSegment,
        matchedCanonicalName: unit.canonicalName,
        confidence: 0.7,
        signals: suspectedMissing ? { suspectedMissingLevel: true } : {},
    });
    await logDecision({
        decisionType: 'org_match',
        rawValue: rawSegment,
        normalizedRawValue: normalized,
        matchedUnitId: unit._id,
        matchedCanonicalName: unit.canonicalName,
        parentId: parentId || undefined,
        confidence: 0.7,
        action,
        reason,
        signals: suspectedMissing ? { suspectedMissingLevel: true } : {},
        personalNumber,
    });
    return {
        unit,
        created: true,
        confidence: 0.7,
        action: 'create_unit',
        suspectedMissingLevel: suspectedMissing,
    };
}
async function promoteAliasOnUnit(unitId, rawValue, normalizedValue, confidence) {
    const unit = await OrgUnit.findById(unitId);
    if (!unit)
        return;
    const exists = unit.aliases.some((a) => a.normalizedValue === normalizedValue);
    if (exists)
        return;
    unit.aliases.push({
        value: rawValue,
        normalizedValue,
        confidence,
        seenCount: ALIAS_PROMOTE_COUNT,
        scope: 'parent',
        source: 'pattern_learning',
        status: 'active',
    });
    unit.stats.aliasCount = unit.aliases.length;
    await unit.save();
}
async function maybePromoteAlias(unit, rawValue, normalizedValue, parentId) {
    const parentKey = parentId?.toString() || 'root';
    const count = await getPromotionCount(parentKey, normalizedValue, String(unit._id));
    if (count >= ALIAS_PROMOTE_COUNT) {
        await promoteAliasOnUnit(unit._id, rawValue, normalizedValue, 0.95);
    }
}
async function buildOrgPath(segments, personalNumber) {
    const safeSegments = segments.filter((segment) => !isPersonalIdentifierSegment(segment, personalNumber));
    const pathIds = [];
    const pathUnits = [];
    const pathSegments = [];
    const decisions = [];
    const reviewIds = [];
    let parentId = null;
    let parentPathIds = [];
    let suspectedMissingLevel = false;
    let startLevel = 0;
    const existingPathAlignment = await findExistingPathAlignment(safeSegments, personalNumber);
    if (existingPathAlignment) {
        const pathText = existingPathAlignment.results.map((result) => result.unit.canonicalName).join('/');
        return {
            pathIds: existingPathAlignment.results.map((result) => result.unit._id),
            pathUnits: existingPathAlignment.results.map((result) => result.unit),
            pathSegments: existingPathAlignment.pathSegments,
            pathText,
            decisions: existingPathAlignment.results,
            suspectedMissingLevel: existingPathAlignment.results.some((result) => !!result.suspectedMissingLevel),
            reviewIds: existingPathAlignment.reviewIds,
        };
    }
    const prefixAlignment = await findPrefixAlignment(safeSegments, personalNumber);
    if (prefixAlignment) {
        for (let i = 0; i < prefixAlignment.results.length; i++) {
            const result = prefixAlignment.results[i];
            pathIds.push(result.unit._id);
            pathUnits.push(result.unit);
            pathSegments.push(prefixAlignment.pathSegments[i] ?? result.unit.canonicalName);
            decisions.push(result);
            if (result.reviewId)
                reviewIds.push(result.reviewId);
            if (result.suspectedMissingLevel)
                suspectedMissingLevel = true;
            parentId = result.unit._id;
            parentPathIds = [...pathIds.slice(0, -1)];
        }
        startLevel = prefixAlignment.consumedSegments;
    }
    for (let level = startLevel; level < safeSegments.length; level++) {
        const segment = safeSegments[level];
        const result = await matchOrgSegment(segment, parentId, parentPathIds, level, personalNumber);
        const matchedResults = result.filledPath ?? [result];
        for (let i = 0; i < matchedResults.length; i++) {
            const matched = matchedResults[i];
            pathIds.push(matched.unit._id);
            pathUnits.push(matched.unit);
            pathSegments.push(i === matchedResults.length - 1 ? segment : matched.unit.canonicalName);
            decisions.push(matched);
            if (matched.reviewId)
                reviewIds.push(matched.reviewId);
            if (matched.suspectedMissingLevel)
                suspectedMissingLevel = true;
            parentId = matched.unit._id;
            parentPathIds = [...pathIds.slice(0, -1)];
        }
    }
    const pathText = pathUnits.map((u) => u.canonicalName).join('/');
    return { pathIds, pathUnits, pathSegments, pathText, decisions, suspectedMissingLevel, reviewIds };
}

module.exports = { matchOrgSegment, buildOrgPath };
