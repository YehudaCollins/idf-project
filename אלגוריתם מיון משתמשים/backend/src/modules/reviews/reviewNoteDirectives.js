const FIELD_LABELS = {
    canonicalName: ['שם', 'שם יחידה', 'שם חדש', 'name', 'canonicalName'],
    unitType: ['סוג', 'סוג יחידה', 'type'],
    aliasValue: ['כינוי', 'alias', 'כינוי ראשי'],
    targetUnitQuery: ['יעד', 'יחידת יעד', 'יחידה', 'target', 'unit'],
    commanderQuery: ['מפקד', 'מפקדת', 'commander'],
    commanderPersonalNumber: ['מספר אישי מפקד', 'חוגר מפקד', 'commanderPersonalNumber'],
};
function cleanValue(value) {
    const cleaned = value
        .trim()
        .replace(/^["'״“”]+|["'״“”]+$/g, '')
        .replace(/\s+/g, ' ');
    return cleaned || undefined;
}
function splitList(value) {
    return value
        .split(/[,\n;|]+/)
        .map((part) => cleanValue(part))
        .filter((part) => !!part);
}
function fieldRegex(label) {
    return new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:=：-]\\s*(.+)$`, 'i');
}
function matchLineFields(note, directives) {
    for (const line of note.split(/\r?\n/)) {
        for (const [field, labels] of Object.entries(FIELD_LABELS)) {
            for (const label of labels) {
                const match = line.match(fieldRegex(label));
                if (!match)
                    continue;
                const value = cleanValue(match[1]);
                if (!value)
                    continue;
                directives[field] = value;
                directives.actions.push(`${field}:${value}`);
            }
        }
        const aliasesMatch = line.match(/^\s*(?:כינויים|aliases|כינוי נוסף)\s*[:=：-]\s*(.+)$/i);
        if (aliasesMatch) {
            const aliases = splitList(aliasesMatch[1]);
            directives.extraAliases.push(...aliases);
            if (aliases.length)
                directives.actions.push(`extraAliases:${aliases.join(', ')}`);
        }
    }
}
function firstSentenceValue(note, patterns) {
    for (const pattern of patterns) {
        const match = note.match(pattern);
        const value = match?.[1]?.split(/[.;\n]/)[0];
        const cleaned = value ? cleanValue(value) : undefined;
        if (cleaned)
            return cleaned;
    }
    return undefined;
}
function parseReviewNoteDirectives(note) {
    const directives = { extraAliases: [], actions: [] };
    const cleanNote = cleanValue(note ?? '');
    if (!cleanNote)
        return directives;
    matchLineFields(note ?? '', directives);
    directives.canonicalName ??= firstSentenceValue(cleanNote, [
        /(?:שם היחידה|שם חדש|לשנות את השם ל|שנה את השם ל|תקרא לזה|תקרא לה|קרא לזה|קרא לה)\s+["'״“”]?([^"'״“”\n.]+)/i,
    ]);
    directives.aliasValue ??= firstSentenceValue(cleanNote, [
        /(?:כינוי|תוסיף כינוי|הכינוי הוא|alias)\s+["'״“”]?([^"'״“”\n.]+)/i,
    ]);
    directives.targetUnitQuery ??= firstSentenceValue(cleanNote, [
        /(?:היעד הוא|יחידת היעד היא|תעביר ל|שייך ל|שייך אל|שים ב|החל על)\s+["'״“”]?([^"'״“”\n.]+)/i,
        /(?:זה|זו|הכוונה|אמור להיות|צריך להיות)\s+(?:ב|ל|אל)?\s*["'״“”]?([^"'״“”\n.]+)/i,
    ]);
    directives.commanderQuery ??= firstSentenceValue(cleanNote, [
        /(?:המפקד הוא|מפקד הוא|מפקד חדש|מפקד)\s+["'״“”]?([^"'״“”\n.]+)/i,
    ]);
    directives.commanderPersonalNumber ??= cleanNote.match(/\b[cC]?\d{6,10}\b/)?.[0];
    if (directives.canonicalName)
        directives.actions.push(`canonicalName:${directives.canonicalName}`);
    if (directives.aliasValue)
        directives.actions.push(`aliasValue:${directives.aliasValue}`);
    if (directives.targetUnitQuery)
        directives.actions.push(`targetUnitQuery:${directives.targetUnitQuery}`);
    if (directives.commanderQuery)
        directives.actions.push(`commanderQuery:${directives.commanderQuery}`);
    if (directives.commanderPersonalNumber)
        directives.actions.push(`commanderPersonalNumber:${directives.commanderPersonalNumber}`);
    directives.createNew = /(?:צור יחידה|תיצור יחידה|צור חדש|תיצור חדש|יחידה חדשה|לא קיים|לא קיימת|אין יחידה קיימת)/i.test(cleanNote);
    if (directives.createNew)
        directives.actions.push('createNew');
    directives.actions = [...new Set(directives.actions)];
    return directives;
}

module.exports = { parseReviewNoteDirectives };
