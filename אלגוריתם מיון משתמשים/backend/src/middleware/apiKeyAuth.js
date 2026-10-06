function getValidKeys() {
    const raw = process.env.EXTERNAL_API_KEYS || process.env.EXTERNAL_API_KEY || '';
    return raw
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
}
function extractApiKey(req) {
    const header = req.headers['x-api-key'];
    if (typeof header === 'string' && header.trim())
        return header.trim();
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer '))
        return auth.slice(7).trim();
    return undefined;
}
function requireApiKey(req, res, next) {
    const keys = getValidKeys();
    if (keys.length === 0) {
        res.status(503).json({
            ok: false,
            error: 'External API disabled — set EXTERNAL_API_KEY in server .env',
        });
        return;
    }
    const provided = extractApiKey(req);
    if (!provided || !keys.includes(provided)) {
        res.status(401).json({ ok: false, error: 'Invalid or missing API key' });
        return;
    }
    next();
}
function getApiKeyHint() {
    const keys = getValidKeys();
    return keys.length > 0 ? 'configured' : 'not_configured';
}

module.exports = { extractApiKey, requireApiKey, getApiKeyHint };
