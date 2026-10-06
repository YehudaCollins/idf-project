import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, ShieldCheck, Pencil, Trash2, Search,
  Shield, Eye, X, UserPlus, AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { safeImageSrc } from '../lib/safeImageSrc';
const ACCENT   = '#c47f17';
const ACCENT_H = '#a0660e';

const PERM_CFG = {
  manager: { label: 'מנהל סביבה', Icon: Shield, bg: '#fff8e6', color: '#92600f', border: '#f0d080' },
  viewer:  { label: 'מפקד',        Icon: Eye,   bg: '#f0f6ff', color: '#2d5fa8', border: '#b8d0f8' },
};

/* ─── helpers ───────────────────────────────────────── */
function Avatar({ name, role, imageUrl }) {
  const src = safeImageSrc(imageUrl);
  return (
    <div
      className={clsx(
        'h-9 w-9 rounded-[11px] flex items-center justify-center overflow-hidden text-[14px] font-bold flex-shrink-0',
        role === 'admin'
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
      )}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : (name?.charAt(0) || '?')}
    </div>
  );
}

function Btn({ children, onClick, disabled, variant = 'primary', size = 'md', className = '' }) {
  const sizes = { sm: 'px-3 py-1.5 text-[12px]', md: 'px-4 py-2.5 text-[13px]' };
  const variants = {
    primary: 'text-white shadow-sm',
    ghost:   'bg-transparent text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
    outline: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800',
    danger:  'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/70 dark:hover:bg-red-900/40',
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={clsx('inline-flex items-center justify-center gap-1.5 font-medium rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed', sizes[size], variants[variant], className)}
      style={variant === 'primary' ? { background: `linear-gradient(135deg,${ACCENT},${ACCENT_H})` } : {}}>
      {children}
    </button>
  );
}

/* ── SectionHeader ────────────────────────────────── */
function SectionHeader({ icon: Icon, title, action }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 dark:bg-slate-800/50 dark:border-slate-700">
      <div className="flex items-center gap-2.5">
        <div className="w-1 h-5 bg-gradient-to-b from-[#c47f17] to-[#a0660e] rounded-full" />
        {Icon && <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />}
        <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{title}</span>
      </div>
      {action}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   TABS
══════════════════════════════════════════════════════ */
const TABS_ADMIN   = ['users', 'permissions'];
const TABS_MANAGER = ['permissions'];
const TAB_LABELS   = {
  users:       { label: 'משתמשים',       Icon: Users },
  permissions: { label: 'הרשאות סביבה', Icon: ShieldCheck },
};

export default function SystemPage() {
  const { isSuperAdmin } = useAuth();
  const tabs = isSuperAdmin ? TABS_ADMIN : TABS_MANAGER;
  const [tab, setTab] = useState(isSuperAdmin ? 'users' : 'permissions');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold text-slate-900 dark:text-slate-100">ניהול משתמשים</h1>
        <p className="text-[13px] text-slate-500 mt-0.5 dark:text-slate-400">ניהול גישה והרשאות סביבות</p>
      </div>

      {tabs.length > 1 && (
        <div className="flex gap-0 border-b border-slate-200 dark:border-slate-700">
          {tabs.map(id => {
            const { label, Icon } = TAB_LABELS[id];
            return (
              <button key={id} onClick={() => setTab(id)}
                className={clsx('flex items-center gap-2 px-5 py-3 text-[14px] font-medium transition-all border-b-2 -mb-px',
                  tab === id
                    ? 'text-[#c47f17] border-[#c47f17]'
                    : 'text-slate-500 border-transparent hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200')}>
                <Icon className="h-4 w-4" />{label}
              </button>
            );
          })}
        </div>
      )}

      {tab === 'users'       && <UsersTab isSuperAdmin={isSuperAdmin} />}
      {tab === 'permissions' && <PermissionsTab isSuperAdmin={isSuperAdmin} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   TAB: USERS (מנהל על בלבד)
══════════════════════════════════════════════════════ */
function UsersTab({ isSuperAdmin }) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [users, setUsers]   = useState([]);
  const [envCount, setEnvCount] = useState(0);
  const [totalManagers, setTotalManagers] = useState(0);
  const [managerUserIds, setManagerUserIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, envsRes] = await Promise.all([
        api.get('/users'),
        api.get('/environments').catch(() => ({ data: [] })),
      ]);
      setUsers(usersRes.data);
      const envs = Array.isArray(envsRes.data) ? envsRes.data : [];
      setEnvCount(envs.length);
      const adminIds = new Set(
        (usersRes.data || [])
          .filter(u => u.role === 'admin')
          .map(u => String(u._id))
      );

      // סה"כ מנהלים רגילים (לא מנהל על) = משתמשים עם הרשאת manager לפחות בסביבה אחת
      const permResponses = await Promise.all(
        envs.map(env => api.get(`/environments/${env._id}/permissions`).catch(() => ({ data: [] })))
      );
      const managerIds = new Set();
      permResponses.forEach(res => {
        (res.data || []).forEach(p => {
          const uid = p.userId?._id || p.userId;
          if (p.type === 'manager' && uid && !adminIds.has(String(uid))) managerIds.add(String(uid));
        });
      });
      setTotalManagers(managerIds.size);
      setManagerUserIds(managerIds);
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const del = async (id) => {
    const ok = await confirm({
      title: 'למחוק את המשתמש?',
      message: 'המשתמש יוסר מהמערכת. פעולה זו עלולה להשפיע על הרשאות קיימות.',
      confirmLabel: 'מחק',
      cancelLabel: 'ביטול',
      variant: 'danger',
    });
    if (!ok) return;
    await api.delete(`/users/${id}`);
    load();
  };

  const list = users.filter(u => {
    const isManager = u.role === 'admin' || managerUserIds.has(String(u._id));
    if (roleFilter === 'manager' && !isManager) return false;
    if (roleFilter === 'regular' && isManager) return false;
    if (!search.trim()) return true;
    return [
      u.name,
      u.username,
      u.jobTitle,
      u.rank,
      u.militaryRole,
      u.tagId,
      u.email,
      u.sourceSystem,
      u.level1,
      u.level2,
      u.level3,
      u.level4,
      u.level5,
    ].some(v => String(v || '').includes(search.trim()));
  });
  const visibleUsers = search.trim() ? list : list.slice(0, visibleCount);

  return (
    <div className="space-y-4">
      {ConfirmDialog}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm dark:bg-slate-900 dark:border-slate-700">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">סה"כ משתמשים</p>
          <p className="text-[20px] font-bold text-slate-800 mt-1 dark:text-slate-100">{users.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm dark:bg-slate-900 dark:border-slate-700">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">סה&quot;כ סביבות</p>
          <p className="text-[20px] font-bold text-amber-700 mt-1">{envCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm dark:bg-slate-900 dark:border-slate-700">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">סה&quot;כ מנהלים</p>
          <p className="text-[20px] font-bold text-slate-700 mt-1 dark:text-slate-200">{totalManagers}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm dark:bg-slate-900 dark:border-slate-700">
        <SectionHeader icon={Users} title={`כל המשתמשים — ${users.length}`}
          action={
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-950">
                {[
                  { id: 'all', label: 'הכל' },
                  { id: 'manager', label: 'מנהלים' },
                  { id: 'regular', label: 'רגילים' },
                ].map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => { setRoleFilter(option.id); setVisibleCount(20); }}
                    className={clsx(
                      'rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                      roleFilter === option.id ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                <input value={search} onChange={e => { setSearch(e.target.value); setVisibleCount(20); }} placeholder="חיפוש לפי שם, מס אישי או תפקיד..."
                  className="pr-8 pl-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c47f17]/30 w-64 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500" />
              </div>
            </div>
          } />

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm dark:text-slate-500">טוען...</div>
        ) : (
          <div style={{ maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-100 bg-slate-50/80 dark:bg-slate-800/80 dark:border-slate-700">
                {['משתמש', 'מסגרת שיוך', 'מ. אישי', 'תפקיד', ''].map(h => (
                  <th key={h} className="px-5 py-3.5 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider dark:text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((u, i) => {
                        const levels = [u.level1, u.level2, u.level3, u.level4, u.level5].filter(Boolean);
                return (
                  <tr key={u._id} className={clsx('group transition-colors hover:bg-amber-50/30 dark:hover:bg-slate-800/60', i%2===0?'bg-white dark:bg-slate-900':'bg-slate-50/40 dark:bg-slate-800/40')}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} role={u.role} imageUrl={u.profileImageUrl} />
                        <div>
                          <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{u.name}</div>
                          {u.role === 'admin' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">מנהל על</span>}
                          {u.sourceSystem && <span className="mr-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{u.sourceSystem}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-slate-500 dark:text-slate-400">
                      {levels.length ? (
                        <div className="flex flex-wrap items-center gap-x-1">
                          {levels.map((lvl, idx) => (
                            <span key={`${u._id}-${idx}`}>
                              {lvl}{idx < levels.length - 1 && <span className="mx-1 text-slate-300 dark:text-slate-600">›</span>}
                            </span>
                          ))}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3.5"><code className="text-[11px] bg-slate-100 px-2 py-1 rounded text-slate-600 dark:bg-slate-800 dark:text-slate-300">{u.tagId || '—'}</code></td>
                    <td className="px-5 py-3.5 text-[13px] text-slate-500 dark:text-slate-400">{u.jobTitle || '—'}</td>
                    <td className="px-5 py-3.5">
                      {isSuperAdmin && (
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100">
                          <button onClick={() => del(u._id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:text-slate-500 dark:hover:bg-red-950/40">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visibleUsers.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-slate-400 text-sm dark:text-slate-500">אין משתמשים</td></tr>
              )}
            </tbody>
          </table>
          {!search.trim() && visibleUsers.length < list.length && (
            <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-center dark:border-slate-700 dark:bg-slate-800/50">
              <button
                type="button"
                onClick={() => setVisibleCount(count => count + 20)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-600 shadow-sm transition hover:border-[#c47f17]/40 hover:text-[#c47f17] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                הצג עוד ({list.length - visibleUsers.length})
              </button>
            </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   TAB: PERMISSIONS
══════════════════════════════════════════════════════ */
function PermissionsTab({ isSuperAdmin }) {
  const { envPermissions } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();
  const [envs, setEnvs]         = useState([]);
  const [selId, setSelId]       = useState(null);
  const [perms, setPerms]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [showAdd, setShowAdd]   = useState(false);
  const [editPermUser, setEditPermUser] = useState(null);
  const [filterType, setFilter] = useState('all');

  const loadEnvs = useCallback(async () => {
    try {
      const r = await api.get('/environments');
      let list = r.data;
      if (!isSuperAdmin) {
        const mine = new Set(envPermissions.filter(p => p.type === 'manager').map(p => p.environmentId));
        list = list.filter(e => mine.has(e._id));
      }
      setEnvs(list);
      if (list.length && !selId) setSelId(list[0]._id);
    } catch {}
  }, [isSuperAdmin, envPermissions, selId]);

  const loadPerms = useCallback(async () => {
    if (!selId) return;
    setLoading(true);
    try { const r = await api.get(`/environments/${selId}/permissions`); setPerms(r.data); }
    finally { setLoading(false); }
  }, [selId]);

  useEffect(() => { loadEnvs(); }, [loadEnvs]);
  useEffect(() => { loadPerms(); }, [loadPerms]);

  const removePerm = async (userId) => {
    const ok = await confirm({
      title: 'להסיר גישה לסביבה?',
      message: 'המשתמש יאבד גישה לסביבה שנבחרה.',
      confirmLabel: 'הסר',
      cancelLabel: 'ביטול',
      variant: 'danger',
    });
    if (!ok) return;
    await api.delete(`/environments/${selId}/permissions/${userId}`);
    loadPerms();
  };

  const [searchPerms, setSearchPerms] = useState('');

  const selEnv   = envs.find(e => e._id === selId);
  const managers = perms.filter(p => p.type === 'manager');
  const viewers  = perms.filter(p => p.type === 'viewer');
  const displayed = (filterType === 'all' ? perms : perms.filter(p => p.type === filterType))
    .filter(p => !searchPerms.trim() ||
      p.userId?.name?.includes(searchPerms) ||
      p.userId?.tagId?.includes(searchPerms) ||
      p.userId?.jobTitle?.includes(searchPerms)
    );

  return (
    <div className="space-y-4">
      {ConfirmDialog}

      {/* ── בחירת סביבה (pills) ── */}
      {envs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {envs.map(e => (
            <button key={e._id} onClick={() => { setSelId(e._id); setFilter('all'); setSearchPerms(''); }}
              className={clsx('px-4 py-2 rounded-xl text-[13px] font-medium border transition-all',
                selId === e._id ? 'text-white border-transparent shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-[#c47f17]/50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700')}
              style={selId === e._id ? { background: `linear-gradient(135deg,${ACCENT},${ACCENT_H})` } : {}}>
              {e.name}
            </button>
          ))}
        </div>
      )}

      {/* ── פאנל הרשאות ── */}
      {selEnv ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-700">

          {/* Header שורה 1: שם + כפתור */}
          <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="text-[16px] font-bold text-slate-800 dark:text-slate-100">{selEnv.name}</h2>
            <Btn onClick={() => setShowAdd(true)}>
              <UserPlus className="h-4 w-4" />הוסף לסביבה
            </Btn>
          </div>

          {/* Header שורה 2: פילטר + חיפוש */}
          <div className="px-5 py-3 flex items-center justify-between gap-3 bg-slate-50/60 border-b border-slate-100 dark:bg-slate-800/50 dark:border-slate-700">
            <div className="flex bg-white border border-slate-200 p-0.5 rounded-lg gap-0.5 dark:bg-slate-900 dark:border-slate-700">
              {[
                { id: 'all',     label: 'הכל',     count: perms.length },
                { id: 'manager', label: 'מנהלים',   count: managers.length },
                { id: 'viewer',  label: 'מפקדים',   count: viewers.length },
              ].map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all',
                    filterType === f.id ? 'bg-slate-800 text-white shadow-sm dark:bg-slate-700' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200')}>
                  {f.label}
                  <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded',
                    filterType === f.id ? 'bg-white/20 text-white' : 'text-slate-400 dark:text-slate-500')}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <input
                value={searchPerms}
                onChange={e => setSearchPerms(e.target.value)}
                placeholder="חיפוש..."
                className="pr-8 pl-3 py-1.5 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#c47f17]/30 w-44 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* רשימה מאוחדת */}
          {loading ? (
            <div className="py-14 text-center text-slate-400 text-sm">טוען...</div>
          ) : displayed.length === 0 ? (
            <div className="py-14 text-center">
              <Shield className="h-8 w-8 text-slate-200 mx-auto mb-2" />
              <p className="text-[13px] text-slate-400">
                {searchPerms ? `לא נמצא "${searchPerms}"` : filterType === 'all' ? 'אין משתמשים בסביבה זו' : `אין ${filterType === 'manager' ? 'מנהלים' : 'מפקדים'}`}
              </p>
              {!searchPerms && (
                <button onClick={() => setShowAdd(true)} className="mt-3 text-[12px] font-semibold text-[#c47f17] hover:underline">
                  + הוסף ראשון
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800" style={{ maxHeight: 'calc(100vh - 520px)', minHeight: '160px', overflowY: 'auto' }}>
              {displayed.map(p => {
                const cfg = PERM_CFG[p.type] || PERM_CFG.viewer;
                return (
                  <div key={p._id} className="flex items-center justify-between px-5 py-3.5 group hover:bg-slate-50/50 transition-colors dark:hover:bg-slate-800/70">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-[10px] flex items-center justify-center text-[14px] font-bold flex-shrink-0"
                        style={{ background: cfg.bg, color: cfg.color }}>
                        {p.userId?.name?.charAt(0)}
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{p.userId?.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                            {p.userId?.tagId || p.userId?.username || '—'}
                          </code>
                          {p.userId?.jobTitle && <span className="text-[11px] text-slate-400 dark:text-slate-500">{p.userId.jobTitle}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border"
                        style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
                        <cfg.Icon className="h-3 w-3" />{cfg.label}
                      </span>
                      <button
                        onClick={() => setEditPermUser({
                          ...p.userId,
                          permissions: p.type,
                          inSystem: true,
                          alreadyInEnv: true,
                        })}
                        className="p-1.5 text-slate-300 hover:text-[#c47f17] hover:bg-amber-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-slate-800"
                        title="עריכת הרשאה"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {(isSuperAdmin || p.type === 'viewer') && (
                        <button onClick={() => removePerm(p.userId?._id)}
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-red-950/40">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center dark:bg-slate-900 dark:border-slate-700">
          <Shield className="h-10 w-10 text-slate-200 mx-auto mb-3 dark:text-slate-700" />
          <p className="text-slate-400 font-medium dark:text-slate-500">בחר סביבה מלמעלה</p>
        </div>
      )}

      {showAdd && selEnv && (
        <AddMemberModal
          envId={selId}
          envName={selEnv.name}
          existingUserIds={perms.map(p => p.userId?._id || p.userId)}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setShowAdd(false)}
          onDone={() => { setShowAdd(false); loadPerms(); }}
        />
      )}
      {editPermUser && selEnv && (
        <AddMemberModal
          envId={selId}
          envName={selEnv.name}
          existingUserIds={perms.map(p => p.userId?._id || p.userId)}
          isSuperAdmin={isSuperAdmin}
          initialUser={editPermUser}
          onClose={() => setEditPermUser(null)}
          onDone={() => { setEditPermUser(null); loadPerms(); }}
        />
      )}
    </div>
  );
}

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

/* ══════════════════════════════════════════════════════
   AddMemberModal — שלב 1: חיפוש  •  שלב 2: הרשאה
══════════════════════════════════════════════════════ */
function AddMemberModal({ envId, envName, existingUserIds, isSuperAdmin, managerOnly = false, initialUser = null, onClose, onDone }) {
  const [q, setQ]               = useState('');
  const [results, setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(initialUser);
  const [permType, setPermType] = useState(initialUser?.permissions || (managerOnly ? 'manager' : 'viewer'));
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr]           = useState('');
  const debounceRef = useRef(null);

  /* ── חיפוש live ── */
  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const all = await api.get(`/environments/${envId}/permissions/users-without`);
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
        setErr(e?.response?.data?.message || 'אין הרשאה לחיפוש משתמשים');
      } finally { setSearching(false); }
    }, 150);
  }, [q, envId, existingUserIds]);

  const selectUser = (u) => {
    setSelected({
      ...u,
      inSystem: u.inSystem !== undefined ? u.inSystem : Boolean(u._id),
      alreadyInEnv: u._id ? existingUserIds.includes(u._id) : false,
    });
    setErr('');
  };

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true); setErr('');
    try {
      let userId = selected._id;
      if (!selected.inSystem) {
        const r = await api.post('/users', {
          ...selected,
          environmentId: envId,
          permissions: permType,
          role: permType === 'admin' ? 'admin' : 'commander',
        });
        userId = r.data._id;
      }
      if (permType === 'admin') {
        await api.put(`/users/${userId}`, { role: 'admin' });
      } else {
        await api.post(`/environments/${envId}/permissions`, { userId, type: permType });
      }
      onDone();
    } catch (e) { setErr(e.response?.data?.message || 'שגיאה בשמירה'); }
    finally { setSubmitting(false); }
  };

  const permOptions = managerOnly
    ? [{ val: 'manager', label: 'מנהל סביבה', sub: 'מנהל הנחיות בסביבה זו', Icon: Shield }]
    : [
        { val: 'viewer',  label: 'מפקד',       sub: 'רואה הנחיות שלו בלבד',  Icon: Eye },
        ...(isSuperAdmin ? [{ val: 'manager', label: 'מנהל סביבה', sub: 'מנהל הנחיות בסביבה זו', Icon: Shield }] : []),
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div
        className="relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-700"
        style={{ width: 'min(94vw, 560px)', height: '64vh', maxHeight: '64vh' }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Header כהה ── */}
        <div className="shrink-0 flex items-center justify-between px-6 py-5"
          style={{ background: 'linear-gradient(135deg, #1c1c1c 0%, #252525 100%)' }}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(196,127,23,0.8)' }}>
              {selected ? 'שלב 2 — בחירת הרשאה' : 'שלב 1 — חיפוש משתמש'}
            </p>
            <h2 className="text-[20px] font-bold text-white leading-tight">
              {selected ? selected.name : 'הוסף משתמש לסביבה'}
            </h2>
            <p className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{envName}</p>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 dark:bg-slate-950">

          {/* ══ שלב 1: חיפוש ══ */}
          {!selected ? (
            <div className="flex flex-col h-full">
              {/* שדה חיפוש */}
              <div className="px-5 pt-4 pb-3 bg-white border-b border-slate-100 dark:bg-slate-900 dark:border-slate-700">
                <div className="relative">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  {searching && (
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-[#c47f17]/30 border-t-[#c47f17] animate-spin" />
                    </div>
                  )}
                  <input
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder="שם, מספר אישי או תפקיד..."
                    className="w-full pr-10 pl-4 py-3 rounded-xl border border-slate-200 text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#c47f17]/30 focus:border-[#c47f17] transition-colors bg-white dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
                    autoFocus={!initialUser}
                  />
                </div>
              </div>

              {/* תוצאות */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {!q.trim() ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center px-6 gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                      <Search className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="text-[13px] text-slate-500 font-medium">חפש לפי שם, מספר חוגר או תפקיד</p>
                    <p className="text-[11px] text-slate-400">התוצאות יופיעו בזמן אמת</p>
                  </div>
                ) : results.length === 0 && !searching ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center px-6 gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                      <Search className="h-5 w-5 text-slate-300" />
                    </div>
                    <p className="text-[13px] font-medium text-slate-500">לא נמצאו תוצאות עבור "{q}"</p>
                  </div>
                ) : (
                  results.map((u, i) => {
                    const inEnv = u._id && existingUserIds.includes(u._id);
                    return (
                      <button key={u._id || u.tagId || i} type="button"
                        onClick={() => selectUser(u)}
                        className="w-full flex items-center gap-4 px-5 py-4 text-right bg-white hover:bg-amber-50/60 transition-colors group dark:bg-slate-900 dark:hover:bg-slate-800/80">
                        {/* אווטאר */}
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center text-[15px] font-bold flex-shrink-0"
                          style={{
                            background: u._unitree ? 'rgba(59,130,246,0.12)' : 'rgba(196,127,23,0.12)',
                            color: u._unitree ? '#2563eb' : '#c47f17',
                          }}>
                          {safeImageSrc(u.profileImageUrl) ? (
                            <img src={safeImageSrc(u.profileImageUrl)} alt="" className="h-full w-full rounded-xl object-cover" />
                          ) : (u.name || '?').charAt(0)}
                        </div>
                        {/* מידע */}
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] font-semibold text-slate-800 truncate dark:text-slate-100">{u.name}</div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {u.tagId && <span className="text-[11px] text-slate-400 font-mono dark:text-slate-500">{u.tagId}</span>}
                            {u.tagId && u.jobTitle && <span className="text-slate-300 text-[10px]">•</span>}
                            {u.jobTitle && <span className="text-[11px] text-slate-400 dark:text-slate-500">{u.jobTitle}</span>}
                          </div>
                        </div>
                        {/* badges */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {u._unitree && (
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                              Unitree
                            </span>
                          )}
                          {inEnv && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                              בסביבה
                            </span>
                          )}
                          {!inEnv && (
                            <span className="text-slate-300 group-hover:text-amber-400 transition-colors text-[18px]">›</span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

          ) : (
            /* ══ שלב 2: הרשאה ══ */
            <div className="flex flex-col h-full">

              {/* כרטיס משתמש + כפתור שינוי */}
              <div className="px-5 py-4 bg-white border-b border-slate-100 dark:bg-slate-900 dark:border-slate-700">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center text-[18px] font-bold flex-shrink-0"
                    style={{ background: 'rgba(196,127,23,0.12)', color: '#c47f17' }}>
                    {safeImageSrc(selected.profileImageUrl) ? (
                      <img src={safeImageSrc(selected.profileImageUrl)} alt="" className="h-full w-full rounded-xl object-cover" />
                    ) : selected.name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-bold text-slate-800 truncate dark:text-slate-100">{selected.name}</div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {selected.tagId && <span className="text-[11px] text-slate-400 font-mono dark:text-slate-500">{selected.tagId}</span>}
                      {selected.tagId && selected.jobTitle && <span className="text-slate-300 text-[10px]">•</span>}
                      {selected.jobTitle && <span className="text-[11px] text-slate-400 dark:text-slate-500">{selected.jobTitle}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => { setSelected(null); setQ(''); setErr(''); }}
                    className="shrink-0 text-[12px] font-medium text-slate-400 hover:text-[#c47f17] px-3 py-1.5 rounded-lg border border-slate-200 hover:border-[#c47f17]/40 transition-all dark:border-slate-700 dark:text-slate-500">
                    ‹ שנה
                  </button>
                </div>
                {/* status chip */}
                <div className="mt-2.5 flex gap-2">
                  {selected.alreadyInEnv && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                      כבר בסביבה — עדכון הרשאה
                    </span>
                  )}
                  {!selected.inSystem && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                      מיוניטרי — יירשם במערכת
                    </span>
                  )}
                  {selected.inSystem && !selected.alreadyInEnv && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      ✓ רשום במערכת
                    </span>
                  )}
                </div>
              </div>

              {/* בחירת הרשאה */}
              <div className="flex-1 px-5 py-5 space-y-3">
                <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-3 dark:text-slate-500">בחר הרשאה לסביבה</p>

                {!managerOnly ? permOptions.map(({ val, label, sub, Icon: PIcon }) => (
                  <button key={val} type="button" onClick={() => setPermType(val)}
                    className={clsx(
                      'w-full flex items-center gap-4 px-4 py-4 rounded-xl border-2 text-right transition-all',
                      permType === val
                        ? 'border-[#c47f17] bg-amber-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                    )}>
                    <div className={clsx('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0',
                      permType === val ? 'bg-amber-100' : 'bg-slate-100')}>
                      <PIcon className={clsx('h-5 w-5', permType === val ? 'text-[#c47f17]' : 'text-slate-400 dark:text-slate-500')} />
                    </div>
                    <div className="flex-1">
                      <div className={clsx('text-[14px] font-bold', permType === val ? 'text-[#c47f17]' : 'text-slate-700')}>
                        {label}
                      </div>
                      <div className="text-[12px] text-slate-400 mt-0.5 dark:text-slate-500">{sub}</div>
                    </div>
                    <div className={clsx('h-5 w-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all',
                      permType === val ? 'border-[#c47f17] bg-[#c47f17]' : 'border-slate-300')}>
                      {permType === val && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                  </button>
                )) : (
                  <div className="flex items-center gap-4 px-4 py-4 rounded-xl border-2 border-[#c47f17] bg-amber-50">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Shield className="h-5 w-5 text-[#c47f17]" />
                    </div>
                    <div>
                      <div className="text-[14px] font-bold text-[#c47f17]">מנהל סביבה</div>
                      <div className="text-[12px] text-amber-600 mt-0.5">מנהל הנחיות בסביבה זו</div>
                    </div>
                  </div>
                )}

                {err && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mt-2">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <span className="text-[13px] text-red-700">{err}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="shrink-0 px-5 py-4 border-t border-slate-100 bg-white flex gap-3 dark:bg-slate-900 dark:border-slate-700">
                <button onClick={onClose}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                  ביטול
                </button>
                <button onClick={submit} disabled={submitting}
                  className="flex-1 py-3 rounded-xl text-[13px] font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2 transition-all"
                  style={{ background: 'linear-gradient(135deg, #c47f17, #a0660e)' }}>
                  <UserPlus className="h-4 w-4" />
                  {submitting ? 'שומר...'
                    : selected?.alreadyInEnv ? 'עדכן הרשאה'
                    : !selected?.inSystem    ? 'רשום והוסף'
                    :                          'הוסף לסביבה'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
