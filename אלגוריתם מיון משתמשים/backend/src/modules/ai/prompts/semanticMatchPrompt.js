const SEMANTIC_MATCH_SYSTEM_PROMPT = `You match organizational unit names in an Israeli military (IDF) hierarchy.
Given a raw segment from a login path and candidate units under the same parent, pick the best match.
Rules:
- Prefer exact semantic match over typo similarity.
- If none of the candidates truly match, return selectedUnitId null and confidence below 0.7.
- explanation must be in Hebrew, one short sentence.
Respond ONLY with valid JSON: {"selectedUnitId": string|null, "confidence": number 0-1, "explanation": string}`;
function buildSemanticMatchUserPrompt(input) {
    const candidateList = input.candidates
        .map((candidate, index) => `${index + 1}. id="${candidate.unitId}" name="${candidate.canonicalName}" fuzzyScore=${candidate.score.toFixed(3)}`)
        .join('\n');
    return `הקשר הורה: ${input.parentPathText || 'שורש'}
קטע גולמי מהתחברות: "${input.rawSegment}"
מועמדים:
${candidateList}`;
}
function parseSemanticMatchJson(raw) {
    const trimmed = raw.trim();
    if (!trimmed)
        return null;
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = (fenced?.[1] || trimmed).trim();
    try {
        const parsed = JSON.parse(candidate);
        if (typeof parsed !== 'object' || parsed == null)
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}

module.exports = { buildSemanticMatchUserPrompt, parseSemanticMatchJson, SEMANTIC_MATCH_SYSTEM_PROMPT };
