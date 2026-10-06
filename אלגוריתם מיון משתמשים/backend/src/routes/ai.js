const { Router } = require('express');
const { AiDecisionLog, OrgChangeRequest } = require('../models/index');
const alpha = require('../modules/ai/alpha/client');
const { getAlphaAiEnvConfig } = require('../modules/ai/alpha/config');
const { getAiConfig } = require('../modules/ai/config');
const { isAdmin, resolveActor } = require('../modules/auth/demoAuth');
const { pingOpenAi } = require('../modules/ai/providers/openai.client');
const router = Router();
async function probeProvider() {
    const config = getAiConfig();
    if (config.provider === 'mock' || !config.ready) {
        return { connected: false, detail: config.message };
    }
    if (config.provider === 'alpha') {
        const connected = await alpha.pingAlpha();
        return {
            connected,
            detail: connected
                ? `Alpha AI מחובר (${config.model})`
                : `${config.message} — בדיקת /health נכשלה`,
        };
    }
    const connected = await pingOpenAi();
    return {
        connected,
        detail: connected
            ? `OpenAI מחובר (${config.model})`
            : `${config.message} — בדיקת חיבור נכשלה`,
    };
}
router.get('/status', async (_req, res) => {
    const config = getAiConfig();
    const probe = await probeProvider();
    const alphaCfg = getAlphaAiEnvConfig();
    res.json({
        ...config,
        connected: probe.connected,
        message: probe.detail,
        alpha: {
            enabled: alphaCfg.enabled,
            configured: alpha.isEnabled(),
            apiBase: alphaCfg.apiBase,
            model: alphaCfg.model,
            streamEndpoint: alphaCfg.streamEndpoint,
            hasToken: alphaCfg.hasToken,
        },
        features: {
            semanticMatch: config.provider !== 'mock' && config.ready && probe.connected,
            patternLearning: true,
            humanReview: true,
            llmExplain: config.ready && probe.connected,
        },
    });
});
router.get('/alpha/health', async (_req, res) => {
    try {
        if (!alpha.isEnabled()) {
            res.status(503).json({ ok: false, error: 'Alpha AI is not configured' });
            return;
        }
        const result = await alpha.health();
        res.status(result.ok ? 200 : result.status || 502).json(result);
    }
    catch {
        res.status(502).json({ ok: false, error: 'Alpha AI health check failed' });
    }
});
router.get('/alpha/init', async (_req, res) => {
    try {
        if (!alpha.isEnabled()) {
            res.status(503).json({ ok: false, error: 'Alpha AI is not configured' });
            return;
        }
        const result = await alpha.init();
        res.status(result.ok ? 200 : result.status || 502).json(result);
    }
    catch {
        res.status(502).json({ ok: false, error: 'Alpha AI init check failed' });
    }
});
router.post('/alpha/stream', async (req, res) => {
    try {
        const actor = await resolveActor(req);
        if (!isAdmin(actor)) {
            res.status(403).json({ error: 'רק מנהל יכול להפעיל Alpha AI stream' });
            return;
        }
        if (!alpha.isEnabled()) {
            res.status(503).json({ error: 'Alpha AI is not configured' });
            return;
        }
        const messages = Array.isArray(req.body?.messages) ? req.body.messages : null;
        if (!messages) {
            res.status(400).json({ error: 'messages array is required' });
            return;
        }
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();
        const abortController = new AbortController();
        req.on('close', () => abortController.abort());
        const result = await alpha.stream(messages, {
            model: typeof req.body?.model === 'string' ? req.body.model : undefined,
            signal: abortController.signal,
            onToken: (token) => {
                res.write(`data: ${JSON.stringify({ token })}\n\n`);
            },
        });
        res.write(`data: ${JSON.stringify({ done: true, modelUsed: result.modelUsed, eventsCount: result.eventsCount })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
    }
    catch (e) {
        const message = e instanceof Error ? e.message : 'Alpha AI stream failed';
        if (!res.headersSent) {
            res.status(502).json({ error: message });
            return;
        }
        res.write(`data: ${JSON.stringify({ error: { message } })}\n\n`);
        res.end();
    }
});
router.get('/stats', async (_req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [total, todayCount, pendingReviews, byAction] = await Promise.all([
            AiDecisionLog.countDocuments(),
            AiDecisionLog.countDocuments({ createdAt: { $gte: today } }),
            OrgChangeRequest.countDocuments({ status: 'needs_review' }),
            AiDecisionLog.aggregate([
                { $group: { _id: '$action', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
        ]);
        const config = getAiConfig();
        res.json({
            provider: config,
            totalDecisions: total,
            decisionsToday: todayCount,
            pendingReviews,
            byAction: byAction.map((a) => ({ action: a._id, count: a.count })),
        });
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

module.exports = router;
