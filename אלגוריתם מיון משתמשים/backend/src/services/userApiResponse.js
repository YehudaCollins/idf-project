const { OrgUnit } = require('../models/index');
async function formatUserRecord(user) {
    const pathIds = (user.currentOrgPathIds ?? []).map(String);
    let orgPath = [];
    if (pathIds.length) {
        const units = await OrgUnit.find({ _id: { $in: pathIds } }).lean();
        const byId = new Map(units.map((u) => [String(u._id), u]));
        orgPath = pathIds.map((id, level) => ({
            id,
            name: byId.get(id)?.canonicalName ?? '?',
            level,
            type: byId.get(id)?.type,
        }));
    }
    return {
        personalNumber: user.personalNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        rank: user.rank,
        role: user.role,
        email: user.email,
        phone: user.phone,
        profileImageUrl: user.profileImageUrl,
        sourceSystem: user.sourceSystem,
        registeredSourceSystem: user.registeredSourceSystem,
        registeredVia: user.registeredSourceSystem ?? user.sourceSystem,
        sourceSystems: user.sourceSystems ?? (user.sourceSystem ? [user.sourceSystem] : []),
        attributes: user.attributes ?? {},
        orgPathText: user.currentOrgPathText,
        orgPath,
        rawPaths: user.rawPaths ?? [],
        knownNames: user.knownNames ?? [],
        sources: user.sources ?? [],
        loginCount: user.loginCount ?? 0,
        lastSeenAt: user.lastSeenAt,
        firstSeenAt: user.firstSeenAt,
    };
}
function formatIngestResponse(result) {
    return {
        user: {
            personalNumber: result.user.personalNumber,
            fullName: result.user.fullName,
            orgPathText: result.user.currentOrgPathText,
            orgPathIds: result.user.currentOrgPathIds,
            rank: result.user.rank,
            role: result.user.role,
            email: result.user.email,
            profileImageUrl: result.user.profileImageUrl,
            sourceSystem: result.user.sourceSystem,
            registeredSourceSystem: result.user.registeredSourceSystem,
            registeredVia: result.user.registeredSourceSystem ?? result.user.sourceSystem,
            sourceSystems: result.user.sourceSystems,
            loginCount: result.user.loginCount,
            created: result.user.created,
            updated: result.user.updated,
        },
        ingest: {
            pathText: result.pathText,
            segments: result.parsed.segments,
            userNameRemoved: result.parsed.userNameRemoved,
            suspectedMissingLevel: result.suspectedMissingLevel,
            decisions: result.decisions,
            reviewIds: result.reviewIds,
            orgHistoryCreated: result.orgHistoryCreated,
            newOrgUnits: result.newOrgUnits,
            treeGrowth: result.treeGrowth,
            warnings: result.warnings,
        },
        enrichment: result.enrichment,
        ai: result.ai,
    };
}

module.exports = { formatUserRecord, formatIngestResponse };
