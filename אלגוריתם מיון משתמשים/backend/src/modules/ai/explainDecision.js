const { getAiConfig } = require('./config');
/** Human-readable explanation — hook for LLM later. */
function explainDecision(input) {
    const cfg = getAiConfig();
    const pct = Math.round(input.confidence * 100);
    switch (input.action) {
        case 'exact_match':
            return `התאמה מדויקת ל"${input.matchedCanonicalName}" תחת אותו הורה (${pct}%).`;
        case 'alias_match':
            return `זוהה כינוי פעיל ל"${input.matchedCanonicalName}" (${pct}%).`;
        case 'fuzzy_auto':
            return `דמיון גבוה ל"${input.matchedCanonicalName}" — התאמה אוטומטית (${pct}%).`;
        case 'fuzzy_pattern':
            return `דפוס חוזר — קודם לכינוי ל"${input.matchedCanonicalName}" (${pct}%).`;
        case 'semantic_match':
            return input.signals?.llm
                ? cfg.provider === 'alpha'
                    ? `Alpha AI: התאמה סמנטית ל"${input.matchedCanonicalName}" (${pct}%).`
                    : `OpenAI: התאמה סמנטית ל"${input.matchedCanonicalName}" (${pct}%).`
                : `התאמה סמנטית ל"${input.matchedCanonicalName}" (${pct}%).`;
        case 'existing_path_match':
            return `נמצא מסלול קיים שמסביר את הנתיב דרך "${input.matchedCanonicalName}" (${pct}%).`;
        case 'contextual_existing_path_match':
            return `הנתיב תואם למסלול קיים לפי ההקשר הכולל דרך "${input.matchedCanonicalName}" (${pct}%).`;
        case 'fill_existing_path_gap':
            return `הושלמה רמה קיימת במסלול: "${input.matchedCanonicalName}" (${pct}%).`;
        case 'review_existing_path_conflict':
            return `נמצאו כמה מסלולים קיימים דומים — נפתחה ביקורת (${pct}%).`;
        case 'fill_missing_prefix':
            return `הושלמה רמת התחלה חסרה: "${input.matchedCanonicalName}" (${pct}%).`;
        case 'prefix_alignment_match':
            return `הנתיב יושר לעץ הקיים דרך "${input.matchedCanonicalName}" (${pct}%).`;
        case 'review_prefix_alignment_conflict':
            return `נמצאו כמה מסלולים קיימים דומים — נפתחה ביקורת (${pct}%).`;
        case 'fill_missing_level':
            return `הושלמה רמה חסרה באמצע: "${input.matchedCanonicalName}" (${pct}%).`;
        case 'missing_level_match':
            return `נמצאה התאמה בהמשך תת-העץ ל"${input.matchedCanonicalName}" (${pct}%).`;
        case 'review_missing_level_conflict':
            return `נמצאו כמה השלמות אפשריות לרמה חסרה — נפתחה ביקורת (${pct}%).`;
        case 'review_medium':
            return `ביטחון בינוני (${pct}%) — נשלח לביקורת עד 3 הופעות.`;
        case 'review_conflict':
            return `קונפליקט בין מועמדים — נפתחה ביקורת (${pct}%).`;
        case 'create_due_to_conflict':
            return `קונפליקט — נוצרה יחידה זמנית "${input.rawValue}" עד החלטת מנהל.`;
        case 'create_unit':
            return input.signals?.suspectedMissingLevel
                ? `לא נמצאה התאמה בטוחה — ייתכן שחסרה רמה; נוצרה "${input.rawValue}".`
                : `לא נמצאה התאמה — נוצרה יחידה חדשה "${input.rawValue}" (${pct}%).`;
        default:
            return cfg.provider === 'mock'
                ? `החלטת מנוע כללים: ${input.action}`
                : `החלטת AI (${cfg.model}): ${input.action}`;
    }
}

module.exports = { explainDecision };
