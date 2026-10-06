const { normalizeRawPath, normalizeSegment } = require('./normalizer');
function buildNameVariants(firstName, lastName, knownNames = []) {
    const variants = new Set();
    const add = (s) => {
        const n = normalizeSegment(s);
        if (n)
            variants.add(n);
    };
    add(`${firstName} ${lastName}`);
    add(`${lastName} ${firstName}`);
    add(firstName);
    add(lastName);
    for (const name of knownNames)
        add(name);
    return [...variants];
}
function segmentMatchesName(segment, nameVariants) {
    const norm = normalizeSegment(segment);
    if (nameVariants.includes(norm))
        return true;
    const hyphenParts = segment.split(/\s*-\s*/);
    if (hyphenParts.length >= 2) {
        const namePart = hyphenParts.slice(1).join(' ').trim();
        if (nameVariants.includes(normalizeSegment(namePart)))
            return true;
    }
    return false;
}
function stripUserFromSegment(segment, nameVariants) {
    if (segmentMatchesName(segment, nameVariants)) {
        return { org: null, removed: true };
    }
    const hyphenIdx = segment.search(/\s*-\s*/);
    if (hyphenIdx > 0) {
        const orgPart = segment.slice(0, hyphenIdx).trim();
        const namePart = segment.slice(hyphenIdx).replace(/^\s*-\s*/, '').trim();
        if (segmentMatchesName(namePart, nameVariants)) {
            return { org: orgPart || null, removed: true };
        }
    }
    return { org: segment, removed: false };
}
function compactIdentifier(value) {
    return normalizeSegment(value).replace(/[^a-z0-9]/gi, '');
}
function isPersonalIdentifierSegment(segment, personalNumber) {
    const normalized = normalizeSegment(segment);
    if (!normalized)
        return false;
    const compacted = compactIdentifier(segment);
    if (personalNumber && compacted === compactIdentifier(personalNumber))
        return true;
    if (/^[a-z]\d{6,9}$/i.test(compacted))
        return true;
    const hasHebrew = /[\u0590-\u05FF]/.test(normalized);
    const digits = normalized.replace(/\D/g, '');
    const latinOrNumericOnly = /^[a-z0-9\s_.-]+$/i.test(normalized);
    return !hasHebrew && latinOrNumericOnly && digits.length >= 6;
}
function parseOrgPath(rawOrgPath, optionsOrFirst, lastNameArg) {
    const options = typeof optionsOrFirst === 'string'
        ? { firstName: optionsOrFirst, lastName: lastNameArg ?? '' }
        : optionsOrFirst;
    const { firstName, lastName, personalNumber, knownNames = [] } = options;
    const nameVariants = buildNameVariants(firstName, lastName, knownNames);
    const normalizedPath = normalizeRawPath(rawOrgPath);
    const parts = normalizedPath
        .split('/')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    let userNameRemoved = false;
    let userIdentifierRemoved = false;
    let extractedPersonalNumber;
    const segments = [];
    const strippedFromSegments = [];
    for (let i = 0; i < parts.length; i++) {
        const isLast = i === parts.length - 1;
        if (isPersonalIdentifierSegment(parts[i], personalNumber)) {
            userIdentifierRemoved = true;
            extractedPersonalNumber = parts[i].trim();
            strippedFromSegments.push(i);
            continue;
        }
        const { org, removed } = stripUserFromSegment(parts[i], nameVariants);
        if (removed) {
            userNameRemoved = true;
            strippedFromSegments.push(i);
            if (org)
                segments.push(org);
            continue;
        }
        // בקטע אחרון — ניסיון נוסף; באמצע — הסר רק אם זה בדיוק שם
        if (isLast && org) {
            segments.push(org);
        }
        else if (!isLast) {
            if (segmentMatchesName(parts[i], nameVariants)) {
                userNameRemoved = true;
                strippedFromSegments.push(i);
            }
            else {
                segments.push(parts[i]);
            }
        }
    }
    const normalizedSegments = segments.map((s) => normalizeSegment(s));
    return {
        rawOrgPath,
        normalizedPath,
        segments,
        normalizedSegments,
        userNameRemoved,
        userIdentifierRemoved,
        extractedPersonalNumber,
        suspectedMissingLevel: false,
        strippedFromSegments,
    };
}

module.exports = { isPersonalIdentifierSegment, parseOrgPath };
