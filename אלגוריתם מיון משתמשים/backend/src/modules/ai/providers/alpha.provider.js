const { getAiConfig } = require('../config');
const alpha = require('../alpha/client');
const { buildSemanticMatchUserPrompt, parseSemanticMatchJson, SEMANTIC_MATCH_SYSTEM_PROMPT, } = require('../prompts/semanticMatchPrompt');
async function semanticRerankAlpha(input) {
    const cfg = getAiConfig();
    if (!cfg.ready || cfg.provider !== 'alpha' || input.candidates.length === 0) {
        return null;
    }
    try {
        const result = await alpha.ask(buildSemanticMatchUserPrompt(input), {
            system: SEMANTIC_MATCH_SYSTEM_PROMPT,
        });
        const parsed = parseSemanticMatchJson(result.content);
        if (!parsed?.selectedUnitId || parsed.confidence < 0.7)
            return null;
        const valid = input.candidates.some((candidate) => candidate.unitId === parsed.selectedUnitId);
        if (!valid)
            return null;
        return {
            selectedUnitId: parsed.selectedUnitId,
            confidence: Math.min(1, Math.max(0, parsed.confidence)),
            explanation: parsed.explanation || 'התאמה סמנטית (Alpha AI)',
            model: result.modelUsed || cfg.model,
        };
    }
    catch (err) {
        console.error('[Alpha semanticRerank]', err instanceof Error ? err.message : err);
        return null;
    }
}

module.exports = { semanticRerankAlpha };
