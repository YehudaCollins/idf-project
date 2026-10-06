const { getAlphaAiEnvConfig, getAlphaApiToken, getAlphaStreamUrl } = require('./config');
const { AlphaAiError, isAbortError } = require('./errors');
const { normalizeAlphaMessages } = require('./messages');
const { consumeSseDataPayload, extractAlphaStreamToken, splitSseEvents } = require('./sse');
function buildAuthHeaders() {
    const token = getAlphaApiToken();
    return token ? { 'x-api-token': token } : {};
}
async function readErrorBody(response) {
    const contentType = response.headers.get('content-type') || '';
    try {
        if (contentType.includes('application/json')) {
            const json = await response.json();
            const message = typeof json?.message === 'string'
                ? json.message
                : typeof json?.error === 'string'
                    ? json.error
                    : JSON.stringify(json);
            return message;
        }
        return await response.text();
    }
    catch {
        return response.statusText || 'Request failed';
    }
}
function mapHttpError(status, message) {
    if (status === 401 || status === 403) {
        return new AlphaAiError('Alpha AI authorization failed', {
            status,
            code: 'auth',
            retryable: false,
        });
    }
    if (status === 429) {
        return new AlphaAiError('Alpha AI rate limit reached', {
            status,
            code: 'rate_limit',
            retryable: true,
        });
    }
    if (status >= 500) {
        return new AlphaAiError('Alpha AI gateway failure', {
            status,
            code: 'server',
            retryable: true,
        });
    }
    return new AlphaAiError(message || `Alpha AI request failed (${status})`, {
        status,
        code: 'stream',
        retryable: false,
    });
}
async function alphaGet(path, timeoutMs) {
    const cfg = getAlphaAiEnvConfig();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${cfg.apiBase}${path}`, {
            method: 'GET',
            headers: buildAuthHeaders(),
            signal: controller.signal,
        });
        const contentType = response.headers.get('content-type') || '';
        let body = undefined;
        if (contentType.includes('application/json')) {
            body = await response.json().catch(() => undefined);
        }
        else {
            const text = await response.text().catch(() => '');
            body = text || undefined;
        }
        return { ok: response.ok, status: response.status, body };
    }
    catch (err) {
        if (isAbortError(err)) {
            throw new AlphaAiError('Alpha AI request timed out', { code: 'timeout', retryable: true, cause: err });
        }
        throw new AlphaAiError('Alpha AI connection error', { code: 'network', retryable: true, cause: err });
    }
    finally {
        clearTimeout(timer);
    }
}
function isEnabled() {
    const cfg = getAlphaAiEnvConfig();
    return cfg.enabled && Boolean(cfg.apiBase) && Boolean(cfg.streamEndpoint);
}
async function health() {
    if (!isEnabled()) {
        return { ok: false, status: 0, body: 'Alpha AI is not enabled' };
    }
    return alphaGet('/health', getAlphaAiEnvConfig().timeoutMs);
}
async function init() {
    if (!isEnabled()) {
        return { ok: false, status: 0, body: 'Alpha AI is not enabled' };
    }
    return alphaGet('/init', getAlphaAiEnvConfig().timeoutMs);
}
async function stream(messages, options = {}) {
    if (!isEnabled()) {
        throw new AlphaAiError('Alpha AI is not configured', { code: 'validation' });
    }
    const cfg = getAlphaAiEnvConfig();
    const normalized = normalizeAlphaMessages(messages);
    const model = options.model || cfg.model;
    const timeoutMs = options.timeoutMs ?? cfg.streamTimeoutMs;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const externalSignal = options.signal;
    if (externalSignal) {
        if (externalSignal.aborted)
            controller.abort();
        else
            externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    let response;
    try {
        response = await fetch(getAlphaStreamUrl(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...buildAuthHeaders(),
            },
            body: JSON.stringify({
                messages: normalized,
                stream: true,
                model,
            }),
            signal: controller.signal,
        });
    }
    catch (err) {
        if (isAbortError(err)) {
            if (externalSignal?.aborted) {
                throw new AlphaAiError('Request cancelled', { code: 'cancelled', retryable: false, cause: err });
            }
            throw new AlphaAiError('Alpha AI stream timed out', { code: 'timeout', retryable: true, cause: err });
        }
        throw new AlphaAiError('Alpha AI connection error', { code: 'network', retryable: true, cause: err });
    }
    finally {
        clearTimeout(timeout);
    }
    if (!response.ok) {
        const message = await readErrorBody(response);
        throw mapHttpError(response.status, message);
    }
    const modelUsed = response.headers.get('X-Proxy-Model') || model;
    const reader = response.body?.getReader();
    if (!reader) {
        throw new AlphaAiError('Alpha AI returned an empty stream', { code: 'stream' });
    }
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let eventsCount = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const parsed = splitSseEvents(buffer);
            buffer = parsed.remainder;
            for (const event of parsed.events) {
                eventsCount += 1;
                const payload = consumeSseDataPayload(event.dataLines);
                if (payload === 'done') {
                    return { modelUsed, content, eventsCount };
                }
                if (payload.json != null) {
                    const token = extractAlphaStreamToken(payload.json);
                    if (token) {
                        content += token;
                        options.onToken?.(token, content);
                    }
                    continue;
                }
                if (payload.raw) {
                    content += payload.raw;
                    options.onToken?.(payload.raw, content);
                }
            }
        }
        if (buffer.trim()) {
            const trailing = splitSseEvents(`${buffer}\n\n`);
            for (const event of trailing.events) {
                eventsCount += 1;
                const payload = consumeSseDataPayload(event.dataLines);
                if (payload === 'done')
                    break;
                if (payload.json != null) {
                    const token = extractAlphaStreamToken(payload.json);
                    if (token) {
                        content += token;
                        options.onToken?.(token, content);
                    }
                }
                else if (payload.raw) {
                    content += payload.raw;
                    options.onToken?.(payload.raw, content);
                }
            }
        }
        return { modelUsed, content, eventsCount };
    }
    catch (err) {
        if (err instanceof AlphaAiError)
            throw err;
        if (isAbortError(err)) {
            if (externalSignal?.aborted) {
                throw new AlphaAiError('Request cancelled', { code: 'cancelled', retryable: false, cause: err });
            }
            throw new AlphaAiError('Alpha AI stream timed out', { code: 'timeout', retryable: true, cause: err });
        }
        if (err instanceof Error) {
            throw new AlphaAiError('Alpha AI stream failed', { code: 'stream', retryable: false, cause: err });
        }
        throw err;
    }
    finally {
        reader.releaseLock();
    }
}
async function ask(prompt, options = {}) {
    const messages = [];
    if (options.system?.trim()) {
        messages.push({ role: 'system', content: options.system.trim() });
    }
    messages.push({ role: 'user', content: prompt.trim() });
    return stream(messages, options);
}
async function pingAlpha() {
    if (!isEnabled())
        return false;
    try {
        const result = await health();
        return result.ok;
    }
    catch {
        return false;
    }
}

module.exports = { isEnabled, health, init, stream, ask, pingAlpha };
