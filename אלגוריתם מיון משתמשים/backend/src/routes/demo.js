const { Router } = require('express');
const { DEMO_USERS, getDemoUserById } = require('../seed/demoUsers');
const { ingestLogin } = require('../modules/ingest/ingestLogin');
const { mapSharePointProfileToIngest } = require('../modules/ingest/sharePointProfile');
const router = Router();
router.get('/users', (_req, res) => {
    res.json(DEMO_USERS);
});
async function ingestDemoUser(demo) {
    const mapped = demo.sharePointProfile
        ? mapSharePointProfileToIngest(demo.sharePointProfile, {
            sourceSystem: demo.sourceSystem,
            source: 'demo-sharepoint-profile',
            accessRole: demo.accessRole,
        })
        : null;
    const result = await ingestLogin({
        personalNumber: mapped?.personalNumber ?? demo.personalNumber,
        firstName: mapped?.firstName ?? demo.firstName,
        lastName: mapped?.lastName ?? demo.lastName,
        rawOrgPath: mapped?.rawOrgPath ?? demo.rawOrgPath,
        rank: mapped?.rank ?? demo.rank,
        role: mapped?.role ?? demo.role,
        email: mapped?.email ?? demo.email,
        phone: mapped?.phone ?? demo.phone,
        profileImageUrl: mapped?.profileImageUrl ?? demo.profileImageUrl,
        sourceSystem: mapped?.sourceSystem ?? demo.sourceSystem,
        attributes: { ...(mapped?.attributes ?? {}), ...(demo.attributes ?? {}) },
        accessRole: mapped?.accessRole ?? demo.accessRole,
        source: mapped?.source ?? 'demo-login',
    });
    return { demo, ...result };
}
router.post('/login', async (req, res) => {
    try {
        const { demoUserId } = req.body;
        const demo = getDemoUserById(demoUserId);
        if (!demo) {
            res.status(404).json({ error: 'Demo user not found' });
            return;
        }
        res.json(await ingestDemoUser(demo));
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: String(e) });
    }
});
router.post('/bulk-login', async (req, res) => {
    try {
        const requestedIds = Array.isArray(req.body?.demoUserIds)
            ? req.body.demoUserIds.map((id) => String(id))
            : DEMO_USERS.map((u) => u.id);
        const uniqueIds = [...new Set(requestedIds)].slice(0, 100);
        const selected = uniqueIds
            .map((id) => getDemoUserById(id))
            .filter((u) => !!u);
        if (!selected.length) {
            res.status(400).json({ error: 'No demo users selected' });
            return;
        }
        const results = [];
        for (const demo of selected) {
            try {
                const result = await ingestDemoUser(demo);
                results.push({
                    demoUserId: demo.id,
                    personalNumber: demo.personalNumber,
                    fullName: result.user.fullName,
                    created: result.user.created,
                    updated: result.user.updated,
                    newOrgUnits: result.newOrgUnits ?? result.decisions.filter((d) => d.created).length,
                    reviewCount: result.reviewIds.length,
                });
            }
            catch (e) {
                results.push({
                    demoUserId: demo.id,
                    personalNumber: demo.personalNumber,
                    fullName: `${demo.firstName} ${demo.lastName}`,
                    created: false,
                    updated: false,
                    newOrgUnits: 0,
                    reviewCount: 0,
                    error: String(e),
                });
            }
        }
        res.json({
            requested: selected.length,
            succeeded: results.filter((r) => !r.error).length,
            failed: results.filter((r) => r.error).length,
            newOrgUnits: results.reduce((sum, r) => sum + r.newOrgUnits, 0),
            reviews: results.reduce((sum, r) => sum + r.reviewCount, 0),
            results,
        });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: String(e) });
    }
});

module.exports = router;
