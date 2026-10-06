import clsx from 'clsx';
import {
  Plus, Send, Check, X, Bell, Clock,
  FileText,
  ChevronRight,
  Pencil,
} from 'lucide-react';

export const ACCENT = 'var(--institutional)';

/** סטטוסים — תצוגת מנהל */
export const STATUS_ADMIN = {
  pending:          { label: 'ממתין',           ring: 'ring-slate-200',    bg: 'bg-slate-100 dark:bg-slate-800/80',    text: 'text-slate-700 dark:text-slate-200',    dot: 'bg-slate-400' },
  in_progress:      { label: 'בתהליך',          ring: 'ring-amber-200',    bg: 'bg-amber-50 dark:bg-amber-950/40',    text: 'text-amber-900 dark:text-amber-200',    dot: 'bg-amber-500' },
  waiting_approval: { label: 'ממתין לאישור',    ring: 'ring-blue-200',    bg: 'bg-blue-50 dark:bg-blue-950/40',     text: 'text-blue-900 dark:text-blue-200',     dot: 'bg-blue-500' },
  completed:        { label: 'אושר',            ring: 'ring-emerald-200', bg: 'bg-emerald-50 dark:bg-emerald-950/40',  text: 'text-emerald-800 dark:text-emerald-200', dot: 'bg-emerald-500' },
  overdue:          { label: 'בחריגה',          ring: 'ring-red-200',     bg: 'bg-red-50 dark:bg-red-950/40',       text: 'text-red-800 dark:text-red-200',       dot: 'bg-red-500' },
  rejected:         { label: 'נדחה',            ring: 'ring-red-200',     bg: 'bg-red-50 dark:bg-red-950/40',       text: 'text-red-800 dark:text-red-200',       dot: 'bg-red-500' },
};

/** סטטוסים — תצוגת איש צוות (הנחיות שלי) */
export const STATUS_ME = {
  pending:          { ...STATUS_ADMIN.pending,          label: 'לביצוע',        tip: 'דווח סיום כשהושלם' },
  in_progress:      { ...STATUS_ADMIN.in_progress,      label: 'בתהליך',        tip: 'בביצוע' },
  waiting_approval: { ...STATUS_ADMIN.waiting_approval, label: 'ממתין לאישור', tip: 'הגשת — המנהל מאשר' },
  completed:        { ...STATUS_ADMIN.completed,        label: 'אושרה',         tip: 'הושלמה בהצלחה' },
  overdue:          { ...STATUS_ADMIN.overdue,            label: 'בחריגה',       tip: 'חרגת מתג"ב' },
  rejected:         { ...STATUS_ADMIN.rejected,         label: 'נדחתה',         tip: 'קרא את הסיבה ושלח שוב' },
};

export const fmt = d => d ? new Date(d).toLocaleDateString('he-IL') : '—';
export const fmtFull = d =>
  d
    ? new Date(d).toLocaleDateString('he-IL', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

export function normalizeCustomFields(task) {
  const cf = task?.customFields;
  if (!cf) return {};
  if (typeof cf === 'object' && !Array.isArray(cf)) return { ...cf };
  return {};
}

/** שיוך להצגה — רק מסלול צוות (רמות) ותפקיד רלוונטי; בלי שם אדם */
export function teamAssignmentLabel(task) {
  if (!task) return '—';
  const parts = [task.level1, task.level2, task.level3, task.level4, task.level5].filter(Boolean);
  if (parts.length) return parts.join(' / ');
  if (task.targetRole?.trim()) return task.targetRole.trim();
  return '—';
}

/** תגית דחיפות תג"ב */
export function DueUrgency({ dueDate, status }) {
  if (!dueDate || status === 'completed') return <span className="text-[11px] text-slate-400 dark:text-slate-500">—</span>;
  const days = Math.ceil((new Date(dueDate) - new Date()) / 86400000);
  if (days < 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-950/50 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:text-red-300">
        {Math.abs(days)}d בחריגה
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-950/50 px-2 py-0.5 text-[11px] font-bold text-orange-800 dark:text-orange-200">
        היום
      </span>
    );
  }
  if (days <= 3) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:text-amber-200">
        {days} ימים
      </span>
    );
  }
  return <span className="text-[11px] text-slate-500 dark:text-slate-400">{days} ימים</span>;
}

export function InstructionStatusBadge({ status, map = STATUS_ADMIN, size = 'sm', onDark }) {
  const s = map[status] || map.pending;
  const sz = size === 'lg' ? 'px-3 py-1.5 text-[13px] gap-2' : 'px-2.5 py-1 text-[11px] gap-1.5';

  if (onDark) {
    return (
      <span
        className={clsx(
          'inline-flex items-center font-semibold rounded-lg border border-white/20 bg-white/10 text-white shadow-sm backdrop-blur-sm',
          sz,
        )}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#f0c040] shadow-[0_0_8px_rgba(240,192,64,0.5)]" />
        {s.label}
      </span>
    );
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center font-semibold rounded-lg ring-1',
        sz,
        s.ring,
        s.bg,
        s.text,
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', s.dot)} />
      {s.label}
    </span>
  );
}

/** מסלול שיוך — טקסט אחד עם לוכסנים (למשל: חטיבת ההפעלה / מטה פיקוד / אלפא) */
export function LevelsTrack({ task }) {
  const parts = [task.level1, task.level2, task.level3, task.level4, task.level5].filter(Boolean);
  if (!parts.length && !task.targetRole) return null;

  const path = parts.join(' / ');

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-l from-white via-slate-50/50 to-white shadow-sm dark:border-slate-600/40 dark:from-slate-800/60 dark:via-slate-900/30 dark:to-slate-900/40">
      <div className="absolute inset-y-3 right-0 w-1 rounded-full bg-gradient-to-b from-[#d4a012] via-[#c47f17] to-[#8f5c0f] opacity-90" aria-hidden />
      <div className="px-5 py-4 pr-5">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#a0660e] dark:text-[#f0c040]/90">
          <span className="h-px w-6 bg-gradient-to-l from-transparent to-[#c47f17]/60" />
          הצוות שאליו שויך
        </div>
        <p className="pl-1 text-[15px] font-semibold leading-relaxed text-slate-900 dark:text-slate-50">
          {path || <span className="font-normal text-slate-400">לא הוגדרו רמות</span>}
          {task.targetRole && (
            <>
              {path ? <span className="font-normal text-slate-400 dark:text-slate-500"> · </span> : null}
              <span className="font-medium text-slate-600 dark:text-slate-300">תפקיד רלוונטי: {task.targetRole}</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/** שדות דינמיים לפי תבנית */
export function CustomFieldsSection({ task, template }) {
  const cols = template?.customColumns ?? [];
  const map = normalizeCustomFields(task);
  const entries = cols.map(c => ({ ...c, val: map[c.id] })).filter(x => x.val);

  if (!entries.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-gradient-to-l from-transparent via-slate-200 to-slate-300 dark:via-slate-600 dark:to-slate-500" />
        <div className="flex shrink-0 items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          <FileText className="h-4 w-4 text-[#c47f17]" />
          שדות נוספים
        </div>
        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-slate-300 dark:via-slate-600 dark:to-slate-500" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {entries.map(({ id, label, val }) => (
          <div
            key={id}
            className="group rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3.5 shadow-sm transition hover:border-[#c47f17]/25 hover:shadow-md dark:border-slate-700/80 dark:bg-slate-900/50 dark:hover:border-amber-800/40"
          >
            <div className="mb-1.5 text-[11px] font-bold text-[#b45309] dark:text-[#f0c040]/90">{label}</div>
            <div className="text-[14px] leading-relaxed text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const ACTION_LABELS = {
  created: 'נוצרה',
  submitted: 'הוגשה',
  approved: 'אושרה',
  rejected: 'נדחתה',
  reminder: 'תזכורת',
  edited: 'נערכה',
};

const HISTORY_CFG = {
  created:   { icon: Plus,   color: 'text-slate-500',  bg: 'bg-slate-100 dark:bg-slate-800' },
  submitted: { icon: Send,   color: 'text-blue-600',   bg: 'bg-blue-100 dark:bg-blue-950/50' },
  approved:  { icon: Check,  color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-950/50' },
  rejected:  { icon: X,      color: 'text-red-600',    bg: 'bg-red-100 dark:bg-red-950/50' },
  reminder:  { icon: Bell,   color: 'text-amber-600',  bg: 'bg-amber-100 dark:bg-amber-950/50' },
  edited:    { icon: Pencil, color: 'text-violet-600',  bg: 'bg-violet-100 dark:bg-violet-950/50' },
};

export function HistoryTimeline({ history }) {
  const list = [...(history || [])];
  if (!list.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/40 p-4 dark:border-slate-700/60 dark:bg-slate-900/25 sm:p-5">
      <div className="mb-4 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-slate-800">
          <Clock className="h-4 w-4 text-[#c47f17]" />
        </div>
        היסטוריית פעולות
      </div>
      <div className="max-h-[min(320px,42svh)] space-y-0 overflow-y-auto overscroll-contain pr-1">
        {list.map((h, i) => {
          const cfg = HISTORY_CFG[h.action] || { icon: Clock, color: 'text-slate-500', bg: 'bg-slate-100' };
          const Icon = cfg.icon;
          return (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={clsx('flex h-8 w-8 items-center justify-center rounded-full', cfg.bg)}>
                  <Icon className={clsx('h-3.5 w-3.5', cfg.color)} />
                </div>
                {i < list.length - 1 && <div className="my-1 w-px flex-1 bg-slate-200 dark:bg-slate-700" />}
              </div>
              <div className={clsx('min-w-0 flex-1', i < list.length - 1 ? 'pb-4' : '')}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {ACTION_LABELS[h.action] || h.action}
                  </span>
                  {h.byName && <span className="text-slate-400">· {h.byName}</span>}
                  <span className="text-slate-400 text-[11px]">{fmtFull(h.at)}</span>
                </div>
                {h.note ? (
                  <p className="mt-1.5 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 px-3 py-2 text-[12px] text-slate-600 dark:text-slate-300">
                    {h.note}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** כרטיס מטא — רשת אחידה */
export function MetaTile({ icon: Icon, label, children, highlight, className }) {
  return (
    <div
      className={clsx(
        'rounded-2xl border p-4 transition-all duration-200',
        highlight
          ? 'border-[#c47f17]/40 bg-[var(--institutional-light)] shadow-sm dark:bg-amber-950/25'
          : 'border-slate-200/80 bg-white shadow-sm hover:border-slate-300/80 dark:border-slate-700/80 dark:bg-slate-900/45 dark:hover:border-slate-600',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-[#b8860b] dark:border-slate-600 dark:bg-slate-800 dark:text-[#f0c040]">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</div>
          <div className="text-[15px] font-semibold leading-snug text-slate-900 dark:text-slate-50">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function PanelChrome({ children, className }) {
  return (
    <div
      className={clsx(
        'flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl',
        'border border-slate-200/70 dark:border-slate-700/50',
        'bg-[var(--paper)] dark:bg-[#0c0c0e]',
        'shadow-[0_12px_48px_-12px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_56px_-8px_rgba(0,0,0,0.65)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

const PANEL_HEADER_GRADIENT = {
  brand: 'from-[#7a4a12] via-[#4a2e0c] to-[#1e1408]',
  danger: 'from-[#6b2418] via-[#4a180f] to-[#1a0c08]',
  info: 'from-[#355a6b] via-[#2a3d4a] to-[#141210]',
  success: 'from-[#2d5a38] via-[#1e3d26] to-[#10180e]',
};

/**
 * כותרת פאנל הנחיה — רקע כהה עם הדגשת מותג
 */
export function InstructionPanelHeader({ onClose, tone = 'brand', number, numberClassName, badge, title, subtitle, actions, secondaryActions }) {
  const grad = PANEL_HEADER_GRADIENT[tone] || PANEL_HEADER_GRADIENT.brand;
  return (
    <header
      className={clsx(
        'relative shrink-0 overflow-hidden border-b border-[#e8a43a]/45 bg-gradient-to-bl shadow-[inset_0_1px_0_rgba(255,200,120,0.12)]',
        grad,
      )}
    >
      <div className="pointer-events-none absolute -left-24 -top-12 h-52 w-52 rounded-full bg-[#f5a623]/35 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-44 w-72 rounded-full bg-[#ffd078]/14 blur-3xl" />
      <div className="pointer-events-none absolute right-1/4 top-0 h-32 w-48 rounded-full bg-[#c47f17]/20 blur-2xl" />
      <div className="relative px-5 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-col gap-4">
          {/* שורה 1: סגירה + תגיות | כפתורי פעולה — בלי לחוץ על הכותרת */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-white shadow-sm backdrop-blur-sm transition hover:border-white/35 hover:bg-white/22"
                aria-label="סגור"
              >
                <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
              </button>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {badge}
                {number != null && (
                  <span className={clsx(
                    'rounded-lg border border-white/15 bg-black/15 px-2.5 py-0.5 font-mono text-[12px] font-medium tabular-nums text-white/90',
                    numberClassName,
                  )}>
                    #{number}
                  </span>
                )}
              </div>
            </div>
            {actions ? (
              <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                {actions}
              </div>
            ) : null}
          </div>
          {/* שורה 2: כותרת מלאה */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-pretty text-[22px] font-bold leading-tight tracking-tight text-white sm:text-[25px]">{title}</h2>
              {subtitle ? (
                <p className="mt-2.5 max-w-3xl text-[14px] leading-relaxed text-white/85">{subtitle}</p>
              ) : null}
            </div>
            {secondaryActions ? (
              <div className="shrink-0">
                {secondaryActions}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

export function InstructionPanelBody({ children, className }) {
  return (
    <div
      className={clsx(
        'min-h-0 flex-1 overflow-y-auto overscroll-contain',
        'bg-gradient-to-b from-slate-100/50 via-[var(--paper)] to-[var(--paper)]',
        'dark:from-slate-950 dark:via-[#0c0c0e] dark:to-[#0c0c0e]',
        className,
      )}
    >
      <div className="mx-auto w-full max-w-[min(52rem,100%)] space-y-8 px-5 py-8 sm:px-8 sm:py-10">{children}</div>
    </div>
  );
}

export function InstructionPanelFooter({ children, className }) {
  return (
    <footer
      className={clsx(
        'shrink-0 border-t border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-[#0c0c0e]/90 sm:px-8',
        className,
      )}
    >
      {children}
    </footer>
  );
}

/** בלוק טקסט לפירוט ההנחיה */
export function InstructionProse({ eyebrow = 'פירוט ההנחיה', children }) {
  if (children == null || children === '') return null;
  return (
    <section>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{eyebrow}</p>
      <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50/90 p-5 text-[15px] leading-[1.75] text-slate-700 shadow-sm dark:border-slate-700/70 dark:from-slate-900/80 dark:to-slate-900/40 dark:text-slate-200">
        {children}
      </div>
    </section>
  );
}
