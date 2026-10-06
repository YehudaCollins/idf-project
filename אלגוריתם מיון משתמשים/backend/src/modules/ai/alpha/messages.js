const { AlphaAiError } = require('./errors');
const ALLOWED_ROLES = new Set(['system', 'user', 'assistant']);
function normalizeAlphaMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new AlphaAiError('At least one message is required', { code: 'validation' });
    }
    const normalized = messages.map((message, index) => {
        const role = String(message?.role || '').trim().toLowerCase();
        const content = String(message?.content ?? '').trim();
        if (!ALLOWED_ROLES.has(role)) {
            throw new AlphaAiError(`Invalid role at message ${index}`, { code: 'validation' });
        }
        return { role, content };
    });
    if (!normalized.some((message) => message.content.length > 0)) {
        throw new AlphaAiError('At least one message must contain non-empty text', { code: 'validation' });
    }
    return normalized;
}

module.exports = { normalizeAlphaMessages };
