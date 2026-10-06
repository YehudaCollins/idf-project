function envText(name) {
    const value = process.env[name];
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
}
function envBool(name, fallback = false) {
    const value = envText(name);
    if (value == null)
        return fallback;
    return value === 'true' || value === '1';
}
function getAiConfig() {
    const provider = (envText('AI_PROVIDER') || 'mock');
    const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());
    const hasAzure = Boolean(process.env.AZURE_OPENAI_ENDPOINT?.trim()) &&
        Boolean(process.env.AZURE_OPENAI_API_KEY?.trim());
    const alphaEnabled = envBool('ALPHA_AI_ENABLED', false);
    const alphaBase = envText('ALPHA_AI_API_BASE') || 'https://alphaai.idf/api';
    const alphaModel = envText('ALPHA_AI_MODEL') || 'jack-auto';
    if (provider === 'alpha') {
        const ready = alphaEnabled && Boolean(alphaBase);
        return {
            provider,
            model: alphaModel,
            enabled: alphaEnabled,
            ready,
            message: ready
                ? 'Alpha AI פעיל — semantic rerank דרך SSE'
                : 'הגדר ALPHA_AI_ENABLED=true ו-ALPHA_AI_API_BASE',
        };
    }
    if (provider === 'openai') {
        return {
            provider,
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            enabled: true,
            ready: hasOpenAiKey,
            message: hasOpenAiKey
                ? 'OpenAI פעיל — semantic rerank ב-ingest'
                : 'חסר OPENAI_API_KEY ב-.env',
        };
    }
    if (provider === 'azure-openai') {
        return {
            provider,
            model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini',
            enabled: true,
            ready: hasAzure,
            message: hasAzure
                ? 'Azure OpenAI מוגדר — ממתין לחיבור inference'
                : 'חסר AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY',
        };
    }
    return {
        provider: 'mock',
        model: 'rule-engine-v1',
        enabled: true,
        ready: true,
        message: 'מנוע כללים (Levenshtein + aliases) — מוכן לדמו',
    };
}
function getDecisionSource() {
    const cfg = getAiConfig();
    if (cfg.provider === 'mock')
        return 'mock-ai';
    if (cfg.ready)
        return cfg.provider;
    return 'mock-ai-fallback';
}

module.exports = { getAiConfig, getDecisionSource };
