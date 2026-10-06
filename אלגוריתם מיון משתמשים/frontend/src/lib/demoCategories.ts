export const DEMO_CATEGORIES = [
  { id: 'all', label: 'הכל' },
  { id: 'clean', label: 'נקי' },
  { id: 'alias', label: 'כינוי' },
  { id: 'fuzzy', label: 'fuzzy' },
  { id: 'missing', label: 'רמה חסרה' },
  { id: 'new_unit', label: 'יחידה חדשה' },
  { id: 'movement', label: 'מעבר' },
  { id: 'normalize', label: 'נורמליזציה' },
] as const;

export const CATEGORY_BADGE: Record<
  string,
  'default' | 'brand' | 'success' | 'warning' | 'danger' | 'info'
> = {
  clean: 'success',
  normalize: 'info',
  typo: 'warning',
  alias: 'brand',
  fuzzy: 'warning',
  missing: 'danger',
  new_unit: 'info',
  movement: 'brand',
  conflict: 'danger',
};

export const CATEGORY_HE: Record<string, string> = {
  clean: 'התאמה נקייה',
  normalize: 'נורמליזציה',
  alias: 'כינוי',
  fuzzy: 'fuzzy',
  missing: 'רמה חסרה',
  new_unit: 'יחידה חדשה',
  movement: 'מעבר',
  conflict: 'קונפליקט',
};

export const CATEGORY_ACCENT: Record<string, string> = {
  clean: 'bg-emerald-500',
  normalize: 'bg-sky-500',
  alias: 'bg-violet-500',
  fuzzy: 'bg-amber-500',
  missing: 'bg-red-500',
  new_unit: 'bg-indigo-500',
  movement: 'bg-teal-500',
  conflict: 'bg-rose-500',
};
