function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : null;
}
function text(value) {
    return typeof value === 'string' ? value : '';
}
/** Extract one text token from an Alpha/OpenAI-compatible SSE JSON payload. */
function extractAlphaStreamToken(payload) {
    const root = asRecord(payload);
    if (!root)
        return '';
    const error = asRecord(root.error);
    if (error?.message) {
        throw new Error(String(error.message));
    }
    const direct = text(root.content);
    if (direct)
        return direct;
    const delta = asRecord(root.delta);
    const deltaText = delta ? text(delta.text) : '';
    if (deltaText)
        return deltaText;
    const contentBlock = asRecord(root.content_block);
    const blockText = contentBlock ? text(contentBlock.text) : '';
    if (blockText)
        return blockText;
    const choices = Array.isArray(root.choices) ? root.choices : [];
    const first = asRecord(choices[0]);
    if (!first)
        return '';
    const choiceDelta = asRecord(first.delta);
    const choiceDeltaContent = choiceDelta ? text(choiceDelta.content) : '';
    if (choiceDeltaContent)
        return choiceDeltaContent;
    const choiceMessage = asRecord(first.message);
    const choiceMessageContent = choiceMessage ? text(choiceMessage.content) : '';
    if (choiceMessageContent)
        return choiceMessageContent;
    if (text(first.text))
        return text(first.text);
    return '';
}
function splitSseEvents(buffer) {
    const normalized = buffer.replace(/\r\n/g, '\n');
    const parts = normalized.split('\n\n');
    const remainder = parts.pop() ?? '';
    const events = parts
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block) => ({
        dataLines: block
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart()),
    }))
        .filter((event) => event.dataLines.length > 0);
    return { events, remainder };
}
function consumeSseDataPayload(dataLines) {
    const payload = dataLines.join('\n').trim();
    if (!payload)
        return { raw: '' };
    if (payload === '[DONE]')
        return 'done';
    try {
        return { json: JSON.parse(payload), raw: payload };
    }
    catch {
        return { raw: payload };
    }
}

module.exports = { extractAlphaStreamToken, splitSseEvents, consumeSseDataPayload };
