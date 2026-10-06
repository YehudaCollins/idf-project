const DEFAULT_ALLOWED_HOSTS = ['localhost', '127.0.0.1', '::1'];
function envList(name) {
    return String(process.env[name] || '')
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
}
function allowedHosts() {
    return [
        ...DEFAULT_ALLOWED_HOSTS,
        ...envList('PROFILE_IMAGE_ALLOWED_HOSTS'),
        ...envList('INTERNAL_IMAGE_ALLOWED_HOSTS'),
    ];
}
function isPrivateIpv4(hostname) {
    const parts = hostname.split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255))
        return false;
    const [a, b] = parts;
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
function isInternalHostname(hostname) {
    const host = hostname.toLowerCase();
    return (!host.includes('.') ||
        host.endsWith('.local') ||
        host.endsWith('.internal') ||
        host.endsWith('.corp') ||
        host.endsWith('.idf') ||
        isPrivateIpv4(host) ||
        host.startsWith('fc') ||
        host.startsWith('fd'));
}
function isAllowedHost(hostname) {
    const host = hostname.toLowerCase();
    return allowedHosts().some((allowed) => {
        if (allowed.startsWith('.'))
            return host.endsWith(allowed);
        return host === allowed || host.endsWith(`.${allowed}`);
    });
}
function safeProfileImageUrl(value) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text)
        return undefined;
    if (text.startsWith('data:image/'))
        return text;
    if (text.startsWith('/') && !text.startsWith('//'))
        return text;
    if (text.startsWith('./') || text.startsWith('../'))
        return text;
    try {
        const url = new URL(text);
        if (url.protocol !== 'http:' && url.protocol !== 'https:')
            return undefined;
        if (isAllowedHost(url.hostname))
            return text;
        if (process.env.ALLOW_INTERNAL_PROFILE_IMAGE_URLS !== 'false' && isInternalHostname(url.hostname))
            return text;
        return undefined;
    }
    catch {
        return undefined;
    }
}

module.exports = { safeProfileImageUrl };
