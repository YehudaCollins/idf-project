/** Unify punctuation variants — keep Hebrew geresh/gershayim as canonical (matches seed). */
function unifyPunctuation(value) {
    return value
        .replace(/[\u2018\u2019\u201A\u2032\u2035`´']/g, '\u05F3')
        .replace(/[\u201C\u201D\u201E\u2033\u2036"]/g, '\u05F4')
        .replace(/\s*-\s*/g, ' - ');
}
/** Normalize org segment for matching (lowercase, trim, collapse spaces). */
function normalizeSegment(value) {
    return unifyPunctuation(value)
        .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}
/** Normalize full raw path string (preserves separators structure). */
function normalizeRawPath(raw) {
    return raw
        .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
        .replace(/\\+/g, '/')
        .replace(/\/+/g, '/')
        .trim();
}

module.exports = { normalizeSegment, normalizeRawPath };
