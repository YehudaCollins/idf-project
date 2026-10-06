function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isInternalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
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

export function safeImageSrc(value?: string): string {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.startsWith('data:image/')) return text;
  if (text.startsWith('/') && !text.startsWith('//')) return text;
  if (text.startsWith('./') || text.startsWith('../')) return text;

  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return isInternalHostname(url.hostname) ? text : '';
  } catch {
    return '';
  }
}
