class AlphaAiError extends Error {
    status;
    retryable;
    code;
    constructor(message, options = {}) {
        super(message, { cause: options.cause });
        this.name = 'AlphaAiError';
        this.status = options.status;
        this.retryable = options.retryable ?? false;
        this.code = options.code ?? 'stream';
    }
}
function isAbortError(err) {
    return err instanceof DOMException
        ? err.name === 'AbortError'
        : err instanceof Error && err.name === 'AbortError';
}

module.exports = { AlphaAiError, isAbortError };
