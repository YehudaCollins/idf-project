import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  BarChart3, Users, Building2, Shield, Plus, Trash2, Pencil,
  Search, X, Check, AlertCircle, UserPlus,
  ChevronLeft, ClipboardList, Activity, UserCog,
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import clsx from 'clsx';
import { safeImageSrc } from '../lib/safeImageSrc';

/** עיצוב מרכז ניהול — מראה נקי 2025-ish (לא Fluent קלאסי) */
const ACCENT     = '#4f46e5';
const SURFACE    = 'rounded-2xl bg-white/90 shadow-sm ring-1 ring-slate-200/70 backdrop-blur-sm';
const SURFACE_HD = 'rounded-t-2xl border-b border-slate-200/60 bg-gradient-to-l from-slate-50/90 to-white/80 px-4 py-3';
const INPUT      = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15';

/* ─────────────────────────────────────────────────────
   Shared helpers
───────────────────────────────────────────────────── */
const inputCls = INPUT;

function looksLikePersonalNumber(value) {
  return /^[a-zA-Z]?\d{3,10}$/.test(String(value || '').trim());
}

async function lookupUnitreeCandidate(q, existingUserIds = []) {
  if (!looksLikePersonalNumber(q)) return null;
  const r = await api.get(`/users/lookup?tagId=${encodeURIComponent(q.trim())}`);
  if (!r.data?.found) return null;
  const u = r.data.user;
  return {
    ...u,
    _unitree: Boolean(r.data.fromUnitree),
    inSystem: Boolean(r.data.inSystem || u._id),
    alreadyInEnv: u._id ? existingUserIds.includes(u._id) : false,
  };
}

function MsBtn({ children, onClick, disabled, variant = 'primary', size = 'sm', className = '' }) {
  const sizes = { xs: 'px-2.5 py-1 text-xs', sm: 'px-3.5 py-1.5 text-sm', md: 'px-4 py-2.5 text-sm' };
  const variants = {
    primary: 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700 active:scale-[0.98]',
    danger:  'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50',
    ghost:   'border border-slate-200 bg-white/80 text-slate-700 hover:bg-slate-50',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed',
        sizes[size],
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, icon: Icon, color = ACCENT, sub }) {
  return (
    <div
      className={clsx(
        SURFACE,
        'p-5 transition-shadow duration-200 hover:shadow-md hover:ring-slate-300/80'
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 shadow-inner ring-1 ring-slate-200/60"
          style={{ color }}
        >
          <Icon className="h-6 w-6" strokeWidth={1.65} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value ?? '—'}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">{label}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

const HE_MO = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

/** ספירת יצירות לפי חודש — לולאה אחת על המשימות, ללא בקשות נוספות */
function aggregateTasksCreatedByMonth(tasks, monthsBack = 6) {
  const now = new Date();
  const buckets = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      ym: d.getFullYear() * 100 + d.getMonth(),
      label: `${HE_MO[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
      count: 0,
    });
  }
  for (const t of tasks) {
    const c = new Date(t.createdAt || t.givenDate || 0);
    if (Number.isNaN(c.getTime())) continue;
    const ym = c.getFullYear() * 100 + c.getMonth();
    const b = buckets.find(x => x.ym === ym);
    if (b) b.count++;
  }
  return buckets.map(({ label, count }) => ({ label, count }));
}

/** פס מוערם + פסים אופקיים — DOM בלבד, ללא ספריית גרפים */
const TaskStatusStackedBar = memo(function TaskStatusStackedBar({ items }) {
  const list = (items || []).filter(i => i.value > 0);
  if (!list.length) {
    return <p className="text-sm text-slate-400 text-center py-6">אין נתוני סטטוס להצגה</p>;
  }
  const total = list.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="w-full min-w-0">
      <div
        className="flex h-10 w-full min-w-0 overflow-hidden rounded-xl bg-slate-100/90 p-0.5 shadow-inner ring-1 ring-slate-200/80"
        role="img"
        aria-label="התפלגות סטטוס הנחיות"
      >
        {list.map((it) => (
          <div
            key={it.key}
            className="h-full min-w-[4px] shrink first:rounded-r-lg last:rounded-l-lg"
            style={{ flexGrow: it.value, flexBasis: 0, backgroundColor: it.color }}
            title={`${it.label}: ${it.value} (${Math.round((it.value / total) * 100)}%)`}
          />
        ))}
      </div>
      <ul className="m-0 mt-3 grid list-none grid-cols-1 gap-x-4 gap-y-2 p-0 text-xs text-slate-600 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((it) => (
          <li key={it.key} className="flex min-w-0 items-center gap-2 rounded-lg bg-slate-50/80 px-2 py-1.5 ring-1 ring-slate-100">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: it.color }} />
            <span className="truncate font-medium">{it.label}</span>
            <span className="ms-auto shrink-0 tabular-nums text-slate-400">{it.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});

const EnvMembersBarList = memo(function EnvMembersBarList({ rows }) {
  if (!rows?.length) {
    return <p className="text-sm text-slate-400 text-center py-6">אין סביבות</p>;
  }
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-2.5 w-full min-w-0">
      {rows.map((r) => (
        <div key={r.id} className="flex min-w-0 items-center gap-3">
          <span className="w-36 shrink-0 truncate text-right text-xs font-medium text-slate-700 sm:w-44" title={r.name}>{r.name}</span>
          <div className="h-5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 shadow-inner ring-1 ring-slate-200/60">
            <div
              className="h-full max-w-full rounded-full bg-gradient-to-l from-indigo-600 to-indigo-500 shadow-sm"
              style={{ width: r.count ? `${(r.count / max) * 100}%` : '0%' }}
              title={`${r.count} משתמשים עם הרשאה בסביבה`}
            />
          </div>
          <span className="w-8 shrink-0 text-left text-xs tabular-nums font-semibold text-slate-600">{r.count}</span>
        </div>
      ))}
    </div>
  );
});

const MonthlyCreatedBars = memo(function MonthlyCreatedBars({ data }) {
  if (!data?.length) {
    return <p className="text-sm text-slate-400 text-center py-6">אין נתונים</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex items-end justify-between gap-1 sm:gap-2 h-32 w-full min-w-0">
      {data.map((d) => {
        const pct = (d.count / max) * 100;
        return (
          <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <div className="mx-auto flex h-[5.75rem] w-full max-w-[48px] flex-col justify-end overflow-hidden rounded-t-xl bg-slate-100 shadow-inner ring-1 ring-slate-200/70">
              <div
                className="w-full rounded-t-lg bg-gradient-to-t from-indigo-600 to-indigo-400 shadow-sm"
                style={{ height: d.count ? `${pct}%` : '0%', minHeight: d.count ? '4px' : 0 }}
                title={`${d.label}: ${d.count}`}
              />
            </div>
            <span className="w-full truncate text-center text-[10px] font-medium leading-tight text-slate-500 sm:text-[11px]" title={d.label}>{d.label}</span>
            <span className="text-[10px] tabular-nums font-semibold text-slate-600">{d.count}</span>
          </div>
        );
      })}
    </div>
  );
});

/* ══════════════════════════════════════════════════════
   OVERVIEW TAB
══════════════════════════════════════════════════════ */
function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, envsRes, tasksRes] = await Promise.all([
        api.get('/users'),
        api.get('/environments'),
        api.get('/tasks').catch(() => ({ data: [] })),
      ]);
      const users = usersRes.data  || [];
      const envs  = envsRes.data   || [];
      const tasks = Array.isArray(tasksRes.data) ? tasksRes.data : [];

      const adminUsers = users.filter(u => u.role === 'admin');

      const permResponses = await Promise.all(
        envs.map(env => api.get(`/environments/${env._id}/permissions`).catch(() => ({ data: [] })))
      );
      const managerIds = new Set();
      permResponses.forEach(res => {
        (res.data || []).forEach(p => {
          if (p.type === 'manager') managerIds.add(p.userId?._id || p.userId);
        });
      });

      const envMemberCounts = envs
        .map((env, i) => ({
          id: env._id,
          name: env.name || '—',
          count: (permResponses[i].data || []).length,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      setStats({
        totalUsers:           users.length,
        totalAdmins:          adminUsers.length,
        totalEnvs:            envs.length,
        totalManagers:        managerIds.size,
        totalTasks:           tasks.length,
        completedTasks:       tasks.filter(t => t.status === 'completed').length,
        pendingTasks:         tasks.filter(t => t.status === 'pending').length,
        inProgressTasks:      tasks.filter(t => t.status === 'in_progress').length,
        overdueTasks:         tasks.filter(t => t.status === 'overdue').length,
        waitingApprovalTasks: tasks.filter(t => t.status === 'waiting_approval').length,
        rejectedTasks:        tasks.filter(t => t.status === 'rejected').length,
        envMemberCounts,
        monthlyCreated:       aggregateTasksCreatedByMonth(tasks, 6),
        envList:    envs.slice(0, 8),
        adminList:  adminUsers.slice(0, 8),
        recentUsers: [...users].reverse().slice(0, 8),
      });
    } catch {
      setStats(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const statusBarItems = useMemo(() => {
    if (!stats) return [];
    return [
      { key: 'completed',        label: 'הושלמו',         value: stats.completedTasks,       color: '#107c10' },
      { key: 'in_progress',      label: 'בטיפול',         value: stats.inProgressTasks,      color: '#d97706' },
      { key: 'waiting_approval', label: 'ממתינות לאישור', value: stats.waitingApprovalTasks, color: '#7c3aed' },
      { key: 'pending',          label: 'ממתינות',        value: stats.pendingTasks,         color: '#6366f1' },
      { key: 'overdue',          label: 'באיחור',         value: stats.overdueTasks,         color: '#d13438' },
      { key: 'rejected',         label: 'נדחו',           value: stats.rejectedTasks,        color: '#605e5c' },
    ];
  }, [stats]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh] w-full">
      <div className="text-slate-400 text-sm">טוען נתונים...</div>
    </div>
  );

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] w-full">
        <p className="text-slate-400 text-sm">לא ניתן לטעון נתונים</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full min-w-0 max-w-none">

      {/* ── System stats ── */}
      <div>
        <h2 className="mb-1 text-lg font-semibold tracking-tight text-slate-900">סקירת מערכת</h2>
        <p className="mb-4 text-sm text-slate-500">מצב כללי של המשתמשים והסביבות</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <StatCard label="סה״כ משתמשים"   value={stats.totalUsers}    icon={Users}        color={ACCENT} />
          <StatCard label="סביבות פעילות"   value={stats.totalEnvs}     icon={Building2}    color="#107c10" />
          <StatCard label="מנהלי סביבות"    value={stats.totalManagers} icon={Shield}       color="#d83b01" />
          <StatCard label="מנהלי על"        value={stats.totalAdmins}   icon={UserCog}      color="#7c3aed" />
        </div>
      </div>

      {/* ── Task stats ── */}
      <div>
        <h2 className="mb-1 text-lg font-semibold tracking-tight text-slate-900">סטטוס הנחיות</h2>
        <p className="mb-4 text-sm text-slate-500">סיכום לפי סטטוס במערכת</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 md:gap-4">
          <StatCard label="סה״כ הנחיות"        value={stats.totalTasks}           icon={ClipboardList} color={ACCENT} />
          <StatCard label="הושלמו"              value={stats.completedTasks}       icon={Check}         color="#107c10" />
          <StatCard label="בטיפול"              value={stats.inProgressTasks}      icon={Activity}      color="#d97706" />
          <StatCard label="ממתינות לאישור"      value={stats.waitingApprovalTasks} icon={ClipboardList} color="#7c3aed" />
          <StatCard label="באיחור"              value={stats.overdueTasks}         icon={AlertCircle}   color="#d13438" />
        </div>
      </div>

      {/* ── Charts (DOM קל) ── */}
      <div>
        <h2 className="mb-1 text-lg font-semibold tracking-tight text-slate-900">גרפים</h2>
        <p className="mb-4 text-sm text-slate-500">התפלגות ומגמות — רינדור קל</p>
        <div className="grid w-full min-w-0 grid-cols-1 gap-4 xl:grid-cols-12">
          <div className={clsx(SURFACE, 'p-5 xl:col-span-7')}>
            <h3 className="mb-4 text-sm font-semibold text-slate-800">התפלגות סטטוס הנחיות</h3>
            <TaskStatusStackedBar items={statusBarItems} />
          </div>
          <div className={clsx(SURFACE, 'p-5 xl:col-span-5')}>
            <h3 className="mb-4 text-sm font-semibold text-slate-800">הנחיות שנוצרו (6 חודשים אחרונים)</h3>
            <MonthlyCreatedBars data={stats.monthlyCreated} />
          </div>
          <div className={clsx(SURFACE, 'overflow-hidden p-0 xl:col-span-12')}>
            <div className={SURFACE_HD}>
              <h3 className="text-sm font-semibold text-slate-800">משתמשים עם הרשאה — לפי סביבה</h3>
            </div>
            <div className="max-h-[min(22rem,45vh)] overflow-y-auto px-5 py-4">
              <EnvMembersBarList rows={stats.envMemberCounts} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column info ── */}
      <div className="grid w-full min-w-0 grid-cols-1 gap-4 md:grid-cols-3">

        {/* Environments */}
        <div className={clsx(SURFACE, 'overflow-hidden p-0')}>
          <div className={clsx(SURFACE_HD, 'flex items-center gap-2')}>
            <Building2 className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-semibold text-slate-800">סביבות פעילות</span>
          </div>
          {stats.envList.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">אין סביבות</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.envList.map((env) => (
                <div key={env._id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-indigo-50/50">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200/60">
                    {env.name.charAt(0)}
                  </div>
                  <span className="truncate text-sm font-medium text-slate-700">{env.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Super admins */}
        <div className={clsx(SURFACE, 'overflow-hidden p-0')}>
          <div className={clsx(SURFACE_HD, 'flex items-center gap-2')}>
            <Shield className="h-4 w-4 text-violet-600" />
            <span className="text-sm font-semibold text-slate-800">מנהלי על</span>
          </div>
          {stats.adminList.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">אין מנהלי על</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.adminList.map((u) => (
                <div key={u._id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-violet-50/50">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-xs font-bold text-violet-700 ring-1 ring-violet-200/60">
                    {u.name?.charAt(0)}
                  </div>
                  <span className="truncate text-sm font-medium text-slate-700">{u.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent users */}
        <div className={clsx(SURFACE, 'overflow-hidden p-0')}>
          <div className={clsx(SURFACE_HD, 'flex items-center gap-2')}>
            <Users className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-semibold text-slate-800">משתמשים במערכת</span>
          </div>
          {stats.recentUsers.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">אין משתמשים</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.recentUsers.map((u) => (
                <div key={u._id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-indigo-50/50">
                  <div
                    className={clsx(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ring-1',
                      u.role === 'admin'
                        ? 'bg-violet-50 text-violet-700 ring-violet-200/60'
                        : 'bg-indigo-50 text-indigo-700 ring-indigo-200/60'
                    )}
                  >
                    {u.name?.charAt(0)}
                  </div>
                  <span className="flex-1 truncate text-sm font-medium text-slate-700">{u.name}</span>
                  {u.role === 'admin' && (
                    <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800 ring-1 ring-violet-200/80">על</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ENVIRONMENTS TAB
══════════════════════════════════════════════════════ */
function EnvironmentsTab() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [envs, setEnvs]           = useState([]);
  const [permsMap, setPermsMap]   = useState({});
  const [loading, setLoading]     = useState(false);
  const [showNew, setShowNew]     = useState(false);
  const [showAddMember, setShowAddMember] = useState(null);
  const [editE, setEditE]         = useState(null);
  const [form, setForm]           = useState({ name: '', description: '' });
  const [formErr, setFormErr]     = useState('');
  const [searchEnv, setSearchEnv] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/environments');
      setEnvs(r.data);
      const map = {};
      await Promise.all(r.data.map(async e => {
        try {
          const mr = await api.get(`/environments/${e._id}/permissions`);
          map[e._id] = mr.data;
        } catch { map[e._id] = []; }
      }));
      setPermsMap(map);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const saveEnv = async (e) => {
    e.preventDefault(); setFormErr('');
    try {
      if (editE) await api.put(`/environments/${editE._id}`, form);
      else       await api.post('/environments', form);
      loadAll(); setShowNew(false); setEditE(null); setForm({ name: '', description: '' });
    } catch (er) { setFormErr(er.response?.data?.message || 'שגיאה'); }
  };

  const delEnv = async (id) => {
    const ok = await confirm({
      title: 'למחוק את הסביבה?',
      message: 'כל הנתונים הקשורים לסביבה עלולים להיפגע. לא ניתן לבטל.',
      confirmLabel: 'מחק', cancelLabel: 'ביטול', variant: 'danger',
    });
    if (!ok) return;
    await api.delete(`/environments/${id}`);
    loadAll();
  };

  const delMgr = async (envId, uid) => {
    const ok = await confirm({
      title: 'להסיר מנהל מהסביבה?',
      message: 'לא יוכל עוד לנהל את הסביבה.',
      confirmLabel: 'הסר', cancelLabel: 'ביטול', variant: 'danger',
    });
    if (!ok) return;
    await api.delete(`/environments/${envId}/permissions/${uid}`);
    loadAll();
  };

  const filtered = envs.filter(env => !searchEnv.trim() || env.name?.includes(searchEnv));

  return (
    <div className="space-y-4 w-full min-w-0 max-w-none">
      {ConfirmDialog}

      {/* ── Header bar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">סביבות פעילות</h2>
          <p className="mt-0.5 text-sm text-slate-500">{envs.length} סביבות מוגדרות במערכת</p>
        </div>
        <MsBtn size="md" onClick={() => { setShowNew(true); setEditE(null); setForm({ name: '', description: '' }); setFormErr(''); }}>
          <Plus className="h-4 w-4" />סביבה חדשה
        </MsBtn>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={searchEnv}
          onChange={e => setSearchEnv(e.target.value)}
          placeholder="חיפוש סביבה..."
          className={INPUT + ' pr-9'}
        />
      </div>

      {/* ── Grid ── */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">טוען...</div>
      ) : filtered.length === 0 ? (
        <div className={clsx(SURFACE, 'py-16 text-center')}>
          <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-600">{searchEnv ? 'לא נמצאו סביבות' : 'אין סביבות עדיין'}</p>
          {!searchEnv && (
            <button
              type="button"
              onClick={() => { setShowNew(true); setEditE(null); setForm({ name: '', description: '' }); }}
              className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              + צור סביבה ראשונה
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map(env => {
            const envPerms = permsMap[env._id] || [];
            const mgrList  = envPerms.filter(p => p.type === 'manager');
            return (
              <div key={env._id} className={clsx(SURFACE, 'flex flex-col overflow-hidden p-0 shadow-sm')}>

                {/* Card header */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 bg-gradient-to-l from-slate-50 to-white px-4 py-3.5">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-sm font-bold text-indigo-700 ring-1 ring-indigo-100"
                    >
                      {env.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-800 truncate">{env.name}</h3>
                      {env.description
                        ? <p className="text-xs text-slate-400 mt-0.5 truncate">{env.description}</p>
                        : <p className="text-xs text-slate-300 mt-0.5">ללא תיאור</p>
                      }
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => { setEditE(env); setForm({ name: env.name, description: env.description || '' }); setShowNew(true); setFormErr(''); }}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => delEnv(env._id)}
                      className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Managers */}
                <div className="px-4 py-3.5 flex-1">
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      מנהלים ({mgrList.length})
                    </p>
                    <button onClick={() => setShowAddMember(env._id)}
                      className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      <Plus className="h-3 w-3" />הוסף
                    </button>
                  </div>

                  {mgrList.length === 0 ? (
                    <div className="border border-dashed border-slate-200 rounded py-4 text-center">
                      <p className="text-xs text-slate-400">לא הוגדרו מנהלים</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {mgrList.map(m => (
                        <div key={m._id} className="flex items-center justify-between group">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-xs font-bold text-amber-700 ring-1 ring-amber-100">
                              {m.userId?.name?.charAt(0)}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-700">{m.userId?.name}</div>
                              {m.userId?.tagId && (
                                <code className="text-[10px] text-slate-400">{m.userId.tagId}</code>
                              )}
                            </div>
                          </div>
                          <button onClick={() => delMgr(env._id, m.userId?._id)}
                            className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal — Add manager */}
      {showAddMember && (
        <EnvAddMemberModal
          envId={showAddMember}
          envName={envs.find(e => e._id === showAddMember)?.name || ''}
          existingUserIds={(permsMap[showAddMember] || []).map(p => p.userId?._id)}
          onClose={() => setShowAddMember(null)}
          onDone={() => { setShowAddMember(null); loadAll(); }}
        />
      )}

      {/* Modal — Create/Edit env */}
      {showNew && (
        <EnvFormModal
          title={editE ? 'עריכת סביבה' : 'סביבה חדשה'}
          form={form}
          onChange={setForm}
          onSubmit={saveEnv}
          onClose={() => { setShowNew(false); setEditE(null); }}
          err={formErr}
          editMode={!!editE}
        />
      )}
    </div>
  );
}

/* ── Env Form Modal ── */
function EnvFormModal({ title, form, onChange, onSubmit, onClose, err, editMode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/80"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-l from-indigo-600 to-indigo-800 px-5 py-4 text-white">
          <h2 className="font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-white/70 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">שם *</label>
            <input value={form.name} onChange={e => onChange(f => ({ ...f, name: e.target.value }))} required className={inputCls} placeholder="שם הסביבה" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">תיאור</label>
            <textarea value={form.description} onChange={e => onChange(f => ({ ...f, description: e.target.value }))} rows={3} className={inputCls + ' resize-none'} placeholder="תיאור קצר (אופציונלי)" />
          </div>
          {err && (
            <div className="flex gap-2 bg-[#fde7e9] border border-[#f4b8ba] rounded px-3 py-2">
              <AlertCircle className="h-4 w-4 text-[#d13438] shrink-0 mt-0.5" />
              <span className="text-sm text-[#d13438]">{err}</span>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/25 transition-colors hover:bg-indigo-700"
            >
              <Check className="h-4 w-4" />
              {editMode ? 'שמור שינויים' : 'צור סביבה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── EnvAddMemberModal — adds manager to environment ── */
function EnvAddMemberModal({ envId, envName, existingUserIds, onClose, onDone }) {
  const [q, setQ]             = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr]         = useState('');
  const debounceRef           = useRef(null);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const all  = await api.get(`/environments/${envId}/permissions/users-without`);
        const term = q.trim().toLowerCase();
        const bySystem = all.data.filter(u =>
          u.name?.toLowerCase().includes(term) ||
          u.tagId?.includes(term) ||
          u.username?.toLowerCase().includes(term) ||
          u.jobTitle?.toLowerCase().includes(term)
        );
        const unitreeCandidate = await lookupUnitreeCandidate(q.trim(), existingUserIds).catch(() => null);
        const systemTagIds = new Set(bySystem.map(u => u.tagId).filter(Boolean));
        const nextResults = [...bySystem];
        if (unitreeCandidate?.tagId && !systemTagIds.has(unitreeCandidate.tagId)) {
          nextResults.unshift(unitreeCandidate);
        }
        setResults(nextResults);
      } catch (e) {
        setResults([]);
        setErr(e?.response?.data?.message || 'שגיאה בחיפוש');
      } finally { setSearching(false); }
    }, 150);
  }, [q, envId, existingUserIds]);

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true); setErr('');
    try {
      let userId = selected._id;
      if (!selected.inSystem) {
        const r = await api.post('/users', {
          ...selected,
          environmentId: envId,
          permissions: 'manager',
          role: 'commander',
        });
        userId = r.data._id;
      }
      await api.post(`/environments/${envId}/permissions`, { userId, type: 'manager' });
      onDone();
    } catch (e) { setErr(e.response?.data?.message || 'שגיאה בשמירה'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="flex max-h-[70vh] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/80"
        onClick={e => e.stopPropagation()}
      >

        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-gradient-to-l from-indigo-600 to-indigo-800 px-5 py-4">
          <div>
            <h2 className="font-semibold text-white">הוסף מנהל לסביבה</h2>
            <p className="mt-0.5 text-xs text-white/75">{envName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!selected ? (
          <>
            <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                {searching && (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                  </div>
                )}
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="שם, מספר אישי או תפקיד..."
                  className={INPUT + ' pr-10'}
                  autoFocus
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
              {!q.trim() ? (
                <div className="flex h-48 flex-col items-center justify-center text-center">
                  <Search className="mb-2 h-8 w-8 text-slate-200" />
                  <p className="text-sm text-slate-500">חפש לפי שם, מספר חוגר או תפקיד</p>
                </div>
              ) : results.length === 0 && !searching ? (
                <div className="flex h-48 flex-col items-center justify-center text-center">
                  <p className="text-sm text-slate-500">לא נמצאו תוצאות עבור &quot;{q}&quot;</p>
                </div>
              ) : results.map((u, i) => {
                const inEnv = u._id && existingUserIds.includes(u._id);
                return (
                  <button
                    key={u._id || u.tagId || i}
                    type="button"
                    onClick={() => setSelected({
                      ...u,
                      inSystem: u.inSystem !== undefined ? u.inSystem : Boolean(u._id),
                      alreadyInEnv: inEnv,
                    })}
                    className="flex w-full items-center gap-3 px-4 py-3 text-right transition-colors hover:bg-indigo-50/60"
                  >
                    <div
                      className={clsx(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-1',
                        u._unitree
                          ? 'bg-indigo-50 text-indigo-700 ring-indigo-100'
                          : 'bg-amber-50 text-amber-700 ring-amber-100'
                      )}
                    >
                      {safeImageSrc(u.profileImageUrl) ? (
                        <img src={safeImageSrc(u.profileImageUrl)} alt="" className="h-full w-full rounded-xl object-cover" />
                      ) : (u.name || '?').charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-800">{u.name}</div>
                      <div className="text-xs text-slate-500">{u.tagId}{u.jobTitle ? ` · ${u.jobTitle}` : ''}</div>
                    </div>
                    {inEnv && (
                      <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-100">
                        בסביבה
                      </span>
                    )}
                    {u._unitree && (
                      <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
                        Unitree
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="shrink-0 border-b border-slate-200 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-base font-bold text-amber-700 ring-1 ring-amber-100">
                  {safeImageSrc(selected.profileImageUrl) ? (
                    <img src={safeImageSrc(selected.profileImageUrl)} alt="" className="h-full w-full rounded-xl object-cover" />
                  ) : selected.name?.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-800">{selected.name}</div>
                  <div className="text-xs text-slate-500">{selected.tagId}{selected.jobTitle ? ` · ${selected.jobTitle}` : ''}</div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelected(null); setQ(''); setErr(''); }}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  ‹ שנה
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {selected.alreadyInEnv && (
                  <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-100">כבר בסביבה — עדכון</span>
                )}
                {!selected.inSystem && (
                  <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-800 ring-1 ring-indigo-100">מיוניטרי — יירשם</span>
                )}
              </div>
            </div>
            <div className="flex-1 px-4 py-4">
              <div className="flex items-center gap-3 rounded-xl border-2 border-indigo-200 bg-indigo-50/80 px-4 py-4 ring-1 ring-indigo-100">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-indigo-100">
                  <Shield className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <div className="text-sm font-bold text-indigo-900">מנהל סביבה</div>
                  <div className="mt-0.5 text-xs text-slate-600">מנהל הנחיות בסביבה זו</div>
                </div>
              </div>
              {err && (
                <div className="mt-3 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span className="text-sm text-rose-800">{err}</span>
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-slate-50/80 px-4 py-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-sm shadow-indigo-600/25 transition-colors hover:bg-indigo-700 disabled:opacity-40"
              >
                <UserPlus className="h-4 w-4" />
                {submitting ? 'שומר...' : selected?.alreadyInEnv ? 'עדכן הרשאה' : !selected?.inSystem ? 'רשום והוסף' : 'הוסף לסביבה'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SUPER ADMINS TAB
══════════════════════════════════════════════════════ */
function SuperAdminsTab() {
  const { user: currentUser } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setAdmins((res.data || []).filter(u => u.role === 'admin'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const revoke = async (u) => {
    const ok = await confirm({
      title: `לשלול הרשאת מנהל על מ-${u.name}?`,
      message: 'המשתמש יחזור להיות מפקד רגיל ללא גישה למרכז הניהול.',
      confirmLabel: 'שלול', cancelLabel: 'ביטול', variant: 'danger',
    });
    if (!ok) return;
    await api.put(`/users/${u._id}`, { role: 'commander' });
    load();
  };

  const grant = async (userId) => {
    await api.put(`/users/${userId}`, { role: 'admin' });
    load();
    setShowAdd(false);
  };

  const filtered = admins.filter(u =>
    !search || u.name?.includes(search) || u.tagId?.includes(search)
  );

  return (
    <div className="w-full min-w-0 max-w-none space-y-4">
      {ConfirmDialog}

      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 ring-1 ring-amber-100/60">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-sm leading-relaxed text-amber-950/80">
          מנהלי על מחזיקים בגישה מלאה לכל המערכת כולל מרכז ניהול זה. הוסף הרשאות אלו בזהירות.
        </p>
      </div>

      <div className={clsx(SURFACE, 'overflow-hidden p-0')}>

        {/* Table header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-gradient-to-l from-slate-50 to-white px-4 py-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-violet-600" />
            <span className="text-sm font-semibold text-slate-800">מנהלי על ({admins.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="חיפוש..."
                className={INPUT + ' w-44 py-1.5 pr-8 text-xs'}
              />
            </div>
            <MsBtn size="xs" onClick={() => setShowAdd(true)}>
              <Plus className="h-3.5 w-3.5" />הוסף מנהל על
            </MsBtn>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">טוען...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['משתמש', 'מ. אישי', 'תפקיד', 'מסגרת שיוך', 'פעולות'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const levels = [u.level1, u.level2, u.level3, u.level4].filter(Boolean);
                const isSelf = String(u._id) === String(currentUser?._id);
                return (
                  <tr key={u._id} className={clsx('group border-b border-slate-100 transition-colors hover:bg-indigo-50/40', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/80')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-sm font-bold text-violet-700 ring-1 ring-violet-100">
                          {u.name?.charAt(0)}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-slate-800">{u.name}</span>
                          {isSelf && (
                            <span className="mr-1.5 rounded-md bg-indigo-100 px-1.5 py-0.5 text-xs font-semibold text-indigo-800 ring-1 ring-indigo-200/60">
                              אתה
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-slate-50 px-1.5 py-0.5 rounded text-slate-500">{u.tagId || '—'}</code>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{u.jobTitle || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {levels.length ? levels.join(' › ') : '—'}
                    </td>
                    <td className="px-4 py-3 text-left">
                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => revoke(u)}
                          className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 opacity-0 transition-all hover:bg-rose-50 group-hover:opacity-100"
                        >
                          שלול הרשאה
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="py-10 text-center text-sm text-slate-400">אין מנהלי על</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <AddAdminModal
          existingAdminIds={admins.map(a => a._id)}
          onClose={() => setShowAdd(false)}
          onGrant={grant}
        />
      )}
    </div>
  );
}

/* ── Add Admin Modal ── */
function AddAdminModal({ existingAdminIds, onClose, onGrant }) {
  const [q, setQ]             = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await api.get('/users');
        const term = q.trim().toLowerCase();
        setResults((res.data || []).filter(u =>
          (u.name?.toLowerCase().includes(term) ||
           u.tagId?.includes(term) ||
           u.jobTitle?.toLowerCase().includes(term)) &&
          u.role !== 'admin'
        ));
      } finally { setSearching(false); }
    }, 150);
  }, [q]);

  const grant = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try { await onGrant(selected._id); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="flex max-h-[70vh] w-full max-w-[480px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/80"
        onClick={e => e.stopPropagation()}
      >

        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-gradient-to-l from-violet-800 to-violet-950 px-5 py-4">
          <div>
            <h2 className="font-semibold text-white">הוספת מנהל על</h2>
            <p className="mt-0.5 text-xs text-violet-100/90">חפש משתמש ומנה אותו כמנהל על</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            {searching && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-200 border-t-violet-700" />
              </div>
            )}
            <input
              value={q}
              onChange={e => { setQ(e.target.value); setSelected(null); }}
              placeholder="חפש לפי שם, מספר אישי..."
              className={INPUT + ' pr-10 focus:border-violet-400 focus:ring-violet-500/20'}
              autoFocus
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
          {!q.trim() ? (
            <div className="py-10 text-center text-sm text-slate-400">הקלד שם לחיפוש</div>
          ) : results.length === 0 && !searching ? (
            <div className="py-10 text-center text-sm text-slate-400">לא נמצאו משתמשים</div>
          ) : results.map(u => (
            <button
              key={u._id}
              type="button"
              onClick={() => setSelected(u)}
              className={clsx(
                'flex w-full items-center gap-3 px-4 py-3 text-right transition-colors',
                selected?._id === u._id ? 'bg-violet-50/90 ring-1 ring-inset ring-violet-100' : 'hover:bg-slate-50'
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-sm font-bold text-violet-700 ring-1 ring-violet-100">
                {u.name?.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-800">{u.name}</div>
                <div className="text-xs text-slate-400">
                  {u.tagId}
                  {u.jobTitle ? ` · ${u.jobTitle}` : ''}
                </div>
              </div>
              {selected?._id === u._id && <Check className="h-4 w-4 shrink-0 text-violet-700" />}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={grant}
            disabled={!selected || submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-violet-800 to-violet-700 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-900/20 transition hover:from-violet-900 hover:to-violet-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Shield className="h-4 w-4" />
            {submitting ? 'מעניק...' : 'הענק הרשאת מנהל על'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   TAB: מאגר משתמשים (כל הרשומים במערכת)
══════════════════════════════════════════════════════ */
function UsersRegistryTab() {
  const { user: currentUser } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [actionErr, setActionErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setActionErr('');
    try {
      const res = await api.get('/users');
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch {
      setUsers([]);
      setActionErr('לא ניתן לטעון את מאגר המשתמשים');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      [u.name, u.username, u.jobTitle, u.tagId].some(v => String(v || '').toLowerCase().includes(q))
    );
  }, [users, search]);

  const removeUser = async (u) => {
    if (String(u._id) === String(currentUser?._id)) return;
    const ok = await confirm({
      title: 'למחוק את המשתמש?',
      message: `${u.name} יוסר מהמערכת. פעולה זו עלולה להשפיע על הרשאות והנחיות.`,
      confirmLabel: 'מחק',
      cancelLabel: 'ביטול',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/users/${u._id}`);
      load();
    } catch (e) {
      setActionErr(e?.response?.data?.message || 'מחיקה נכשלה');
    }
  };

  return (
    <div className="w-full min-w-0 max-w-none space-y-4">
      {ConfirmDialog}

      {actionErr && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200/90 bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-100/70">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          {actionErr}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800">מאגר משתמשים רשומים</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            כל המשתמשים שנרשמו במערכת ({users.length})
          </p>
        </div>
        <div className="relative w-full shrink-0 sm:w-72">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש: שם, מס׳ אישי, תפקיד..."
            className={INPUT + ' pr-9'}
          />
        </div>
      </div>

      <div
        className={clsx(SURFACE, 'flex min-h-0 flex-col overflow-hidden p-0')}
        style={{ maxHeight: 'min(calc(100dvh - 13rem), 56rem)' }}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-gradient-to-l from-slate-50 to-white px-4 py-2.5">
          <span className="text-xs font-semibold text-slate-600">
            מציג {filtered.length} מתוך {users.length}
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400">טוען מאגר...</div>
        ) : (
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="sticky top-0 z-[1] shadow-sm">
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['משתמש', 'מסגרת שיוך', 'מס׳ אישי', 'תפקיד', 'פעולות'].map(h => (
                    <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => {
                  const levels = [u.level1, u.level2, u.level3, u.level4, u.level5].filter(Boolean);
                  const isSelf = String(u._id) === String(currentUser?._id);
                  return (
                    <tr
                      key={u._id}
                      className={clsx(
                        'border-b border-slate-100 transition-colors hover:bg-indigo-50/40',
                        i % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={clsx(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ring-1',
                              u.role === 'admin'
                                ? 'bg-violet-50 text-violet-700 ring-violet-100'
                                : 'bg-indigo-50 text-indigo-700 ring-indigo-100'
                            )}
                          >
                            {u.name?.charAt(0) || '?'}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-800">{u.name}</div>
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {u.role === 'admin' ? (
                                <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 ring-1 ring-violet-200/60">
                                  מנהל על
                                </span>
                              ) : (
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200/70">
                                  מפקד
                                </span>
                              )}
                              {isSelf && (
                                <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800 ring-1 ring-indigo-200/60">
                                  אתה
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 max-w-[14rem]">
                        {levels.length ? (
                          <span className="line-clamp-2" title={levels.join(' › ')}>
                            {levels.join(' › ')}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <code className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200/80">
                          {u.tagId || '—'}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[12rem] truncate" title={u.jobTitle || ''}>
                        {u.jobTitle || '—'}
                      </td>
                      <td className="px-4 py-3 text-left whitespace-nowrap">
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => removeUser(u)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50"
                            title="מחיקה מהמערכת"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            מחק
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-14 text-center text-slate-400">
                      {users.length === 0 ? 'אין משתמשים רשומים' : 'לא נמצאו תוצאות לחיפוש'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════ */
const TABS = [
  { id: 'overview',     label: 'סקירה',          icon: BarChart3   },
  { id: 'users',        label: 'מאגר משתמשים',   icon: Users       },
  { id: 'environments', label: 'ניהול סביבות',   icon: Building2   },
  { id: 'super-admins', label: 'מנהלי על',       icon: Shield      },
];

export default function AnalyticsPage() {
  const { user, isSuperAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');

  if (loading) return (
    <div className="flex h-[100dvh] min-h-[100dvh] w-full items-center justify-center bg-gradient-to-br from-slate-100 via-zinc-50 to-slate-200/80">
      <div className="text-slate-400 text-sm">טוען...</div>
    </div>
  );

  if (!isSuperAdmin) return <Navigate to="/admin" replace />;

  return (
    <div
      className="flex h-[100dvh] min-h-[100dvh] w-full min-w-0 max-w-none flex-col overflow-hidden bg-gradient-to-br from-slate-100 via-zinc-50 to-slate-200/90"
      style={{ fontFamily: "'Segoe UI', ui-sans-serif, system-ui, sans-serif", direction: 'rtl' }}
    >

      {/* ── Top Bar ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-gradient-to-l from-slate-900 via-slate-900 to-indigo-950 px-5 shadow-md sm:px-6">
        <div className="flex items-center gap-4 h-full">
          <button onClick={() => navigate('/admin')}
            className="flex items-center gap-1.5 text-sm text-white/75 hover:text-white transition-colors h-full px-2">
            <ChevronLeft className="h-4 w-4" />
            <span>Mission 360</span>
          </button>
          <div className="w-px h-5 bg-white/25" />
          <div className="flex items-center gap-2.5">
            <BarChart3 className="h-5 w-5 text-white" />
            <div className="flex items-baseline gap-2">
              <span className="text-white font-semibold">מרכז ניהול</span>
              <span className="text-white/50 text-xs hidden sm:block">Admin Center</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-white">
            {user?.name?.charAt(0) || 'מ'}
          </div>
          <span className="text-sm text-white/80 hidden sm:block">{user?.name}</span>
        </div>
      </header>

      {/* ── Tab Nav ── */}
      <div className="shrink-0 border-b border-slate-200/80 bg-white/90 px-3 py-2 backdrop-blur-sm sm:px-5">
        <nav className="flex flex-wrap gap-1">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={clsx(
                  'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
                  tab === t.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <Icon className="h-4 w-4 opacity-90" strokeWidth={2} />
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Content — רוחב מלא, גלילה רק באזור התוכן ── */}
      <main className="flex-1 min-h-0 w-full min-w-0 max-w-none overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6">
        {tab === 'overview'     && <OverviewTab />}
        {tab === 'users'        && <UsersRegistryTab />}
        {tab === 'environments' && <EnvironmentsTab />}
        {tab === 'super-admins' && <SuperAdminsTab />}
      </main>
    </div>
  );
}
