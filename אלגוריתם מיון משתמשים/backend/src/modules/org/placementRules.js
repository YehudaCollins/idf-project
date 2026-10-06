const { OrgUnit } = require('../../models/index');
const { logDecision } = require('../ai-decisions/logDecision');
const { normalizeSegment } = require('../parser/normalizer');
const { hasExplicitCommanderSignal } = require('./commanderDetection');
const { allowsDirectSoldiers, isTeamLikeUnit } = require('./orgUnitRules');
const FALLBACK_TEAM_NAME = 'צוות כללי';
async function childUnits(unitId) {
    return (await OrgUnit.find({ parentId: unitId }).lean());
}
async function ensureTeamUnder(parent) {
    const children = await childUnits(parent._id);
    const teamChildren = children.filter(isTeamLikeUnit);
    if (teamChildren.length === 1) {
        return { unit: teamChildren[0], created: false, action: 'assign_only_child_team_for_soldier' };
    }
    const fallbackNormalized = normalizeSegment(FALLBACK_TEAM_NAME);
    const fallback = teamChildren.find((unit) => unit.normalizedName === fallbackNormalized);
    if (fallback) {
        return { unit: fallback, created: false, action: 'assign_default_team_for_soldier' };
    }
    const parentId = parent._id;
    const created = await OrgUnit.create({
        canonicalName: FALLBACK_TEAM_NAME,
        normalizedName: fallbackNormalized,
        parentId,
        pathIds: [...(parent.pathIds ?? []), parentId],
        pathText: parent.pathText ? `${parent.pathText}/${FALLBACK_TEAM_NAME}` : FALLBACK_TEAM_NAME,
        level: (parent.level ?? 0) + 1,
        type: 'צוות',
        aliases: [],
        isVerified: false,
        verificationStatus: 'נוצר אוטומטית בגלל כלל שיבוץ לצוות',
        stats: { userCount: 0, aliasCount: 0, loginCount: 0 },
    });
    return { unit: created, created: true, action: 'create_default_team_for_soldier' };
}
async function resolveSoldierPlacement(params) {
    const leaf = params.pathUnits[params.pathUnits.length - 1];
    if (!leaf)
        return params;
    const leafChildren = await childUnits(leaf._id);
    const userLooksLikeCommander = hasExplicitCommanderSignal(params.user);
    if (userLooksLikeCommander || allowsDirectSoldiers(leaf, leafChildren.length > 0)) {
        return params;
    }
    const { unit, created, action } = await ensureTeamUnder(leaf);
    const teamId = unit._id;
    const pathIds = [...params.pathIds, teamId];
    const pathUnits = [...params.pathUnits, unit];
    const pathText = unit.pathText || `${params.pathText}/${unit.canonicalName}`;
    const reason = 'חייל רגיל יכול להשתייך רק לצוות; הנתיב הושלם לצוות תחת יחידת האם';
    await logDecision({
        decisionType: 'org_match',
        rawValue: unit.canonicalName,
        normalizedRawValue: unit.normalizedName,
        matchedUnitId: teamId,
        matchedCanonicalName: unit.canonicalName,
        parentId: leaf._id,
        confidence: created ? 0.72 : 0.88,
        action,
        reason,
        signals: {
            placementRule: 'soldiers_only_in_teams',
            parentUnitId: String(leaf._id),
            parentCanonicalName: leaf.canonicalName,
            parentHadChildren: leafChildren.length > 0,
        },
        personalNumber: params.personalNumber,
    });
    return {
        pathIds,
        pathUnits,
        pathText,
        addedSegment: unit.canonicalName,
        decision: {
            unit,
            created,
            confidence: created ? 0.72 : 0.88,
            action,
            suspectedMissingLevel: true,
        },
        warning: `המשתמש שויך ל"${unit.canonicalName}" כי חיילים רגילים יכולים להיות רק בצוות`,
    };
}

module.exports = { resolveSoldierPlacement };
