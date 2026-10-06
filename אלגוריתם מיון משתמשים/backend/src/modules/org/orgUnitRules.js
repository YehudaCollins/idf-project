const { normalizeSegment } = require('../parser/normalizer');
function isTeamLikeUnit(unit) {
    const name = normalizeSegment(unit.canonicalName ?? '');
    const type = normalizeSegment(unit.type ?? '');
    return type === 'צוות' || name === 'צוות' || name.startsWith('צוות ');
}
function allowsDirectSoldiers(unit, hasChildren) {
    return isTeamLikeUnit(unit) && !hasChildren;
}

module.exports = { isTeamLikeUnit, allowsDirectSoldiers };
