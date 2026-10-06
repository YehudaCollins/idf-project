const ACTION_LABELS: Record<string, string> = {
  exact_match: 'התאמה מדויקת',
  alias_match: 'התאמה בכינוי',
  fuzzy_auto: 'fuzzy אוטומטי',
  fuzzy_pattern: 'דפוס חוזר',
  semantic_match: 'OpenAI סמנטי',
  review_conflict: 'ביקורת — קונפליקט',
  review_medium: 'ביקורת — ביטחון בינוני',
  create_unit: 'יצירת יחידה',
  create_due_to_conflict: 'יצירה בגלל קונפליקט',
  org_match: 'התאמת יחידה',
  admin_approved: 'אושר ע"י מנהל',
  admin_rejected: 'נדחה ע"י מנהל',
};

export function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return parts[0][0] + parts[parts.length - 1][0];
  return name.slice(0, 2);
}

export function confidenceVariant(confidence: number): 'success' | 'warning' | 'danger' | 'default' {
  if (confidence >= 0.95) return 'success';
  if (confidence >= 0.85) return 'warning';
  if (confidence >= 0.7) return 'default';
  return 'danger';
}
