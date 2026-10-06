/** Levenshtein distance between two strings. */
function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++)
        dp[i][0] = i;
    for (let j = 0; j <= n; j++)
        dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    return dp[m][n];
}
const DESIGNATOR_ALIASES = [
    { code: '#1', values: ['1', '01', 'א', 'אלף', 'אלפא', 'אחד', 'אחת', 'ראשון', 'ראשונה'] },
    { code: '#2', values: ['2', '02', 'ב', 'בית', 'ביתא', 'בטא', 'בת', 'שני', 'שניה', 'שנייה'] },
    { code: '#3', values: ['3', '03', 'ג', 'גימל', 'גמא', 'שלישי', 'שלישית'] },
    { code: '#4', values: ['4', '04', 'ד', 'דלת', 'רביעי', 'רביעית'] },
    { code: '#5', values: ['5', '05', 'ה', 'הא', 'הי', 'חמישי', 'חמישית'] },
    { code: '#6', values: ['6', '06', 'ו', 'וו', 'ואו', 'ויו', 'שישי', 'שישית'] },
    { code: '#7', values: ['7', '07', 'ז', 'זין', 'זיינ', 'שביעי', 'שביעית'] },
    { code: '#8', values: ['8', '08', 'ח', 'חית', 'חת', 'שמיני', 'שמינית'] },
    { code: '#9', values: ['9', '09', 'ט', 'טית', 'תשיעי', 'תשיעית'] },
    { code: '#10', values: ['10', 'י', 'יוד', 'עשירי', 'עשירית'] },
    { code: '#11', values: ['11', 'יא', 'י״א', 'יא׳', 'אחדעשר', 'אחתעשרה'] },
    { code: '#12', values: ['12', 'יב', 'י״ב', 'יב׳', 'שתיםעשרה', 'שנייםעשר'] },
    { code: '#13', values: ['13', 'יג', 'י״ג', 'יג׳'] },
    { code: '#14', values: ['14', 'יד', 'י״ד', 'יד׳'] },
    { code: '#15', values: ['15', 'טו', 'ט״ו', 'טו׳'] },
    { code: '#16', values: ['16', 'טז', 'ט״ז', 'טז׳'] },
    { code: '#17', values: ['17', 'יז', 'י״ז', 'יז׳'] },
    { code: '#18', values: ['18', 'יח', 'י״ח', 'יח׳'] },
    { code: '#19', values: ['19', 'יט', 'י״ט', 'יט׳'] },
    { code: '#20', values: ['20', 'כ', 'כף', 'עשרים'] },
    { code: '#21', values: ['21', 'כא', 'כ״א', 'כא׳'] },
    { code: '#22', values: ['22', 'כב', 'כ״ב', 'כב׳'] },
    { code: '#23', values: ['23', 'כג', 'כ״ג', 'כג׳'] },
    { code: '#24', values: ['24', 'כד', 'כ״ד', 'כד׳'] },
    { code: '#25', values: ['25', 'כה', 'כ״ה', 'כה׳'] },
    { code: '#26', values: ['26', 'כו', 'כ״ו', 'כו׳'] },
    { code: '#27', values: ['27', 'כז', 'כ״ז', 'כז׳'] },
    { code: '#28', values: ['28', 'כח', 'כ״ח', 'כח׳'] },
    { code: '#29', values: ['29', 'כט', 'כ״ט', 'כט׳'] },
    { code: '#30', values: ['30', 'ל', 'למד', 'שלושים'] },
    { code: '#40', values: ['40', 'מ', 'מם', 'ארבעים'] },
    { code: '#50', values: ['50', 'נ', 'נון', 'חמישים'] },
    { code: '#60', values: ['60', 'ס', 'סמך', 'שישים'] },
    { code: '#70', values: ['70', 'ע', 'עין', 'שבעים'] },
    { code: '#80', values: ['80', 'פ', 'פה', 'פא', 'שמונים'] },
    { code: '#90', values: ['90', 'צ', 'צדי', 'צדיק', 'תשעים'] },
    { code: '#100', values: ['100', 'ק', 'קוף', 'מאה'] },
    { code: '#200', values: ['200', 'ר', 'ריש', 'רייש', 'מאתיים'] },
    { code: '#300', values: ['300', 'ש', 'שין'] },
    { code: '#400', values: ['400', 'ת', 'תו', 'תיו'] },
];
const DESIGNATOR_WORDS = new Map();
for (const item of DESIGNATOR_ALIASES) {
    for (const value of item.values) {
        DESIGNATOR_WORDS.set(value.replace(/["׳״'`´.,:;()[\]{}_-]/g, '').toLowerCase(), item.code);
    }
}
function basicSimilarity(a, b) {
    if (!a && !b)
        return 1;
    if (!a || !b)
        return 0;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0)
        return 1;
    const dist = levenshtein(a, b);
    return 1 - dist / maxLen;
}
function canonicalToken(token) {
    const compacted = token
        .replace(/["׳״'`´.,:;()[\]{}_-]/g, '')
        .trim()
        .toLowerCase();
    return DESIGNATOR_WORDS.get(compacted) ?? compacted;
}
function canonicalPhrase(value) {
    return value
        .replace(/([A-Za-zא-ת])(\d)/g, '$1 $2')
        .replace(/(\d)([A-Za-zא-ת])/g, '$1 $2')
        .split(/\s+/)
        .map(canonicalToken)
        .filter(Boolean)
        .join(' ');
}
function stemToken(token) {
    if (/^#\d+$/.test(token) || token.length <= 4)
        return token;
    const suffixes = ['יות', 'יים', 'ית', 'ים', 'ות', 'ני', 'י', 'ה'];
    for (const suffix of suffixes) {
        if (token.endsWith(suffix) && token.length - suffix.length >= 3) {
            return token.slice(0, -suffix.length);
        }
    }
    return token;
}
function tokenSimilarity(a, b) {
    if (a === b)
        return 1;
    const aDesignator = /^#\d+$/.test(a);
    const bDesignator = /^#\d+$/.test(b);
    if (aDesignator || bDesignator)
        return 0;
    const base = basicSimilarity(a, b);
    const stemmed = basicSimilarity(stemToken(a), stemToken(b));
    return Math.max(base, stemmed);
}
function softTokenSimilarity(a, b) {
    const aTokens = canonicalPhrase(a).split(/\s+/).filter(Boolean);
    const bTokens = canonicalPhrase(b).split(/\s+/).filter(Boolean);
    if (!aTokens.length && !bTokens.length)
        return 1;
    if (!aTokens.length || !bTokens.length)
        return 0;
    const used = new Set();
    let total = 0;
    for (const token of aTokens) {
        let bestIndex = -1;
        let bestScore = 0;
        for (let i = 0; i < bTokens.length; i++) {
            if (used.has(i))
                continue;
            const score = tokenSimilarity(token, bTokens[i]);
            if (score > bestScore) {
                bestScore = score;
                bestIndex = i;
            }
        }
        if (bestIndex >= 0)
            used.add(bestIndex);
        total += bestScore;
    }
    return (2 * total) / (aTokens.length + bTokens.length);
}
function tokenOverlapSimilarity(a, b) {
    const aTokens = canonicalPhrase(a).split(/\s+/).filter(Boolean);
    const bTokens = canonicalPhrase(b).split(/\s+/).filter(Boolean);
    if (!aTokens.length && !bTokens.length)
        return 1;
    if (!aTokens.length || !bTokens.length)
        return 0;
    const remaining = new Map();
    for (const token of bTokens)
        remaining.set(token, (remaining.get(token) ?? 0) + 1);
    let overlap = 0;
    for (const token of aTokens) {
        const count = remaining.get(token) ?? 0;
        if (count <= 0)
            continue;
        overlap++;
        remaining.set(token, count - 1);
    }
    return (2 * overlap) / (aTokens.length + bTokens.length);
}
function isShortDesignator(token) {
    return /^#\d{1,3}$/.test(token) || /^[א-תa-z0-9]{1,2}$/i.test(token);
}
function designatorMismatchCap(a, b) {
    const aTokens = canonicalPhrase(a).split(/\s+/).filter(Boolean);
    const bTokens = canonicalPhrase(b).split(/\s+/).filter(Boolean);
    if (aTokens.length < 2 || aTokens.length !== bTokens.length)
        return null;
    const differentIndexes = aTokens
        .map((token, index) => (token === bTokens[index] ? -1 : index))
        .filter((index) => index >= 0);
    if (differentIndexes.length !== 1)
        return null;
    const index = differentIndexes[0];
    if (isShortDesignator(aTokens[index]) && isShortDesignator(bTokens[index])) {
        return 0.78;
    }
    return null;
}
/** Similarity score 0–1 (1 = identical). Includes small Hebrew org-name normalizations. */
function stringSimilarity(a, b) {
    const base = basicSimilarity(a, b);
    const canonicalA = canonicalPhrase(a);
    const canonicalB = canonicalPhrase(b);
    const canonical = basicSimilarity(canonicalA, canonicalB);
    const tokenOverlap = tokenOverlapSimilarity(a, b);
    const softTokens = softTokenSimilarity(a, b);
    const cap = designatorMismatchCap(a, b);
    return Math.min(Math.max(base, canonical, tokenOverlap, softTokens), cap ?? 1);
}
function computeConfidence(signals) {
    let c = signals.similarity;
    if (signals.hasAlias)
        c = Math.max(c, 0.9);
    if (signals.seenCount >= 3)
        c = Math.min(1, c + 0.05);
    if (signals.hasConflict)
        c *= 0.5;
    return Math.round(c * 1000) / 1000;
}

module.exports = { stringSimilarity, computeConfidence };
