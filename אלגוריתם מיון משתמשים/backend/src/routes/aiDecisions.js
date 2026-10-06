const { Router } = require('express');
const { AiDecisionLog } = require('../models/index');
const router = Router();
router.get('/', async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 100, 500);
        const action = req.query.action;
        const q = req.query.q;
        const minConfidence = req.query.minConfidence
            ? Number(req.query.minConfidence)
            : undefined;
        const filter = {};
        if (action)
            filter.action = action;
        if (minConfidence != null && !Number.isNaN(minConfidence)) {
            filter.confidence = { $gte: minConfidence };
        }
        if (q?.trim()) {
            const s = q.trim();
            filter.$or = [
                { rawValue: { $regex: s, $options: 'i' } },
                { matchedCanonicalName: { $regex: s, $options: 'i' } },
                { reason: { $regex: s, $options: 'i' } },
            ];
        }
        const logs = await AiDecisionLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
        res.json(logs);
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const log = await AiDecisionLog.findById(req.params.id).lean();
        if (!log) {
            res.status(404).json({ error: 'Decision not found' });
            return;
        }
        res.json(log);
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

module.exports = router;
