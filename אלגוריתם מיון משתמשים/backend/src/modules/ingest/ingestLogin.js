const { User, RawIngestEvent, UserOrgHistory } = require('../../models/index');
const { parseOrgPath } = require('../parser/pathParser');
const { buildOrgPath } = require('../matcher/orgMatcher');
const { mergeUserProfile } = require('./userEnrichment');
const { syncStatsAfterUserMove, incrementLoginStats } = require('../org/orgStats');
const { commanderStateForUnit, maybeCreateCommanderChangeReview } = require('../org/commanderReview');
const { resolveSoldierPlacement } = require('../org/placementRules');
const { getAiConfig } = require('../ai/config');
const { sanitizeIngestInput, validateIngestInput } = require('./validateIngest');
async function ingestLogin(input) {
    const sanitized = sanitizeIngestInput(input);
    const validationErrors = validateIngestInput(sanitized);
    if (validationErrors.length) {
        throw new Error(validationErrors.join('; '));
    }
    const { personalNumber, firstName, lastName, rawOrgPath, source = 'demo' } = sanitized;
    const accessRole = sanitized.accessRole === 'admin' || sanitized.accessRole === 'regular'
        ? sanitized.accessRole
        : undefined;
    const existing = await User.findOne({ personalNumber });
    const created = !existing;
    const parsed = parseOrgPath(rawOrgPath, {
        firstName,
        lastName,
        personalNumber,
        knownNames: existing?.knownNames ?? [],
    });
    const warnings = [];
    if (parsed.segments.length === 0) {
        warnings.push('לא זוהו קטעי ארגון בנתיב — ייתכן שהנתיב מכיל רק שם משתמש');
    }
    let pathIds = [];
    let pathUnits = [];
    let pathText = '';
    let decisions = [];
    let pathSegments = parsed.segments;
    let suspectedMissingLevel = false;
    let reviewIds = [];
    if (parsed.segments.length > 0) {
        const built = await buildOrgPath(parsed.segments, personalNumber);
        pathIds = built.pathIds;
        pathUnits = built.pathUnits;
        pathText = built.pathText;
        decisions = built.decisions;
        pathSegments = built.pathSegments;
        suspectedMissingLevel = built.suspectedMissingLevel;
        reviewIds = built.reviewIds;
    }
    const oldPathIds = existing?.currentOrgPathIds ?? [];
    const prevLeaf = existing?.currentOrgUnitId?.toString();
    const prevPathText = existing?.currentOrgPathText ?? '';
    const profile = mergeUserProfile(existing, { ...sanitized, source }, rawOrgPath);
    if (pathIds.length > 0) {
        const placement = await resolveSoldierPlacement({
            pathIds,
            pathUnits,
            pathText,
            personalNumber,
            user: {
                fullName: profile.fullName,
                role: profile.role,
                rank: profile.rank,
            },
        });
        pathIds = placement.pathIds;
        pathUnits = placement.pathUnits;
        pathText = placement.pathText;
        if (placement.addedSegment)
            pathSegments.push(placement.addedSegment);
        if (placement.decision)
            decisions.push(placement.decision);
        if (placement.warning)
            warnings.push(placement.warning);
        if (placement.decision?.suspectedMissingLevel)
            suspectedMissingLevel = true;
    }
    const leafId = pathIds[pathIds.length - 1];
    const newLeaf = leafId?.toString();
    const unitsForCommanderReview = new Map();
    if (leafId)
        unitsForCommanderReview.set(String(leafId), leafId);
    if (existing?.currentOrgUnitId && String(existing.currentOrgUnitId) !== newLeaf) {
        unitsForCommanderReview.set(String(existing.currentOrgUnitId), existing.currentOrgUnitId);
    }
    const previousCommanderStatesByUnit = new Map();
    for (const [unitIdText, unitObjectId] of unitsForCommanderReview) {
        previousCommanderStatesByUnit.set(unitIdText, await commanderStateForUnit(unitObjectId));
    }
    let orgHistoryCreated = false;
    const pathChanged = prevPathText !== pathText;
    const leafChanged = prevLeaf !== newLeaf;
    if (existing) {
        if (leafChanged || pathChanged) {
            await UserOrgHistory.create({
                personalNumber,
                fromOrgUnitId: existing.currentOrgUnitId,
                toOrgUnitId: leafId,
                fromPathIds: existing.currentOrgPathIds,
                toPathIds: pathIds,
                rawPath: rawOrgPath,
                changeSource: source,
                sourceSystem: profile.sourceSystem,
                confidence: 1,
                changedAt: new Date(),
            });
            orgHistoryCreated = true;
        }
        existing.firstName = firstName.trim();
        existing.lastName = lastName.trim();
        existing.fullName = profile.fullName;
        existing.rank = profile.rank;
        existing.role = profile.role;
        existing.email = profile.email;
        existing.phone = profile.phone;
        existing.profileImageUrl = profile.profileImageUrl;
        if (accessRole)
            existing.accessRole = accessRole;
        existing.sourceSystem = profile.sourceSystem;
        existing.registeredSourceSystem = profile.registeredSourceSystem;
        existing.sourceSystems = profile.sourceSystems;
        existing.attributes = profile.attributes;
        existing.knownNames = profile.knownNames;
        existing.rawPaths = profile.rawPaths;
        existing.sources = profile.sources;
        existing.loginCount = profile.loginCount;
        existing.currentOrgUnitId = leafId;
        existing.currentOrgPathIds = pathIds;
        existing.currentOrgPathText = pathText;
        existing.lastSeenAt = new Date();
        await existing.save();
    }
    else {
        await User.create({
            personalNumber,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            fullName: profile.fullName,
            rank: profile.rank,
            role: profile.role,
            email: profile.email,
            phone: profile.phone,
            profileImageUrl: profile.profileImageUrl,
            accessRole: accessRole ?? 'regular',
            sourceSystem: profile.sourceSystem,
            registeredSourceSystem: profile.registeredSourceSystem,
            sourceSystems: profile.sourceSystems,
            attributes: profile.attributes,
            currentOrgUnitId: leafId,
            currentOrgPathIds: pathIds,
            currentOrgPathText: pathText,
            rawPaths: profile.rawPaths,
            knownNames: profile.knownNames,
            sources: profile.sources,
            loginCount: profile.loginCount,
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
        });
    }
    if (leafId) {
        await incrementLoginStats(pathIds);
        if (existing && (leafChanged || pathChanged)) {
            await syncStatsAfterUserMove(oldPathIds, pathIds);
        }
        else {
            await syncStatsAfterUserMove([], pathIds);
        }
    }
    for (const [unitIdText, unitObjectId] of unitsForCommanderReview) {
        const previousState = previousCommanderStatesByUnit.get(unitIdText);
        const commanderReview = await maybeCreateCommanderChangeReview(unitObjectId, personalNumber, previousState?.commander, previousState?.directUserCount ?? 0);
        if (commanderReview.reviewId && !reviewIds.includes(commanderReview.reviewId)) {
            reviewIds.push(commanderReview.reviewId);
        }
    }
    const treeGrowth = pathSegments.map((seg, i) => ({
        segment: seg,
        unitId: String(pathIds[i] ?? ''),
        action: decisions[i]?.action ?? 'unknown',
        created: decisions[i]?.created ?? false,
    }));
    const newOrgUnits = decisions.filter((d) => d.created).length;
    const finalResult = {
        personalNumber,
        pathText,
        pathIds: pathIds.map(String),
        created,
        updated: !created,
        enrichmentCount: profile.changes.length,
        newOrgUnits,
        profileImageUrl: profile.profileImageUrl,
        sourceSystem: profile.sourceSystem,
        registeredSourceSystem: profile.registeredSourceSystem,
        sourceSystems: profile.sourceSystems,
    };
    await RawIngestEvent.create({
        personalNumber,
        firstName,
        lastName,
        profileImageUrl: profile.profileImageUrl,
        rawOrgPath,
        source,
        sourceSystem: profile.sourceSystem,
        parsedResult: parsed,
        finalResult,
    });
    parsed.suspectedMissingLevel = suspectedMissingLevel;
    const aiCfg = getAiConfig();
    const saved = (await User.findOne({ personalNumber }));
    return {
        user: {
            personalNumber: saved.personalNumber,
            firstName: saved.firstName,
            lastName: saved.lastName,
            fullName: saved.fullName,
            currentOrgPathText: saved.currentOrgPathText,
            currentOrgPathIds: saved.currentOrgPathIds.map(String),
            rank: saved.rank,
            role: saved.role,
            email: saved.email,
            profileImageUrl: saved.profileImageUrl,
            sourceSystem: saved.sourceSystem,
            registeredSourceSystem: saved.registeredSourceSystem,
            sourceSystems: saved.sourceSystems ?? [],
            loginCount: saved.loginCount,
            created,
            updated: !created,
        },
        parsed,
        pathText,
        pathIds: pathIds.map(String),
        decisions: pathSegments.map((seg, i) => ({
            segment: seg,
            action: decisions[i]?.action ?? 'unknown',
            confidence: decisions[i]?.confidence ?? 0,
            created: decisions[i]?.created ?? false,
            reviewId: decisions[i]?.reviewId,
            unitId: pathIds[i] ? String(pathIds[i]) : undefined,
        })),
        suspectedMissingLevel,
        orgHistoryCreated,
        reviewIds,
        enrichment: profile.changes,
        newOrgUnits,
        treeGrowth,
        warnings,
        ai: {
            provider: aiCfg.provider,
            model: aiCfg.model,
            ready: aiCfg.ready,
            needsReview: reviewIds.length > 0,
        },
    };
}

module.exports = { ingestLogin };
