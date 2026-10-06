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
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isInternalHostname(hostname) {
  const host = hostname.toLowerCase();
  return (
    !host.includes('.') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.corp') ||
    host.endsWith('.idf') ||
    isPrivateIpv4(host) ||
    host.startsWith('fc') ||
    host.startsWith('fd')
  );
}

function isAllowedHost(hostname) {
  const host = hostname.toLowerCase();
  return allowedHosts().some((allowed) => {
    if (allowed.startsWith('.')) return host.endsWith(allowed);
    return host === allowed || host.endsWith(`.${allowed}`);
  });
}

function safeProfileImageUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.startsWith('data:image/')) return text;
  if (text.startsWith('/') && !text.startsWith('//')) return text;
  if (text.startsWith('./') || text.startsWith('../')) return text;

  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    if (isAllowedHost(url.hostname)) return text;
    if (process.env.ALLOW_INTERNAL_PROFILE_IMAGE_URLS !== 'false' && isInternalHostname(url.hostname)) return text;
    return '';
  } catch {
    return '';
  }
}

function createInitialsAvatarDataUri(name, seed = '') {
  const initials = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('') || String(seed || '').slice(-2) || '?';
  const palette = ['0f766e', '334155', '4338ca', '7c2d12', '166534', '7c3aed'];
  const hash = [...String(seed || name || '')].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const color = palette[hash % palette.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="26" fill="#${color}"/><text x="64" y="76" text-anchor="middle" font-size="42" font-family="Arial, sans-serif" font-weight="700" fill="#fff">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

module.exports = {
  createInitialsAvatarDataUri,
  safeProfileImageUrl,
};
