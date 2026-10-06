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
function envInt(name, fallback) {
    const value = envText(name);
    if (!value)
        return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function getAlphaAiEnvConfig() {
    const apiBase = (envText('ALPHA_AI_API_BASE') || 'https://alphaai.idf/api').replace(/\/+$/, '');
    const streamEndpoint = envText('ALPHA_AI_STREAM_ENDPOINT') || '/chat/jack-auto';
    const token = envText('ALPHA_AI_API_TOKEN');
    return {
        enabled: envBool('ALPHA_AI_ENABLED', false),
        apiBase,
        model: envText('ALPHA_AI_MODEL') || 'jack-auto',
        streamEndpoint: streamEndpoint.startsWith('/') ? streamEndpoint : `/${streamEndpoint}`,
        timeoutMs: envInt('ALPHA_AI_TIMEOUT_MS', 30_000),
        streamTimeoutMs: envInt('ALPHA_AI_STREAM_TIMEOUT_MS', 120_000),
        hasToken: Boolean(token),
    };
}
function getAlphaStreamUrl() {
    const cfg = getAlphaAiEnvConfig();
    return `${cfg.apiBase}${cfg.streamEndpoint}`;
}
function getAlphaApiToken() {
    return envText('ALPHA_AI_API_TOKEN');
}

module.exports = { getAlphaAiEnvConfig, getAlphaStreamUrl, getAlphaApiToken };
