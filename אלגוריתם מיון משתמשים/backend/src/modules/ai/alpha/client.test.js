const assert = require('node:assert/strict');
const test = require('node:test');
const { consumeSseDataPayload, extractAlphaStreamToken, splitSseEvents, } = require('./sse');
test('splitSseEvents handles chunk boundaries and [DONE]', () => {
    const part1 = 'data: {"choices":[{"delta":{"content":"hel';
    const part2 = 'lo"}}]}\n\ndata: [DONE]\n\n';
    const first = splitSseEvents(part1);
    assert.equal(first.events.length, 0);
    assert.ok(first.remainder.includes('data:'));
    const second = splitSseEvents(first.remainder + part2);
    assert.equal(second.events.length, 2);
    const payload = consumeSseDataPayload(second.events[0].dataLines);
    assert.notEqual(payload, 'done');
    if (payload !== 'done') {
        const token = extractAlphaStreamToken(payload.json);
        assert.equal(token, 'hello');
    }
    assert.equal(consumeSseDataPayload(second.events[1].dataLines), 'done');
});
test('extractAlphaStreamToken supports multiple payload shapes', () => {
    assert.equal(extractAlphaStreamToken({ choices: [{ delta: { content: 'א' } }] }), 'א');
    assert.equal(extractAlphaStreamToken({ choices: [{ message: { content: 'ב' } }] }), 'ב');
    assert.equal(extractAlphaStreamToken({ choices: [{ text: 'ג' }] }), 'ג');
    assert.equal(extractAlphaStreamToken({ delta: { text: 'ד' } }), 'ד');
    assert.equal(extractAlphaStreamToken({ content_block: { text: 'ה' } }), 'ה');
});
test('extractAlphaStreamToken throws on SSE error payload', () => {
    assert.throws(() => extractAlphaStreamToken({ error: { message: 'stream failed' } }), /stream failed/);
});
test('parseSemanticMatchJson accepts fenced JSON', async () => {
    const { parseSemanticMatchJson } = require('../prompts/semanticMatchPrompt');
    const parsed = parseSemanticMatchJson('```json\n{"selectedUnitId":"u1","confidence":0.91,"explanation":"ok"}\n```');
    assert.equal(parsed?.selectedUnitId, 'u1');
    assert.equal(parsed?.confidence, 0.91);
});
test('mock SSE stream accumulates incrementally', async () => {
    const encoder = new TextEncoder();
    const chunks = [
        'data: {"choices":[{"delta":{"content":"{\\"selectedUnitId\\":\\""}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"abc\\""}}]}\n\n',
        'data: {"choices":[{"delta":{"content":",\\"confidence\\":0.9,\\"explanation\\":\\"התאמה\\"}"}}]}\n\n',
        'data: [DONE]\n\n',
    ];
    let index = 0;
    const body = new ReadableStream({
        pull(controller) {
            if (index >= chunks.length) {
                controller.close();
                return;
            }
            controller.enqueue(encoder.encode(chunks[index++]));
        },
    });
    const response = new Response(body, {
        status: 200,
        headers: { 'X-Proxy-Model': 'jack-auto' },
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => response;
    process.env.ALPHA_AI_ENABLED = 'true';
    process.env.ALPHA_AI_API_BASE = 'https://alphaai.test/api';
    process.env.ALPHA_AI_STREAM_ENDPOINT = '/chat/jack-auto';
    process.env.ALPHA_AI_MODEL = 'jack-auto';
    delete process.env.ALPHA_AI_API_TOKEN;
    const { ask } = require('./client');
    const tokens = [];
    const result = await ask('test prompt', {
        onToken: (token) => tokens.push(token),
    });
    globalThis.fetch = originalFetch;
    assert.equal(result.modelUsed, 'jack-auto');
    assert.ok(result.content.includes('"selectedUnitId":"abc"'));
    assert.ok(tokens.length > 0);
    assert.ok(result.eventsCount >= 3);
});
test('timeout maps to AlphaAiError', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
            const err = new DOMException('Aborted', 'AbortError');
            reject(err);
        });
    });
    process.env.ALPHA_AI_ENABLED = 'true';
    process.env.ALPHA_AI_API_BASE = 'https://alphaai.test/api';
    process.env.ALPHA_AI_STREAM_TIMEOUT_MS = '10';
    const { stream } = require('./client');
    await assert.rejects(() => stream([{ role: 'user', content: 'hello' }]), (err) => err instanceof Error && /timed out|timeout/i.test(err.message));
    globalThis.fetch = originalFetch;
});
