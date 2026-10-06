const SOURCE_SYSTEM_HEADERS = ['x-source-system', 'x-system-name', 'x-integration-name'];
const SOURCE_SYSTEM_BODY_FIELDS = ['sourceSystem', 'sourceSystemName', 'systemName', 'integrationName'];
function normalizeSourceSystem(value) {
    if (typeof value !== 'string')
        return undefined;
    const cleaned = value.trim().replace(/\s+/g, ' ');
    return cleaned || undefined;
}
function sourceSystemFromRequest(req) {
    for (const field of SOURCE_SYSTEM_BODY_FIELDS) {
        const value = normalizeSourceSystem(req.body?.[field]);
        if (value)
            return value;
    }
    for (const header of SOURCE_SYSTEM_HEADERS) {
        const raw = req.headers[header];
        const value = Array.isArray(raw) ? normalizeSourceSystem(raw[0]) : normalizeSourceSystem(raw);
        if (value)
            return value;
    }
    return undefined;
}
function exactSourceSystemRegex(sourceSystem) {
    const escaped = sourceSystem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped}$`, 'i');
}

module.exports = { normalizeSourceSystem, sourceSystemFromRequest, exactSourceSystemRegex };
