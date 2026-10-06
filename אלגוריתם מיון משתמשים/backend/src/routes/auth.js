const { Router } = require('express');
const { demoActors, publicActor, resolveActor } = require('../modules/auth/demoAuth');
const { loginFromSharePointProfile } = require('../modules/auth/sharePointLogin');
const router = Router();
router.get('/me', async (req, res) => {
    try {
        res.json(publicActor(await resolveActor(req)));
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});
router.get('/demo-actors', async (_req, res) => {
    try {
        res.json(await demoActors());
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});
/**
 * POST /api/auth/microsoft-profile
 * גוף: { sharePointProfile: { ... } } או פרופיל ישיר
 *
 * מזהה את המשתמש לפי SharePoint:
 * - אם קיים → מרענן ומתחבר
 * - אם חדש → שומר דרך ingest ומתחבר
 */
router.post('/microsoft-profile', async (req, res) => {
    try {
        const profile = req.body?.sharePointProfile || req.body?.profile || req.body;
        const result = await loginFromSharePointProfile(profile);
        res.json({
            ok: true,
            actor: publicActor(result.actor),
            created: result.created,
            updated: result.updated,
            ingest: result.ingest
                ? {
                    pathText: result.ingest.pathText,
                    warnings: result.ingest.warnings,
                    user: result.ingest.user,
                }
                : undefined,
        });
    }
    catch (e) {
        const err = e;
        res.status(err.status || 500).json({
            ok: false,
            error: err.message || String(e),
            missing: err.missing,
        });
    }
});

module.exports = router;
