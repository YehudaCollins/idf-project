const { AiDecisionLog } = require('../../models/index');
const { getAiConfig, getDecisionSource } = require('../ai/config');
async function logDecision(input) {
    const cfg = getAiConfig();
    return AiDecisionLog.create({
        ...input,
        source: input.source || getDecisionSource(),
        modelVersion: cfg.model,
        createdAt: new Date(),
    });
}

module.exports = { logDecision };
