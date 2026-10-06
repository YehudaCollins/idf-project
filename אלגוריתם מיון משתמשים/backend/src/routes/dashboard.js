const { Router } = require('express');
const { User, OrgUnit, AiDecisionLog, OrgChangeRequest, RawIngestEvent, } = require('../models/index');
const router = Router();
function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}
router.get('/stats', async (_req, res) => {
    try {
        const today = startOfToday();
        const [totalUsers, totalOrgUnits, orgUnitsToday, loginsToday, aiDecisionsToday, pendingReviews, recentEvents, recentDecisions, totalAliases,] = await Promise.all([
            User.countDocuments(),
            OrgUnit.countDocuments(),
            OrgUnit.countDocuments({ createdAt: { $gte: today } }),
            RawIngestEvent.countDocuments({ createdAt: { $gte: today } }),
            AiDecisionLog.countDocuments({ createdAt: { $gte: today } }),
            OrgChangeRequest.countDocuments({ status: 'needs_review' }),
            RawIngestEvent.find().sort({ createdAt: -1 }).limit(12).lean(),
            AiDecisionLog.find().sort({ createdAt: -1 }).limit(10).lean(),
            OrgUnit.aggregate([
                { $project: { aliasCount: { $size: { $ifNull: ['$aliases', []] } } } },
                { $group: { _id: null, total: { $sum: '$aliasCount' } } },
            ]),
        ]);
        const recentLogins = recentEvents.map((e) => {
            const fr = e.finalResult;
            return {
                personalNumber: e.personalNumber,
                firstName: e.firstName,
                lastName: e.lastName,
                profileImageUrl: e.profileImageUrl ?? fr?.profileImageUrl ?? '',
                rawOrgPath: e.rawOrgPath,
                source: e.source,
                sourceSystem: e.sourceSystem ?? fr?.sourceSystem ?? '',
                pathText: fr?.pathText ?? '',
                newOrgUnits: fr?.newOrgUnits ?? 0,
                created: fr?.created ?? false,
                enrichmentCount: fr?.enrichmentCount ?? 0,
                createdAt: e.createdAt,
            };
        });
        res.json({
            totalUsers,
            totalOrgUnits,
            orgUnitsToday,
            loginsToday,
            aiDecisionsToday,
            pendingReviews,
            totalAliases: totalAliases[0]?.total ?? 0,
            recentLogins,
            recentDecisions,
        });
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

module.exports = router;
