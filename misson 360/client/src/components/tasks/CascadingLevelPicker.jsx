/**
 * בוחר רמות ארגוניות — ללא בחירת אדם.
 * ui=cards — רשימת כפתורים | ui=select — מבנה טפסי כמו UX הדגמה
 */
import { useState, useMemo, useEffect } from 'react';
import clsx from 'clsx';

const LEVEL_KEYS = ['level1', 'level2', 'level3', 'level4', 'level5'];
const LEVEL_NAMES = ['רמה 1', 'רמה 2', 'רמה 3', 'רמה 4', 'רמה 5'];

const selectCls =
  'w-full rounded-lg border border-slate-200/90 bg-slate-100/90 py-2.5 pr-3 pl-3 text-[13px] text-slate-800 shadow-inner focus:border-[#c47f17] focus:outline-none focus:ring-2 focus:ring-[#c47f17]/25 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100';

function uniq(arr) {
  return [...new Set(arr.filter(v => v && v !== '---' && v.trim()))].sort();
}

function levelsToObject(levelKeys, selections) {
  const levelsObj = {};
  LEVEL_KEYS.forEach(k => {
    levelsObj[k] = '';
  });
  levelKeys.forEach((k, i) => {
    if (selections[i]) levelsObj[k] = selections[i];
  });
  return levelsObj;
}

export function CascadingLevelPicker({
  users = [],
  responsibilityLevels = 4,
  onLevelsChange,
  embeddedLevels = null,
  syncKey,
  ui = 'cards',
}) {
  /* מחשבים מהסוף: N רמות = N השדות האחרונים */
  const startIdx = LEVEL_KEYS.length - responsibilityLevels;
  const levelKeys = LEVEL_KEYS.slice(startIdx);
  /* תוויות תמיד 1, 2, 3... (לא 3, 4, 5) */
  const levelNames = levelKeys.map((_, i) => `רמה ${i + 1}`);

  const [selections, setSelections] = useState(() =>
    levelKeys.map(k => (embeddedLevels?.[k] ? embeddedLevels[k] : null)),
  );

  useEffect(() => {
    const si = LEVEL_KEYS.length - responsibilityLevels;
    const keys = LEVEL_KEYS.slice(si);
    setSelections(keys.map(k => embeddedLevels?.[k] || null));
  }, [syncKey, responsibilityLevels, embeddedLevels]);

  const filteredAtStep = useMemo(() => {
    const steps = [];
    let filtered = users;
    for (let i = 0; i < levelKeys.length; i++) {
      const key = levelKeys[i];
      steps.push(filtered);
      const sel = selections[i];
      if (sel) filtered = filtered.filter(u => u[key] === sel);
    }
    steps.push(filtered);
    return steps;
  }, [users, selections, levelKeys]);

  const pushLevels = next => {
    const levelsObj = levelsToObject(levelKeys, next);
    onLevelsChange?.(levelsObj);
  };

  const select = (stepIdx, val) => {
    const next = [...selections];
    next[stepIdx] = val;
    for (let i = stepIdx + 1; i < next.length; i++) next[i] = null;
    setSelections(next);
    pushLevels(next);
  };

  if (ui === 'select') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {levelKeys.map((key, stepIdx) => {
          const opts = uniq(filteredAtStep[stepIdx].map(u => u[key]));
          const sel = selections[stepIdx];
          const isLocked = stepIdx > 0 && !selections[stepIdx - 1];

          return (
            <div key={key} className="min-w-0">
              <label className="mb-1.5 block text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                {levelNames[stepIdx]}
                <span className="text-red-500"> *</span>
              </label>
              <select
                disabled={isLocked || opts.length === 0}
                value={sel || ''}
                onChange={e => select(stepIdx, e.target.value || null)}
                className={clsx(selectCls, (isLocked || opts.length === 0) && 'cursor-not-allowed opacity-60')}
              >
                <option value="">— בחר —</option>
                {opts.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {opts.length === 0 && !isLocked && (
                <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">אין ערכים זמינים לפי המשתמשים</p>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {levelKeys.map((key, stepIdx) => {
        const opts = uniq(filteredAtStep[stepIdx].map(u => u[key]));
        const sel = selections[stepIdx];
        const isLocked = stepIdx > 0 && !selections[stepIdx - 1];

        return (
          <div key={key}>
            <p className="mb-2 text-[12px] font-bold text-slate-500 dark:text-slate-400">{levelNames[stepIdx]}</p>
            <div
              className={clsx(
                'overflow-hidden rounded-xl border transition-all',
                isLocked ? 'border-slate-100 opacity-45 dark:border-slate-800' : 'border-slate-200 dark:border-slate-600',
              )}
            >
              {opts.length === 0 ? (
                <div className="px-3 py-4 text-center text-[13px] text-slate-400">
                  {isLocked ? 'בחר קודם ברמה הקודמת' : 'אין אפשרויות לפי הנתונים'}
                </div>
              ) : (
                opts.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    disabled={isLocked}
                    onClick={() => select(stepIdx, opt === sel ? null : opt)}
                    className={clsx(
                      'w-full border-b border-slate-100 px-3.5 py-2.5 text-right text-[14px] transition-colors last:border-0 dark:border-slate-700',
                      sel === opt
                        ? 'bg-[var(--institutional-light)] font-semibold text-[var(--institutional)] dark:bg-amber-950/40 dark:text-amber-200'
                        : 'text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800/80',
                    )}
                  >
                    {opt}
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })}

      <p className="rounded-xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-[12px] leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
        ההנחיה מיועדת ל<strong className="font-semibold text-slate-700 dark:text-slate-300"> צוות </strong>
        לפי הרמות — אין בחירת אדם ידנית. המערכת תשייך ברקע לצוות הנכון בשמירה.
      </p>
    </div>
  );
}
