const { getAiConfig } = require('../config');
const { getOpenAiClient } = require('./openai.client');
const { buildSemanticMatchUserPrompt, parseSemanticMatchJson, SEMANTIC_MATCH_SYSTEM_PROMPT, } = require('../prompts/semanticMatchPrompt');
async function semanticRerank(input) {
    const cfg = getAiConfig();
    if (!cfg.ready || cfg.provider === 'mock' || cfg.provider === 'alpha' || input.candidates.length === 0) {
        return null;
    }
    const openai = getOpenAiClient();
    if (!openai)
        return null;
    try {
        const completion = await openai.chat.completions.create({
            model: cfg.model,
            temperature: 0.1,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: SEMANTIC_MATCH_SYSTEM_PROMPT },
                { role: 'user', content: buildSemanticMatchUserPrompt(input) },
            ],
        });
        const raw = completion.choices[0]?.message?.content;
        if (!raw)
            return null;
        const parsed = parseSemanticMatchJson(raw);
        if (!parsed?.selectedUnitId || parsed.confidence < 0.7)
            return null;
        const valid = input.candidates.some((candidate) => candidate.unitId === parsed.selectedUnitId);
        if (!valid)
            return null;
        return {
            selectedUnitId: parsed.selectedUnitId,
            confidence: Math.min(1, Math.max(0, parsed.confidence)),
            explanation: parsed.explanation || 'התאמה סמנטית (OpenAI)',
            model: cfg.model,
        };
    }
    catch (err) {
        console.error('[OpenAI semanticRerank]', err);
        return null;
    }
}

module.exports = { semanticRerank };
