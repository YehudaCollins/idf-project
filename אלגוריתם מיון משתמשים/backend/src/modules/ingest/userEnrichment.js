const { normalizeRawPath } = require('../parser/normalizer');
function pushChange(changes, field, action, value, previous) {
    if (action === 'unchanged')
        return;
    changes.push({ field, action, value, previous });
}
function mergeOptionalString(changes, field, current, incoming) {
    const trimmed = incoming?.trim();
    if (!trimmed)
        return current;
    if (!current) {
        pushChange(changes, field, 'added', trimmed);
        return trimmed;
    }
    if (current !== trimmed) {
        pushChange(changes, field, 'updated', trimmed, current);
        return trimmed;
    }
    return current;
}
function mergeUserProfile(existing, input, rawOrgPath) {
    const changes = [];
    const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`;
    const rank = mergeOptionalString(changes, 'rank', existing?.rank, input.rank);
    const role = mergeOptionalString(changes, 'role', existing?.role, input.role);
    const email = mergeOptionalString(changes, 'email', existing?.email, input.email);
    const phone = mergeOptionalString(changes, 'phone', existing?.phone, input.phone);
    const profileImageUrl = mergeOptionalString(changes, 'profileImageUrl', existing?.profileImageUrl, input.profileImageUrl);
    const sourceSystem = mergeOptionalString(changes, 'sourceSystem', existing?.sourceSystem, input.sourceSystem);
    const incomingSourceSystem = input.sourceSystem?.trim();
    const registeredSourceSystem = existing?.registeredSourceSystem ??
        existing?.sourceSystem ??
        incomingSourceSystem;
    if (!existing?.registeredSourceSystem && registeredSourceSystem) {
        pushChange(changes, 'registeredSourceSystem', 'added', registeredSourceSystem);
    }
    const attributes = {
        ...(existing?.attributes ?? {}),
    };
    if (input.attributes) {
        for (const [key, val] of Object.entries(input.attributes)) {
            const prev = attributes[key];
            if (prev === undefined) {
                pushChange(changes, `attributes.${key}`, 'added', val);
            }
            else if (!sameAttributeValue(prev, val)) {
                pushChange(changes, `attributes.${key}`, 'updated', val, prev);
            }
            attributes[key] = val;
        }
    }
    const knownNames = [...(existing?.knownNames ?? [])];
    const nameKey = fullName.toLowerCase();
    if (!knownNames.some((n) => n.toLowerCase() === nameKey)) {
        knownNames.push(fullName);
        pushChange(changes, 'knownNames', 'added', fullName);
    }
    const rawPaths = [...(existing?.rawPaths ?? [])];
    const normalizedIncoming = normalizeRawPath(rawOrgPath);
    const hasPath = rawPaths.some((p) => normalizeRawPath(p) === normalizedIncoming);
    if (!hasPath) {
        rawPaths.push(rawOrgPath);
        pushChange(changes, 'rawPaths', 'added', rawOrgPath);
    }
    const sources = [...(existing?.sources ?? [])];
    const source = input.source?.trim();
    if (source && !sources.includes(source)) {
        sources.push(source);
        pushChange(changes, 'sources', 'added', source);
    }
    const sourceSystems = [...(existing?.sourceSystems ?? [])];
    for (const system of [existing?.sourceSystem, existing?.registeredSourceSystem, incomingSourceSystem]) {
        const trimmed = system?.trim();
        if (trimmed && !sourceSystems.includes(trimmed)) {
            sourceSystems.push(trimmed);
            pushChange(changes, 'sourceSystems', 'added', trimmed);
        }
    }
    const loginCount = (existing?.loginCount ?? 0) + 1;
    if (existing) {
        if (existing.firstName !== input.firstName.trim()) {
            pushChange(changes, 'firstName', 'updated', input.firstName.trim(), existing.firstName);
        }
        if (existing.lastName !== input.lastName.trim()) {
            pushChange(changes, 'lastName', 'updated', input.lastName.trim(), existing.lastName);
        }
    }
    return {
        changes,
        fullName,
        knownNames,
        rawPaths,
        sources,
        loginCount,
        rank,
        role,
        email,
        phone,
        profileImageUrl,
        sourceSystem,
        registeredSourceSystem,
        sourceSystems,
        attributes,
    };
}
function sameAttributeValue(a, b) {
    if (a === b)
        return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object')
        return false;
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    }
    catch {
        return false;
    }
}

module.exports = { mergeUserProfile };
