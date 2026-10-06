import { useState } from 'react';
import { Search } from 'lucide-react';
import api from '../../api/axios';
import { safeImageSrc } from '../../lib/safeImageSrc';

export function UserForm({ user, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    tagId: user?.tagId || '',
    name: user?.name || '',
    username: user?.username || '',
    jobTitle: user?.jobTitle || '',
    rank: user?.rank || '',
    militaryRole: user?.militaryRole || '',
    email: user?.email || '',
    phone: user?.phone || '',
    profileImageUrl: user?.profileImageUrl || '',
    sourceSystem: user?.sourceSystem || '',
    registeredVia: user?.registeredVia || '',
    level1: user?.level1 || '',
    level2: user?.level2 || '',
    level3: user?.level3 || '',
    level4: user?.level4 || '',
    level5: user?.level5 || '',
    permissions: user?.permissions || 'manager',
  });
  const [lookupState, setLookupState] = useState({ loading: false, message: '', tone: 'neutral' });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  const lookupUnitree = async () => {
    const tagId = form.tagId.trim();
    if (!tagId) return;
    setLookupState({ loading: true, message: '', tone: 'neutral' });
    try {
      const res = await api.get(`/users/lookup?tagId=${encodeURIComponent(tagId)}`);
      if (!res.data?.found) {
        setLookupState({ loading: false, message: 'לא נמצא ביוניטרי או במערכת', tone: 'error' });
        return;
      }
      const next = res.data.user || {};
      setForm(prev => ({
        ...prev,
        ...next,
        tagId: next.tagId || prev.tagId,
        permissions: prev.permissions,
      }));
      setLookupState({
        loading: false,
        message: res.data.inSystem ? 'המשתמש כבר קיים במערכת, אפשר להוסיף/לעדכן הרשאה' : 'הפרופיל נמשך מיוניטרי',
        tone: res.data.inSystem ? 'neutral' : 'success',
      });
    } catch (err) {
      setLookupState({ loading: false, message: err.response?.data?.message || 'שגיאה בחיפוש ביוניטרי', tone: 'error' });
    }
  };

  const field = (id, label, placeholder, opts = {}) => (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
      <input id={id} value={form[id]} onChange={e => set(id, e.target.value)} placeholder={placeholder}
        {...opts}
        className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 disabled:bg-gray-50 disabled:text-gray-400" />
    </div>
  );

  const profilePreviewSrc = safeImageSrc(form.profileImageUrl);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          {field('tagId', 'מספר אישי', 'c9214482 / 8001119', { required: true, disabled: !!user })}
        </div>
        <button
          type="button"
          onClick={lookupUnitree}
          disabled={lookupState.loading || !form.tagId.trim()}
          className="mb-0 h-9 shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-[12px] font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Search className="h-3.5 w-3.5" />
          {lookupState.loading ? 'בודק...' : 'משוך מיוניטרי'}
        </button>
      </div>
      {lookupState.message && (
        <div className={`rounded-lg px-3 py-2 text-[12px] ${
          lookupState.tone === 'error'
            ? 'bg-red-50 text-red-700'
            : lookupState.tone === 'success'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-50 text-slate-500'
        }`}>
          {lookupState.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {field('name', 'שם מלא', 'ישראל ישראלי', { required: true })}
        {field('username', 'שם משתמש / מייל', 'israel@idf.local')}
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
        <div className="h-16 w-16 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          {profilePreviewSrc ? (
            <img src={profilePreviewSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-bold text-slate-400">
              {form.name?.charAt(0) || '?'}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {field('rank', 'דרגה', 'סרן')}
          {field('militaryRole', 'תפקיד צבאי', 'מפקד צוות')}
        </div>
      </div>

      {field('jobTitle', 'תפקיד', "מפ הפעלה, קשרח, וכו'", { required: true })}

      <div className="grid grid-cols-2 gap-4">
        {field('email', 'מייל', 'name@idf.local')}
        {field('phone', 'טלפון', '050-0000000')}
      </div>
      {field('profileImageUrl', 'תמונת פרופיל', '/profiles/c9214482.jpg או data:image/...')}

      <div className="grid grid-cols-2 gap-4">
        {field('level1', 'רמה 1', 'חטיבת ההפעלה')}
        {field('level2', 'רמה 2', 'גולס / מטה')}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {field('level3', 'רמה 3', 'מקשא"פ')}
        {field('level4', 'רמה 4', 'צוות אלפא')}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {field('level5', 'רמה 5', 'תת-צוות / מדור')}
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">הרשאות</label>
        <select value={form.permissions} onChange={e => set('permissions', e.target.value)}
          className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-300">
          <option value="admin">מנהל</option>
          <option value="manager">מנהל צוות</option>
          <option value="viewer">צופה</option>
        </select>
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 text-sm text-gray-600 rounded-lg hover:bg-gray-50">ביטול</button>
        <button type="submit" className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition-colors">
          {user ? 'שמירת שינויים' : 'הוספת משתמש'}
        </button>
      </div>
    </form>
  );
}
