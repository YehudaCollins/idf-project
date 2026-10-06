import { useState, useEffect, useCallback } from 'react';
import { Search, UserPlus, Pencil, Trash2, X, Crown, Shield, Eye } from 'lucide-react';
import clsx from 'clsx';
import api from '../api/axios';
import { UserForm } from '../components/users/UserForm';
import { useConfirm } from '../hooks/useConfirm';
import { AlertModal } from '../components/ui/ConfirmModal';
import { safeImageSrc } from '../lib/safeImageSrc';

const PERMISSION_LABELS = { admin: 'מנהל', manager: 'מנהל צוות', viewer: 'צופה' };

const permConfig = {
  admin:   { label: 'מנהל',       badge: 'bg-amber-50 text-amber-700 border border-amber-200',   Icon: Crown,  color: '#c47f17' },
  manager: { label: 'מנהל צוות', badge: 'bg-teal-50 text-teal-700 border border-teal-200',       Icon: Shield, color: '#0d9488' },
  viewer:  { label: 'צופה',       badge: 'bg-gray-100 text-gray-500 border border-gray-200',      Icon: Eye,    color: '#9ca3af' },
};

function effectivePermission(user) {
  if (user.role === 'admin') return 'admin';
  return user.permissions || user.envPermType || 'viewer';
}

function UserAvatar({ name, imageUrl }) {
  const initial = name?.trim().charAt(0)?.toUpperCase() || '?';
  const src = safeImageSrc(imageUrl);
  return (
    <div className="h-10 w-10 overflow-hidden rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
      style={{ background: 'rgba(196,127,23,0.12)', color: '#c47f17' }}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initial}
    </div>
  );
}

function LevelsPath({ user }) {
  const levels = [user.level1, user.level2, user.level3, user.level4, user.level5].filter(Boolean);
  if (!levels.length) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
      {levels.map((l, i) => (
        <span key={i} className="text-xs text-gray-500">
          {l}{i < levels.length - 1 && <span className="mx-0.5 text-gray-300">›</span>}
        </span>
      ))}
    </div>
  );
}

function StatCard({ label, count, color }) {
  return (
    <div className="flex items-center gap-2.5 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
      <div className="h-8 w-8 rounded-lg flex items-center justify-center text-base font-bold flex-shrink-0"
        style={{ background: `${color}15`, color }}>
        {count}
      </div>
      <span className="text-sm text-gray-500 leading-tight">{label}</span>
    </div>
  );
}

export default function AdminUsersPage({ selectedEnv }) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [visibleCount, setVisibleCount] = useState(20);
  const [editUser, setEditUser] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saveAlert, setSaveAlert] = useState(null);

  const fetchUsers = useCallback(async () => {
    if (!selectedEnv) return;
    setLoading(true);
    try {
      const res = await api.get(`/users?environmentId=${selectedEnv._id}`);
      setUsers(res.data);
    } finally { setLoading(false); }
  }, [selectedEnv]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'למחוק את המשתמש?',
      message: 'המשתמש יוסר מהמערכת. פעולה זו עשויה להשפיע על הרשאות.',
      confirmLabel: 'מחק',
      cancelLabel: 'ביטול',
      variant: 'danger',
    });
    if (!ok) return;
    await api.delete(`/users/${id}`);
    fetchUsers();
  };

  const handleSave = async (form) => {
    try {
      if (editUser) {
        const updates = { ...form };
        await api.put(`/users/${editUser._id}`, updates);
      } else {
        await api.post('/users', { ...form, environmentId: selectedEnv._id });
      }
      fetchUsers(); setShowAdd(false); setEditUser(null);
    } catch (err) {
      setSaveAlert({ title: 'שגיאה', message: err.response?.data?.message || 'שגיאה' });
    }
  };

  const filtered = users.filter(u => {
    const perm = effectivePermission(u);
    if (filterRole === 'manager' && !['admin', 'manager'].includes(perm)) return false;
    if (filterRole === 'regular' && ['admin', 'manager'].includes(perm)) return false;
    const q = search.trim();
    if (!q) return true;
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
    ].some(v => String(v || '').includes(q));
  });
  const visibleUsers = search.trim() ? filtered : filtered.slice(0, visibleCount);

  const counts = {
    admin:   users.filter(u => effectivePermission(u) === 'admin').length,
    manager: users.filter(u => effectivePermission(u) === 'manager').length,
    viewer:  users.filter(u => effectivePermission(u) === 'viewer').length,
  };

  if (!selectedEnv) return (
    <div className="flex h-64 items-center justify-center text-gray-400">
      <p className="text-lg font-medium">בחר סביבה מהדשבורד כדי לנהל משתמשים</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {ConfirmDialog}

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ניהול משתמשים</h1>
          <p className="text-sm text-gray-400 mt-0.5">הרשאות וניהול אנשי הסביבה</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-xl shadow-sm transition-all hover:opacity-90 active:scale-[0.97]"
          style={{ background: 'linear-gradient(to left, #a0660e, #c47f17)' }}
        >
          <UserPlus className="h-4 w-4" />
          הוספת משתמש
        </button>
      </div>

      {/* ── Stats row ── */}
      <div className="flex flex-wrap gap-3">
        <StatCard label="סה&quot;כ משתמשים" count={users.length} color="#64748b" />
        <StatCard label="מנהלים" count={counts.admin} color="#c47f17" />
        <StatCard label="מנהלי צוות" count={counts.manager} color="#0d9488" />
        <StatCard label="צופים" count={counts.viewer} color="#9ca3af" />
      </div>

      {/* ── Search ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] max-w-sm flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            placeholder="חיפוש לפי שם, מספר אישי, תפקיד, יחידה..."
            value={search}
            onChange={e => { setSearch(e.target.value); setVisibleCount(20); }}
            className="w-full pr-10 pl-3 py-2 bg-white border border-gray-200 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300/60 focus:border-amber-300"
          />
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 text-[12px] shadow-sm">
          {[
            { id: 'all', label: 'הכל' },
            { id: 'manager', label: 'מנהלים' },
            { id: 'regular', label: 'רגילים' },
          ].map(option => (
            <button
              key={option.id}
              type="button"
              onClick={() => { setFilterRole(option.id); setVisibleCount(20); }}
              className={clsx(
                'rounded-lg px-3 py-1.5 font-semibold transition',
                filterRole === option.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">טוען...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'linear-gradient(to left, #1c1c1c, #252525)' }}>
                {[
                  { label: 'משתמש', w: '' },
                  { label: 'מסגרת', w: 'w-[30%]' },
                  { label: 'הרשאות', w: 'w-28' },
                  { label: 'פעולות', w: 'w-24' },
                ].map(({ label, w }) => (
                  <th key={label} className={clsx('px-4 py-3.5 text-right text-xs font-semibold text-gray-400 tracking-wide uppercase', w)}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visibleUsers.map(u => {
                const perm = permConfig[effectivePermission(u)] || permConfig.viewer;
                return (
                  <tr key={u._id} className="group hover:bg-amber-50/30 transition-colors">

                    {/* User cell */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar name={u.name} imageUrl={u.profileImageUrl} />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-800 truncate">{u.name}</div>
                          <div className="text-xs text-gray-400 truncate">
                            {[u.rank, u.militaryRole || u.jobTitle, u.tagId].filter(Boolean).join(' · ') || u.username}
                          </div>
                          {(u.sourceSystem || u.registeredVia) && (
                            <div className="mt-1 text-[10px] font-semibold text-amber-700">
                              {u.registeredVia || u.sourceSystem}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Levels as breadcrumb */}
                    <td className="px-4 py-3.5">
                      <LevelsPath user={u} />
                    </td>

                    {/* Permission badge */}
                    <td className="px-4 py-3.5">
                      <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium', perm.badge)}>
                        <perm.Icon className="h-3 w-3" />
                        {perm.label}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditUser(u)}
                          className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title="עריכה"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(u._id)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="מחיקה"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-400 text-sm">
                    {search ? 'לא נמצאו משתמשים התואמים לחיפוש' : 'אין משתמשים בסביבה זו'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {!search.trim() && visibleUsers.length < filtered.length && (
            <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount(count => count + 20)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-600 shadow-sm transition hover:border-amber-300 hover:text-amber-700"
              >
                הצג עוד ({filtered.length - visibleUsers.length})
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {(showAdd || editUser) && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => { setShowAdd(false); setEditUser(null); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header — gold gradient like AdminTasksPage */}
            <div className="relative px-5 py-4 flex items-center justify-center"
              style={{ background: 'linear-gradient(to left, #a0660e, #c47f17)' }}>
              <button
                onClick={() => { setShowAdd(false); setEditUser(null); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg border border-white/60 bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="text-center text-white">
                <div className="text-lg font-bold">{editUser ? 'עריכת משתמש' : 'הוספת משתמש חדש'}</div>
                {editUser && <div className="text-xs text-white/70 mt-0.5">{editUser.name}</div>}
              </div>
            </div>

            <div className="overflow-y-auto p-5">
              <UserForm
                user={editUser}
                onSubmit={handleSave}
                onCancel={() => { setShowAdd(false); setEditUser(null); }}
              />
            </div>
          </div>
        </div>
      )}

      <AlertModal
        open={!!saveAlert}
        title={saveAlert?.title || ''}
        message={saveAlert?.message}
        variant="error"
        onClose={() => setSaveAlert(null)}
      />
    </div>
  );
}
