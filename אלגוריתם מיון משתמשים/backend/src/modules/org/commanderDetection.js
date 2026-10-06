const { normalizeSegment } = require('../parser/normalizer');
const RANK_SCORE = {
    'טוראי': 10,
    'טרש': 11,
    'טר"ש': 11,
    'רבט': 12,
    'רב"ט': 12,
    'סמל': 13,
    'סמר': 14,
    'סמ"ר': 14,
    'רסל': 20,
    'רס"ל': 20,
    'רסר': 21,
    'רס"ר': 21,
    'רסם': 22,
    'רס"ם': 22,
    'רסב': 23,
    'רס"ב': 23,
    'רנמ': 24,
    'רנ"מ': 24,
    'רנג': 25,
    'רנ"ג': 25,
    'סגמ': 30,
    'סג"ם': 30,
    'סגן': 31,
    'סרן': 32,
    'רסן': 33,
    'רס"ן': 33,
    'סאל': 34,
    'סא"ל': 34,
    'אלמ': 35,
    'אל"ם': 35,
    'תאל': 36,
    'תא"ל': 36,
    'אלוף': 37,
    'ראל': 38,
    'רא"ל': 38,
};
const COMMAND_ROLE_ABBREVIATIONS = [
    { values: ['מפקצ'], score: 115, label: 'מפקד צוות' },
    { values: ['ממ'], score: 110, label: 'מפקד מחלקה' },
    { values: ['מפ'], score: 110, label: 'מפקד פלוגה' },
    { values: ['מגד'], score: 110, label: 'מפקד גדוד' },
    { values: ['מחט'], score: 110, label: 'מפקד חטיבה' },
    { values: ['קמד'], score: 105, label: 'קצין מדור' },
    { values: ['רתח'], score: 105, label: 'ראש תחום' },
];
const COMMAND_ROLE_PATTERNS = [
    { pattern: /מפקד(?:ת)?|מפקד\/ת/, score: 120, label: 'תפקיד מפקד מפורש' },
    { pattern: /ראש.*(?:תחום|מדור|צוות|ענף)/, score: 100, label: 'ראש תחום/מדור/צוות' },
    { pattern: /אחראי(?:ת)?|מוביל(?:ת)?/, score: 80, label: 'אחריות מקצועית' },
];
function compact(value) {
    return normalizeSegment(value).replace(/["׳״'\s.-]/g, '');
}
function rankScore(rank) {
    if (!rank)
        return 0;
    const normalized = normalizeSegment(rank);
    const compacted = compact(rank);
    return RANK_SCORE[rank] ?? RANK_SCORE[normalized] ?? RANK_SCORE[compacted] ?? 0;
}
function roleSignal(user) {
    const roleText = user.role ?? '';
    const haystack = `${roleText} ${user.fullName ?? ''}`.trim();
    if (!haystack)
        return { score: 0 };
    const normalized = normalizeSegment(haystack);
    const compacted = compact(haystack);
    const roleTokens = normalizeSegment(roleText)
        .split(/\s+/)
        .map((token) => compact(token))
        .filter(Boolean);
    for (const item of COMMAND_ROLE_ABBREVIATIONS) {
        if (roleTokens.some((token) => item.values.includes(token))) {
            return { score: item.score, reason: item.label };
        }
    }
    for (const item of COMMAND_ROLE_PATTERNS) {
        if (item.pattern.test(`${normalized} ${compacted}`)) {
            return { score: item.score, reason: item.label };
        }
    }
    return { score: 0 };
}
function hasExplicitCommanderSignal(user) {
    return roleSignal(user).score >= 100;
}
function detectUnitCommander(users) {
    if (users.length === 0)
        return null;
    const scored = users
        .map((user) => {
        const role = roleSignal(user);
        const rank = rankScore(user.rank);
        return {
            user,
            roleScore: role.score,
            rankScore: rank,
            total: role.score + rank,
            reason: role.reason,
        };
    })
        .sort((a, b) => b.total - a.total || b.rankScore - a.rankScore || a.user.fullName.localeCompare(b.user.fullName));
    const best = scored[0];
    if (!best || best.total === 0)
        return null;
    const second = scored[1];
    const tie = second && best.total === second.total;
    const confidence = best.roleScore > 0 ? (tie ? 0.75 : 0.9) : (tie ? 0.55 : 0.7);
    return {
        personalNumber: best.user.personalNumber,
        firstName: best.user.firstName,
        lastName: best.user.lastName,
        fullName: best.user.fullName,
        rank: best.user.rank,
        role: best.user.role,
        profileImageUrl: best.user.profileImageUrl,
        confidence,
        reason: best.reason ?? 'הדרגה הגבוהה ביותר ביחידה',
    };
}
function sortUsersForUnitDisplay(users, commander) {
    const commanderPersonalNumber = commander?.personalNumber;
    return [...users].sort((a, b) => {
        if (commanderPersonalNumber) {
            if (a.personalNumber === commanderPersonalNumber)
                return -1;
            if (b.personalNumber === commanderPersonalNumber)
                return 1;
        }
        return rankScore(b.rank) - rankScore(a.rank) || a.fullName.localeCompare(b.fullName);
    });
}

module.exports = { rankScore, hasExplicitCommanderSignal, detectUnitCommander, sortUsersForUnitDisplay };
