import { useState, useEffect } from 'react';
import {
  X, BarChart3, Users, Calendar, AlertTriangle, ListChecks, CheckCircle2,
  Hourglass, ShieldCheck, XCircle, Clock,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../api/axios';
import { fmt } from '../tasks/InstructionUX';

const STATUS_BUCKETS = [
  { key: 'pending',          label: 'ממתין',          icon: Hourglass,    accent: 'text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-200' },
  { key: 'in_progress',      label: 'בתהליך',         icon: Clock,        accent: 'text-amber-900 bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200' },
  { key: 'waiting_approval', label: 'ממתין לאישור',  icon: ShieldCheck,  accent: 'text-blue-900 bg-blue-100 dark:bg-blue-950/40 dark:text-blue-200' },
  { key: 'completed',        label: 'הושלמו',         icon: CheckCircle2, accent: 'text-emerald-900 bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200' },
  { key: 'overdue',          label: 'בחריגה',         icon: AlertTriangle,accent: 'text-red-900 bg-red-100 dark:bg-red-950/40 dark:text-red-200' },
  { key: 'rejected',         label: 'נדחו',           icon: XCircle,      accent: 'text-red-900 bg-red-100 dark:bg-red-950/40 dark:text-red-200' },
];

export function ProjectStatsPanel({ projectId, onClose }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await api.get(`/projects/${projectId}/stats`);
        if (!cancelled) { setStats(r.data); setError(null); }
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || 'שגיאה');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-[min(96vw,52rem)] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative bg-gradient-to-l from-[#a0660e] to-[#c47f17] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            className="absolute right-4 top-3.5 rounded-lg border border-white/70 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center justify-center gap-2 text-white">
            <BarChart3 className="h-5 w-5" />
            <div className="text-[20px] font-bold tracking-tight">סטטיסטיקות פרויקט</div>
          </div>
          {stats?.project?.name && (
            <p className="mt-0.5 text-center text-[12.5px] text-amber-50/85">{stats.project.name}</p>
          )}
        </div>

        <div className="max-h-[calc(92vh-7rem)] space-y-5 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--institutional)] border-t-transparent" />
              <p className="text-[14px] text-slate-500">טוען…</p>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          ) : stats ? <Body stats={stats} /> : null}
        </div>
      </div>
    </div>
  );
}

function Body({ stats }) {
  const { byStatus = {}, total = 0, completed = 0, progressPct = 0, peopleCount = 0, overdueCount = 0, dueSoonCount = 0, team = [], project } = stats;

  return (
    <>
      {/* פס התקדמות ראשי */}
      <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-amber-50/60 via-white to-white p-5 shadow-sm dark:border-slate-700 dark:from-amber-950/15 dark:via-slate-900 dark:to-slate-900">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--institutional)]">התקדמות הפרויקט</p>
            <p className="mt-1 text-[15px] text-slate-700 dark:text-slate-200">
              {completed} מתוך {total} משימות הושלמו
            </p>
            {project?.givenDate && (
              <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">תאריך מתן: {fmt(project.givenDate)}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-[44px] font-bold leading-none text-slate-900 dark:text-slate-50">{progressPct}%</div>
            <div className="mt-0.5 text-[12px] font-medium text-slate-500">מהמשימות</div>
          </div>
        </div>
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-l from-[#c47f17] via-amber-400 to-emerald-400 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </section>

      {/* כרטיסי מטא */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard icon={ListChecks} label="סה״כ משימות"  value={total} />
        <SummaryCard icon={Users}      label="אנשים בפרויקט" value={peopleCount} />
        <SummaryCard icon={AlertTriangle} label="בחריגה" value={overdueCount} tone={overdueCount > 0 ? 'danger' : 'neutral'} />
        <SummaryCard icon={Calendar}   label="עומדים להגיע" value={dueSoonCount} tone={dueSoonCount > 0 ? 'warn' : 'neutral'} />
      </section>

      {/* פילוח לפי סטטוס */}
      <section>
        <h3 className="mb-3 text-[12.5px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          פילוח לפי סטטוס
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {STATUS_BUCKETS.map(s => {
            const Icon = s.icon;
            const v = byStatus[s.key] || 0;
            return (
              <div key={s.key} className={clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-slate-200/60 dark:ring-slate-700/60', s.accent)}>
                <Icon className="h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11.5px] font-semibold opacity-80">{s.label}</p>
                  <p className="text-[18px] font-bold leading-tight">{v}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* טבלת אנשי הצוות */}
      <section>
        <h3 className="mb-3 text-[12.5px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          ביצועים לפי אדם ({team.length})
        </h3>

        {team.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-[13px] text-slate-400 dark:border-slate-700">
            אין שיוכים בפרויקט
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/70">
            <table className="w-full border-collapse text-right text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/95 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-400">
                  <th className="px-3 py-2.5">איש צוות</th>
                  <th className="px-3 py-2.5">סה״כ</th>
                  <th className="px-3 py-2.5">הושלם</th>
                  <th className="px-3 py-2.5">ממתין לאישור</th>
                  <th className="px-3 py-2.5">נדחו</th>
                  <th className="min-w-[120px] px-3 py-2.5">התקדמות</th>
                </tr>
              </thead>
              <tbody>
                {team.map((p, i) => (
                  <tr
                    key={p.userId}
                    className={clsx(
                      'border-b border-slate-100 transition-colors dark:border-slate-800',
                      i % 2 === 0
                        ? 'bg-white dark:bg-transparent'
                        : 'bg-slate-50/40 dark:bg-slate-900/20',
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</p>
                      {p.jobTitle && (
                        <p className="text-[11.5px] text-slate-400">{p.jobTitle}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-200">{p.total}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[12px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {p.completed}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[12px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        {p.waiting}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={clsx(
                        'rounded-md px-2 py-0.5 text-[12px] font-bold',
                        p.rejected > 0
                          ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                          : 'text-slate-400',
                      )}>
                        {p.rejected}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-l from-[#c47f17] to-emerald-400 transition-all"
                            style={{ width: `${p.completionPct}%` }}
                          />
                        </div>
                        <span className="w-[34px] text-left text-[11.5px] font-bold text-slate-600 dark:text-slate-300">
                          {p.completionPct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function SummaryCard({ icon: Icon, label, value, tone = 'neutral' }) {
  const palette = {
    neutral: 'from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 text-slate-900 dark:text-slate-50',
    warn:    'from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900 text-amber-900 dark:text-amber-200',
    danger:  'from-red-50 to-white dark:from-red-950/30 dark:to-slate-900 text-red-900 dark:text-red-200',
  };
  return (
    <div className={clsx(
      'flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-gradient-to-br p-4 shadow-sm dark:border-slate-700',
      palette[tone] || palette.neutral,
    )}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/85 shadow-sm dark:bg-slate-800">
        <Icon className="h-4.5 w-4.5 text-[var(--institutional)]" />
      </div>
      <div>
        <div className="text-[24px] font-bold leading-none">{value}</div>
        <div className="text-[11.5px] font-medium opacity-70">{label}</div>
      </div>
    </div>
  );
}
