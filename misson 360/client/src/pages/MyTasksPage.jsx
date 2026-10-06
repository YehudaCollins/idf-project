import { Fragment, useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import {
  Send, Check, AlertCircle, Calendar, Clock, ChevronRight, ChevronDown,
  Inbox, Hourglass, ShieldCheck, XCircle, Sparkles, Bell, MessageSquare, Search,
  Paperclip, File, Image, FileText, Download, Folder, Users,
} from 'lucide-react';
import { TaskChat, useTaskChatUnread } from '../components/tasks/TaskChat';
import clsx from 'clsx';
import api from '../api/axios';
import {
  InstructionStatusBadge,
  DueUrgency,
  CustomFieldsSection,
  LevelsTrack,
  HistoryTimeline,
  PanelChrome,
  InstructionPanelHeader,
  InstructionPanelBody,
  InstructionPanelFooter,
  InstructionProse,
  MetaTile,
  fmt,
  fmtFull,
  STATUS_ME,
} from '../components/tasks/InstructionUX';

const SEGMENTS = [
  ['all', 'הכל'],
  ['action', 'דורש טיפול'],
  ['waiting_approval', 'ממתין לאישור'],
  ['rejected', 'נדחו'],
  ['completed', 'הושלמו'],
];

function commanderHeaderTone(status) {
  if (status === 'rejected') return 'danger';
  if (status === 'waiting_approval') return 'info';
  if (status === 'completed') return 'success';
  return 'brand';
}

export default function MyTasksPage() {
  const [searchParams] = useSearchParams();
  const { projectId: urlProjectId } = useParams();
  const taskFromUrl = searchParams.get('task');

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openTask, setOpenTask] = useState(null);
  const [template, setTemplate] = useState(null);
  const [segment, setSegment] = useState('all');
  const [search, setSearch] = useState('');

  const [expandedProjectIds, setExpandedProjectIds] = useState(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, projectsRes] = await Promise.all([
        api.get('/tasks/mine'),
        api.get('/projects/mine').catch(() => ({ data: [] })),
      ]);
      setTasks(tasksRes.data || []);
      setProjects(projectsRes.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (urlProjectId) {
      setExpandedProjectIds(prev => new Set([...prev, urlProjectId]));
    }
  }, [urlProjectId]);

  useEffect(() => {
    if (!taskFromUrl || !tasks.length) return;
    const t = tasks.find(x => String(x._id) === taskFromUrl);
    if (t) {
      setOpenTask(t);
      const pid = String(t.projectId?._id || t.projectId || '');
      if (pid) {
        setExpandedProjectIds(prev => new Set([...prev, pid]));
      }
    }
  }, [taskFromUrl, tasks]);

  useEffect(() => {
    if (!openTask?.environmentId) {
      setTemplate(null);
      return;
    }
    const envId = openTask.environmentId._id || openTask.environmentId;
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get(`/environments/${envId}/template`);
        if (!cancelled) setTemplate(r.data);
      } catch {
        if (!cancelled) setTemplate(null);
      }
    })();
    return () => { cancelled = true; };
  }, [openTask]);

  const refreshOpen = async () => {
    await load();
    if (openTask) {
      const r = await api.get('/tasks/mine');
      const updated = r.data.find(t => t._id === openTask._id);
      if (updated) setOpenTask(updated);
    }
  };

  const toggleProject = (projectId) => {
    setExpandedProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const stats = useMemo(() => {
    const pending = tasks.filter(t => ['pending', 'in_progress'].includes(t.status)).length;
    const waiting = tasks.filter(t => t.status === 'waiting_approval').length;
    const rejected = tasks.filter(t => t.status === 'rejected').length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const action = tasks.filter(
      t => t.status === 'rejected' || ['pending', 'in_progress', 'overdue'].includes(t.status),
    ).length;
    return { pending, waiting, rejected, completed, action, total: tasks.length };
  }, [tasks]);

  // Map projectId → tasks
  const tasksByProject = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      const pid = String(t.projectId?._id || t.projectId || '');
      if (!pid) continue;
      if (!map[pid]) map[pid] = [];
      map[pid].push(t);
    }
    return map;
  }, [tasks]);

  // אם projects/mine מחזיר רק חלק — אבטיח שכל פרויקט שיש בו משימות יופיע
  const allProjects = useMemo(() => {
    const byId = new Map();
    for (const p of projects) byId.set(String(p._id), p);
    for (const t of tasks) {
      const proj = t.projectId && typeof t.projectId === 'object' ? t.projectId : null;
      if (proj && !byId.has(String(proj._id))) {
        byId.set(String(proj._id), proj);
      }
    }
    return Array.from(byId.values());
  }, [projects, tasks]);

  const taskMatchesSegment = useCallback((t) => {
    if (segment === 'all') return true;
    if (segment === 'action') return t.status === 'rejected' || ['pending', 'in_progress', 'overdue'].includes(t.status);
    return t.status === segment;
  }, [segment]);

  const taskMatchesSearch = useCallback((t) => {
    const q = search.trim();
    if (!q) return true;
    return (
      t.title?.includes(q) ||
      t.description?.includes(q) ||
      String(t.taskNumber).includes(q) ||
      t.environmentId?.name?.includes(q)
    );
  }, [search]);

  const filteredProjects = useMemo(() => {
    const q = search.trim();
    return allProjects.filter(p => {
      const pid = String(p._id);
      const pTasks = tasksByProject[pid] || [];
      const tasksHere = pTasks.filter(t => taskMatchesSegment(t) && taskMatchesSearch(t));
      if (q) {
        const projectMatches = p.name?.includes(q) || p.description?.includes(q);
        return projectMatches || tasksHere.length > 0;
      }
      if (segment === 'all') return pTasks.length > 0;
      return tasksHere.length > 0;
    });
  }, [allProjects, tasksByProject, search, segment, taskMatchesSegment, taskMatchesSearch]);

  const tasksForProject = useCallback((projectId) => {
    const pTasks = tasksByProject[String(projectId)] || [];
    return pTasks.filter(t => taskMatchesSegment(t) && taskMatchesSearch(t));
  }, [tasksByProject, taskMatchesSegment, taskMatchesSearch]);

  const rejectedTasks = useMemo(
    () => tasks.filter(t => t.status === 'rejected').slice(0, 3),
    [tasks],
  );

  return (
    <div
      className={clsx(
        'flex min-h-0 flex-1 flex-col gap-5 overflow-hidden lg:flex-row lg:gap-4 xl:gap-6',
        openTask && 'lg:items-stretch',
      )}
    >
      <section
        className={clsx(
          'flex min-h-0 min-w-0 flex-col gap-5 transition-[flex]',
          openTask
            ? 'lg:basis-0 lg:flex-[2] lg:min-w-[min(100%,26rem)]'
            : 'w-full flex-1',
        )}
      >
        {/* Hero */}
        <header className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
          <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-[#c47f17]/25 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-24 w-48 bg-gradient-to-l from-amber-500/20 to-transparent" />
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-amber-200/90">
              הנחיות שמוקצות אליי
            </p>
            <h1 className="mt-2 text-[28px] font-bold tracking-tight">ההנחיות שלי</h1>
            <p className="mt-2 max-w-md text-[14px] text-slate-300">
              מעקב אחר הנחיות בפרויקטים, דיווח סיום ומענה לסירובי מנהל
            </p>
          </div>
        </header>

        {/* סטטיסטיקות */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { icon: Inbox, label: 'סה״כ', value: stats.total, accent: 'from-slate-100 to-white dark:from-slate-800 dark:to-slate-900' },
            { icon: Hourglass, label: 'לטיפול / בתהליך', value: stats.pending, accent: 'from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/20' },
            { icon: ShieldCheck, label: 'ממתין לאישור', value: stats.waiting, accent: 'from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/25' },
            { icon: XCircle, label: 'נדחו', value: stats.rejected, accent: 'from-red-50 to-rose-50 dark:from-red-950/35 dark:to-rose-950/20' },
          ].map(({ icon: Icon, label, value, accent }) => (
            <div
              key={label}
              className={clsx(
                'flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-gradient-to-br p-4 shadow-sm dark:border-slate-700',
                accent,
              )}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/90 shadow-sm dark:bg-slate-800">
                <Icon className="h-5 w-5 text-[var(--institutional)]" />
              </div>
              <div>
                <div className="text-[26px] font-bold leading-none text-slate-900 dark:text-slate-50">{value}</div>
                <div className="text-[12px] text-slate-500 dark:text-slate-400">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* חיפוש + סינון */}
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/50 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש לפי כותרת, מספר, סביבה…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pr-10 pl-3 text-[14px] text-slate-800 placeholder:text-slate-400 focus:border-[var(--institutional)] focus:outline-none focus:ring-2 focus:ring-[var(--institutional)]/25 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSegment(key)}
                className={clsx(
                  'rounded-full border px-4 py-2 text-[13px] font-semibold transition-all',
                  segment === key
                    ? 'border-[var(--institutional)] bg-[var(--institutional-light)] text-slate-900 shadow-sm dark:bg-amber-950/40 dark:text-amber-100'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* דחיפות — דחיות */}
        {!loading && rejectedTasks.length > 0 && segment === 'all' && (
          <div className="space-y-2">
            {rejectedTasks.map(t => (
              <button
                key={t._id}
                type="button"
                onClick={() => setOpenTask(t)}
                className="flex w-full items-center gap-3 rounded-2xl border-2 border-red-200 bg-red-50/80 px-4 py-3 text-right transition hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:hover:bg-red-950/60"
              >
                <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-bold text-red-900 dark:text-red-100">{t.title}</div>
                  <div className="text-[12px] text-red-700 dark:text-red-300">נדחתה — יש לקרוא את הסיבה ולשלוח שוב</div>
                </div>
                <ChevronRight className="h-4 w-4 text-red-400" />
              </button>
            ))}
          </div>
        )}

        {/* רשימה: פרויקטים עם הנחיות מתחתיהם */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {loading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-20 dark:border-slate-700">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--institutional)] border-t-transparent" />
              <p className="text-[14px] text-slate-500">טוען…</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white/80 py-16 text-center dark:border-slate-700 dark:bg-slate-900/40">
              <Sparkles className="mb-3 h-12 w-12 text-slate-200 dark:text-slate-600" />
              <p className="text-[16px] font-semibold text-slate-600 dark:text-slate-300">אין הנחיות בתצוגה זו</p>
              <p className="mt-1 text-[14px] text-slate-400">כשנקצה אליך הנחיות — יופיעו כאן</p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
              {filteredProjects.map((project) => {
                const pid = String(project._id);
                const expanded = expandedProjectIds.has(pid);
                const childTasks = expanded ? tasksForProject(pid) : [];
                const allProjectTasks = tasksByProject[pid] || [];
                const completed = allProjectTasks.filter(t => t.status === 'completed').length;
                const total = allProjectTasks.length;
                const pct = total ? Math.round((completed / total) * 100) : 0;
                return (
                  <div key={pid} className="space-y-3">
                    <MyProjectHeader
                      project={project}
                      pct={pct}
                      completed={completed}
                      total={total}
                      expanded={expanded}
                      onToggle={() => toggleProject(pid)}
                    />
                    {expanded && (
                      <div
                        className={clsx(
                          'grid gap-3 pr-3',
                          openTask ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
                        )}
                      >
                        {childTasks.map(task => {
                          const st = STATUS_ME[task.status] || STATUS_ME.pending;
                          const active = openTask?._id === task._id;
                          return (
                            <button
                              key={task._id}
                              type="button"
                              onClick={() => setOpenTask(task)}
                              className={clsx(
                                'rounded-2xl border-2 p-5 text-right transition-all hover:shadow-md',
                                active
                                  ? 'border-[var(--institutional)] bg-[var(--institutional-light)]/60 shadow-md ring-2 ring-[var(--institutional)]/20 dark:bg-amber-950/25'
                                  : task.status === 'rejected'
                                    ? 'border-red-100 bg-white hover:border-red-200 dark:border-red-900/50 dark:bg-slate-900/50'
                                    : task.status === 'waiting_approval'
                                      ? 'border-blue-100 bg-white hover:border-blue-200 dark:border-blue-900/40 dark:bg-slate-900/50'
                                      : 'border-slate-100 bg-white hover:border-slate-200 dark:border-slate-700 dark:bg-slate-900/40',
                              )}
                            >
                              <div className="mb-3 flex items-start justify-between gap-3">
                                <span className="font-mono text-[11px] text-slate-400">#{task.taskNumber}</span>
                                <InstructionStatusBadge status={task.status} map={STATUS_ME} />
                              </div>
                              <h3 className="text-[16px] font-bold leading-snug text-slate-900 dark:text-slate-50">{task.title}</h3>
                              {task.description && (
                                <p className={clsx(
                                  'mt-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400',
                                  openTask ? 'line-clamp-4' : 'line-clamp-2',
                                )}>
                                  {task.description}
                                </p>
                              )}
                              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                                <p className="text-[12px] text-slate-500 dark:text-slate-400">{task.environmentId?.name || 'סביבה'}</p>
                                <DueUrgency dueDate={task.dueDate} status={task.status} />
                              </div>
                              <p className="mt-2 text-[11px] text-slate-400">{st.tip}</p>
                            </button>
                          );
                        })}
                        {childTasks.length === 0 && (
                          <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 py-8 text-center text-[13px] text-slate-400 dark:border-slate-700 dark:bg-slate-900/20">
                            אין הנחיות בפרויקט זה {search.trim() || segment !== 'all' ? 'לפי הסינון' : ''}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {openTask && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:min-w-0 lg:flex-[1.15] lg:basis-0">
          <CommanderPanel task={openTask} template={template} onClose={() => setOpenTask(null)} onRefresh={refreshOpen} />
        </div>
      )}
    </div>
  );
}

function ProjectProgressPill({ pct, completed, total }) {
  const tone = total === 0
    ? 'neutral'
    : pct === 100
      ? 'success'
      : pct >= 50
        ? 'progress'
        : pct >= 1
          ? 'early'
          : 'neutral';
  const styles = {
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/50',
    progress: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50',
    early: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/50',
    neutral: 'bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  };
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold ring-1', styles[tone])}>
      <span>{pct}%</span>
      <span className="text-[10px] opacity-70">({completed}/{total})</span>
    </span>
  );
}

function MyProjectHeader({ project, pct, completed, total, expanded, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={clsx(
        'flex w-full items-center gap-3 rounded-2xl border-2 p-5 text-right shadow-sm transition-all hover:shadow-md',
        expanded
          ? 'border-amber-300/80 bg-gradient-to-l from-amber-100/55 via-amber-50/60 to-white dark:border-amber-700/60 dark:from-amber-950/30 dark:via-amber-950/20 dark:to-slate-900/40'
          : 'border-amber-100/80 bg-amber-50/40 hover:border-amber-200 hover:bg-amber-50/70 dark:border-amber-900/30 dark:bg-amber-950/15 dark:hover:border-amber-800/50 dark:hover:bg-amber-950/25',
      )}
    >
      <ChevronDown
        className={clsx(
          'h-5 w-5 shrink-0 text-amber-600 transition-transform duration-200 dark:text-amber-400',
          !expanded && '-rotate-90',
        )}
      />
      <Folder className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-amber-700/80 dark:text-amber-300/70">P{project.projectNumber ?? '—'}</span>
          <span className="text-[16px] font-bold leading-tight text-slate-900 dark:text-slate-50">{project.name}</span>
        </div>
        {project.description && (
          <p className="mt-1 line-clamp-1 text-[12.5px] text-slate-500 dark:text-slate-400">{project.description}</p>
        )}
      </div>
      <div className="hidden flex-wrap items-center gap-4 text-[12px] sm:flex">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">תאריך מתן</div>
          <div className="font-semibold text-slate-700 dark:text-slate-200">{fmt(project.givenDate)}</div>
        </div>
        <ProjectProgressPill pct={pct} completed={completed} total={total} />
      </div>
    </button>
  );
}

function fileIcon(mime) {
  if (!mime) return File;
  if (mime.startsWith('image/')) return Image;
  if (mime.includes('pdf') || mime.includes('text')) return FileText;
  return File;
}
function fmtBytes(b) {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function TaskAttachmentsView({ attachments = [] }) {
  if (!attachments.length) return null;
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        <Paperclip className="h-4 w-4 text-[#c47f17]" />
        קבצים מצורפים
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          {attachments.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {attachments.map(a => {
          const Icon = fileIcon(a.mimeType);
          return (
            <div
              key={a.filename}
              className="flex items-center gap-2.5 rounded-xl border border-amber-100/80 bg-gradient-to-l from-amber-50/40 to-white px-3 py-2.5 shadow-sm dark:border-amber-900/30 dark:from-amber-950/20 dark:to-slate-900/40"
            >
              <Icon className="h-4 w-4 shrink-0 text-amber-500" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {a.originalName}
              </span>
              <span className="shrink-0 text-[11px] text-slate-400">{fmtBytes(a.size)}</span>
              <a
                href={`/uploads/attachments/${a.filename}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                title="הורד"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CommanderPanel({ task, template, onClose, onRefresh }) {
  const [showSubmit, setShowSubmit] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const { unread: chatUnread, reset: resetChatUnread } = useTaskChatUnread(task._id);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const submit = async () => {
    setLoading(true);
    try {
      await api.post(`/tasks/${task._id}/submit`, { note });
      setNote('');
      setShowSubmit(false);
      await onRefresh();
      showToast('הדיווח נשלח — ממתין לאישור המנהל');
    } catch (err) {
      showToast(err.response?.data?.message || 'שגיאה', 'error');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = ['pending', 'in_progress', 'rejected'].includes(task.status);
  const isRejected = task.status === 'rejected';
  const st = STATUS_ME[task.status] || STATUS_ME.pending;
  const dueChatBadge = task.dueDate ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/12 px-3 py-1 text-[12px] font-bold text-white shadow-sm">
      <span>תג״ב:</span>
      <span>{fmt(task.dueDate)}</span>
    </span>
  ) : null;

  return (
    <PanelChrome className="relative flex h-full min-h-0 flex-1 flex-col">
      <InstructionPanelHeader
        tone={commanderHeaderTone(task.status)}
        onClose={() => { if (showChat) { setShowChat(false); resetChatUnread(); } else { onClose(); } }}
        number={task.taskNumber}
        numberClassName={task.status === 'overdue' ? 'border-red-300/70 bg-red-500/25 text-red-100' : undefined}
        badge={<InstructionStatusBadge status={task.status} map={STATUS_ME} size="lg" onDark />}
        title={task.title}
        subtitle={st.tip}
        secondaryActions={dueChatBadge}
        actions={
          <div className="flex items-center gap-1.5 rounded-2xl border border-white/15 bg-black/15 p-1.5 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => { setShowChat(c => !c); if (!showChat) resetChatUnread(); }}
              className={clsx(
                'relative inline-flex items-center justify-center rounded-xl border p-2 text-white shadow-sm backdrop-blur-sm transition',
                showChat
                  ? 'border-[#c47f17]/80 bg-[#c47f17]/30'
                  : 'border-white/25 bg-white/12 hover:border-white/40 hover:bg-white/20',
              )}
              aria-label="צ׳אט"
              title="צ׳אט"
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              {chatUnread > 0 && !showChat && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {chatUnread > 9 ? '9+' : chatUnread}
                </span>
              )}
            </button>
          </div>
        }
      />

      {showChat ? (
        <TaskChat taskId={task._id} dueDate={task.dueDate} status={task.status} showDuePill={false} />
      ) : (
      <InstructionPanelBody>
        {isRejected && task.rejectionNote && (
          <div className="rounded-2xl border-2 border-red-300/90 bg-gradient-to-br from-red-50 to-white p-5 shadow-sm dark:border-red-800 dark:from-red-950/45 dark:to-slate-950/80">
            <div className="mb-2 flex items-center gap-2 font-bold text-red-800 dark:text-red-200">
              <AlertCircle className="h-5 w-5 shrink-0" />
              סיבת הסירוב מהמנהל
            </div>
            <p className="text-[15px] leading-relaxed text-red-950 dark:text-red-50">{task.rejectionNote}</p>
            <p className="mt-4 text-[12px] text-red-700 dark:text-red-300">לאחר הטיפול שלח דיווח מחדש למטה.</p>
          </div>
        )}

        <InstructionProse>{task.description}</InstructionProse>

        <CustomFieldsSection task={task} template={template} />

        <div className="grid gap-3 sm:grid-cols-2">
          <MetaTile icon={Calendar} label="תג״ב">
            {fmt(task.dueDate)}
          </MetaTile>
          <MetaTile icon={Clock} label="ניתנה · סביבה">
            <span className="block">{fmt(task.givenDate)}</span>
            {task.environmentId?.name && (
              <span className="mt-1 block text-[13px] font-normal text-slate-500 dark:text-slate-400">
                {task.environmentId.name}
              </span>
            )}
            <div className="mt-2 text-[13px] font-normal">
              <DueUrgency dueDate={task.dueDate} status={task.status} />
            </div>
          </MetaTile>
        </div>

        <TaskAttachmentsView attachments={task.attachments} />

        <LevelsTrack task={task} />

        {task.lastReminderAt && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-l from-amber-50/90 to-white p-4 dark:border-amber-800/50 dark:from-amber-950/30 dark:to-slate-900/40">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/50">
              <Bell className="h-5 w-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-[12px] font-bold text-amber-900 dark:text-amber-200">תזכורת</p>
              <p className="mt-1 text-[14px] text-amber-900/90 dark:text-amber-100/90">{fmtFull(task.lastReminderAt)}</p>
            </div>
          </div>
        )}

        {task.submissionNote && (
          <div className="rounded-2xl border border-blue-200/60 bg-gradient-to-br from-blue-50/90 to-white p-5 dark:border-blue-900/40 dark:from-blue-950/25 dark:to-slate-900/50">
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-blue-800 dark:text-blue-200">הערה ששלחת</p>
            <p className="text-[15px] leading-relaxed text-blue-950 dark:text-blue-100">{task.submissionNote}</p>
            {task.submittedAt && <p className="mt-2 text-[11px] text-blue-500">{fmtFull(task.submittedAt)}</p>}
          </div>
        )}

        {showSubmit && (
          <div className="space-y-4 rounded-2xl border-2 border-[#c47f17]/35 bg-gradient-to-br from-[var(--institutional-light)]/60 to-white p-5 dark:border-amber-800/40 dark:from-amber-950/20 dark:to-slate-900/60">
            <p className="text-[16px] font-bold text-slate-900 dark:text-slate-50">
              {isRejected ? 'שליחת דיווח מחדש' : 'דיווח סיום הנחיה'}
            </p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={4}
              placeholder="פרט מה בוצע, קבצים, הערות למנהל…"
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] shadow-inner focus:border-[#c47f17] focus:outline-none focus:ring-2 focus:ring-[#c47f17]/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSubmit(false);
                  setNote('');
                }}
                className="flex-1 rounded-xl border border-slate-200 py-3 text-[14px] font-medium text-slate-600 dark:border-slate-600"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#a0660e] to-[#c47f17] py-3 text-[14px] font-bold text-white shadow-md disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
                {isRejected ? 'שלח מחדש' : 'שלח דיווח'}
              </button>
            </div>
          </div>
        )}

        <HistoryTimeline history={task.history} />
      </InstructionPanelBody>
      )}

      {!showSubmit && !showChat && (
        <InstructionPanelFooter>
          <div className="mx-auto w-full max-w-[640px] space-y-4">
            {canSubmit && (
              <button
                type="button"
                onClick={() => setShowSubmit(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold text-white shadow-lg transition hover:brightness-105 active:scale-[0.995]"
                style={{
                  background: isRejected ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : 'linear-gradient(135deg, #c47f17, #8f5c0f)',
                }}
              >
                {isRejected ? <AlertCircle className="h-5 w-5" /> : <Send className="h-5 w-5" />}
                {isRejected ? 'שלח דיווח מחדש' : 'דווח על סיום'}
              </button>
            )}
            {task.status === 'waiting_approval' && (
              <div className="rounded-xl border border-blue-200/60 bg-blue-50/50 px-4 py-3 text-center dark:border-blue-900/50 dark:bg-blue-950/20">
                <p className="text-[15px] font-semibold text-blue-800 dark:text-blue-200">הדיווח בבדיקת המנהל</p>
                <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-400">תקבל עדכון לאחר אישור או דחייה</p>
              </div>
            )}
            {task.status === 'completed' && (
              <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-4 text-center dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <p className="flex items-center justify-center gap-2 text-[16px] font-bold text-emerald-800 dark:text-emerald-200">
                  <Check className="h-5 w-5" />
                  ההנחיה אושרה
                </p>
                {task.resolvedAt && <p className="mt-2 text-[12px] text-slate-500">{fmtFull(task.resolvedAt)}</p>}
              </div>
            )}
          </div>
        </InstructionPanelFooter>
      )}

      {toast && (
        <div
          className={clsx(
            'absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-2xl px-6 py-3 text-[14px] font-semibold text-white shadow-xl',
            toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-600',
          )}
        >
          {toast.type === 'error' ? <AlertCircle className="mb-0.5 mr-1 inline h-4 w-4" /> : <Check className="mb-0.5 mr-1 inline h-4 w-4" />}
          {toast.msg}
        </div>
      )}
    </PanelChrome>
  );
}
