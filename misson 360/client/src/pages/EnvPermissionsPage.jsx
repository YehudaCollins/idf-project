import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Trash2, Shield, Eye } from 'lucide-react';
import clsx from 'clsx';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { AlertModal } from '../components/ui/ConfirmModal';

const TYPE_CONFIG = {
  manager: { label: 'מנהל סביבה', icon: Shield, cls: 'bg-amber-100 text-amber-700' },
  viewer:  { label: 'מפקד',       icon: Eye,    cls: 'bg-teal-100  text-teal-700'  },
};

export default function EnvPermissionsPage({ selectedEnv }) {
  const { isSuperAdmin, canManageEnv } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();
  const [permissions, setPermissions] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ userId: '', type: 'viewer' });
  const [error, setError] = useState('');
  const [alertErr, setAlertErr] = useState(null);

  const isManager = selectedEnv && (isSuperAdmin || canManageEnv(selectedEnv._id));

  const fetchPermissions = useCallback(async () => {
    if (!selectedEnv) return;
    setLoading(true);
    try {
      const res = await api.get(`/environments/${selectedEnv._id}/permissions`);
      setPermissions(res.data);
    } finally { setLoading(false); }
  }, [selectedEnv]);

  const fetchAvailableUsers = useCallback(async () => {
    if (!selectedEnv) return;
    try {
      const res = await api.get(`/environments/${selectedEnv._id}/permissions/users-without`);
      setAvailableUsers(res.data);
    } catch {}
  }, [selectedEnv]);

  useEffect(() => { fetchPermissions(); }, [fetchPermissions]);
  useEffect(() => { if (showAdd) fetchAvailableUsers(); }, [showAdd, fetchAvailableUsers]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/environments/${selectedEnv._id}/permissions`, addForm);
      fetchPermissions();
      setShowAdd(false);
      setAddForm({ userId: '', type: 'viewer' });
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה');
    }
  };

  const handleRemove = async (userId) => {
    const ok = await confirm({
      title: 'להסיר גישה לסביבה?',
      message: 'המשתמש לא יוכל עוד לגשת לסביבה זו.',
      confirmLabel: 'הסר',
      cancelLabel: 'ביטול',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/environments/${selectedEnv._id}/permissions/${userId}`);
      fetchPermissions();
    } catch (err) {
      setAlertErr({
        title: 'שגיאה',
        message: err.response?.data?.message || 'שגיאה',
      });
    }
  };

  if (!selectedEnv) return (
    <div className="flex h-64 items-center justify-center text-gray-400">
      <p>בחר סביבה מהתפריט הצדדי</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {ConfirmDialog}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ניהול הרשאות</h1>
          <p className="text-sm text-gray-500 mt-1">סביבה: {selectedEnv.name}</p>
        </div>
        {isManager && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition-colors">
            <UserPlus className="h-4 w-4" />הוסף גישה
          </button>
        )}
      </div>

      {/* הסבר */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <strong>מנהל סביבה</strong> — יכול לנהל משימות ולהוסיף/להסיר מפקדים לסביבה זו.<br />
        <strong>מפקד</strong> — רואה משימות שהוקצו לו ומגיש עדכונים.
        {!isSuperAdmin && <span className="block mt-1 text-blue-500">הרשאת מנהל סביבה ניתנת רק על ידי מנהל על.</span>}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">טוען...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-l from-slate-800 to-slate-900 text-white">
                <th className="px-4 py-3.5 text-right text-sm font-medium">שם</th>
                <th className="px-4 py-3.5 text-right text-sm font-medium">שם משתמש</th>
                <th className="px-4 py-3.5 text-right text-sm font-medium">תפקיד</th>
                <th className="px-4 py-3.5 text-right text-sm font-medium">הרשאה</th>
                <th className="px-4 py-3.5 text-right text-sm font-medium">ניתנה ע"י</th>
                {isManager && <th className="px-4 py-3.5 w-16"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {permissions.map(perm => {
                const cfg = TYPE_CONFIG[perm.type];
                const Icon = cfg?.icon;
                return (
                  <tr key={perm._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3.5 text-sm font-medium text-gray-800">{perm.userId?.name}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-500"><code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{perm.userId?.username}</code></td>
                    <td className="px-4 py-3.5 text-sm text-gray-500">{perm.userId?.jobTitle || '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', cfg?.cls)}>
                        {Icon && <Icon className="h-3 w-3" />}{cfg?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-400">{perm.grantedBy?.name || '—'}</td>
                    {isManager && (
                      <td className="px-4 py-3.5 text-center">
                        {/* מנהל על יכול להסיר הכל; מנהל סביבה לא יכול להסיר מנהל אחר */}
                        {(isSuperAdmin || perm.type === 'viewer') && (
                          <button onClick={() => handleRemove(perm.userId?._id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {permissions.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">אין משתמשים עם הרשאה לסביבה זו</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal הוספת הרשאה */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">הוסף גישה לסביבה</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleAdd} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">משתמש *</label>
                <select value={addForm.userId} onChange={e => setAddForm(f => ({ ...f, userId: e.target.value }))} required
                  className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-300">
                  <option value="">— בחר משתמש —</option>
                  {availableUsers.map(u => (
                    <option key={u._id} value={u._id}>
                      {u.name} {u.jobTitle ? `(${u.jobTitle})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סוג הרשאה *</label>
                <select value={addForm.type} onChange={e => setAddForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-300">
                  <option value="viewer">מפקד (צפייה + הגשת עדכונים)</option>
                  {isSuperAdmin && <option value="manager">מנהל סביבה (ניהול מלא)</option>}
                </select>
              </div>
              {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">ביטול</button>
                <button type="submit" className="px-4 py-2 text-sm text-white bg-teal-500 rounded-lg hover:bg-teal-600 font-medium">הענק גישה</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <AlertModal
        open={!!alertErr}
        title={alertErr?.title || ''}
        message={alertErr?.message}
        variant="error"
        onClose={() => setAlertErr(null)}
      />
    </div>
  );
}
