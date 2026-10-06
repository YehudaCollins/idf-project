/**
 * DevUserSwitcher — פעיל רק כש DEV_MODE=true
 *
 * בייצור: הזיהוי נעשה אוטומטית דרך SharePoint currentUser
 * בפיתוח: מאפשר החלפה ידנית + הצגת "המשתמש הנוכחי" עם סטטוס
 */
import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import clsx from 'clsx';
import { Check, AlertCircle } from 'lucide-react';

export function getUserLabel(u) {
  if (u.role === 'admin') return 'מנהל על';
  if (u.envPermType === 'manager') return 'מנהל סביבה';
  if (u.envPermType === 'viewer') return 'מפקד';
  return 'ללא הרשאה';
}

export function useDevMode(selectedEnv) {
  const { user, login } = useAuth();
  const [users, setUsers]       = useState([]);
  const [devMode, setDevMode]   = useState(false);
  const [open, setOpen]         = useState(false);
  const [spUser, setSpUser]     = useState(null);   // משתמש SP נוכחי (דמה ב-DEV)
  const [spStatus, setSpStatus] = useState(null);   // 'found' | 'not-found' | 'loading'

  useEffect(() => {
    api.get('/dev/mode')
      .then(res => setDevMode(res.data.devMode))
      .catch(() => setDevMode(false));
  }, []);

  useEffect(() => {
    if (!devMode) return;
    const envParam = selectedEnv?._id ? `?environmentId=${selectedEnv._id}` : '';
    api.get(`/dev/users${envParam}`)
      .then(res => setUsers(res.data))
      .catch(() => setUsers([]));
  }, [devMode, selectedEnv]);

  // בדוק אם המשתמש "הנוכחי" (מדומה ב-DEV, SharePoint בייצור) רשום במערכת
  useEffect(() => {
    if (!devMode) return;
    setSpStatus('loading');
    // ב-DEV: מנסה לקרוא _api/web/currentUser — בסביבת dev הזאת לא יעבוד
    // אז אנחנו מדמים: המשתמש "הנוכחי" הוא הלוגד-אין הנוכחי ב-SP
    // בפיתוח נקרא ל-endpoint שמחזיר את המשתמש הנוכחי
    api.get('/dev/sp-current-user')
      .then(res => {
        setSpUser(res.data);
        setSpStatus(res.data.found ? 'found' : 'not-found');
      })
      .catch(() => {
        // אם ה-endpoint לא קיים — מציגים כ"לא נמצא"
        setSpUser({ name: 'משתמש נוכחי (SP)', tagId: null });
        setSpStatus('not-found');
      });
  }, [devMode]);

  const handleSwitch = async (u) => {
    try {
      const res = await api.post(`/dev/login/${u._id}`);
      await login(res.data.token, res.data.user);
      setOpen(false);
    } catch {}
  };

  return { devMode, users, open, setOpen, handleSwitch, user, spUser, spStatus };
}

export function DevUserPopup({ devMode, users, open, setOpen, handleSwitch, user, spUser, spStatus }) {
  if (!devMode || !open) return null;

  const ACCENT = '#c47f17';
  const ACCENT_H = '#a0660e';

  return (
    <div
      className="absolute bottom-full right-3 left-3 mb-2 rounded-2xl shadow-2xl z-50 overflow-hidden"
      style={{ background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)' }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span className="text-[11px] font-semibold text-slate-300">החלף משתמש</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
          style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24' }}>DEV</span>
      </div>

      {/* ─── המשתמש הנוכחי (SharePoint) ─── */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
          משתמש נוכחי (SharePoint)
        </p>

        {spStatus === 'loading' && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl opacity-60"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="h-7 w-7 rounded-[8px] bg-slate-700 animate-pulse" />
            <span className="text-[12px] text-slate-400">בודק...</span>
          </div>
        )}

        {spStatus === 'found' && spUser && (
          <button onClick={() => spUser._id && handleSwitch(spUser)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors text-right"
            style={{ background: 'rgba(196,127,23,0.12)', border: '1px solid rgba(196,127,23,0.25)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(196,127,23,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(196,127,23,0.12)'}>
            <div className="h-8 w-8 rounded-[9px] flex items-center justify-center text-[13px] font-bold flex-shrink-0 text-white"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_H})` }}>
              {spUser.name?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0 text-right">
              <div className="text-[13px] font-semibold text-white truncate">{spUser.name}</div>
              <div className="text-[10px]" style={{ color: `${ACCENT}cc` }}>רשום במערכת ✓</div>
            </div>
          </button>
        )}

        {spStatus === 'not-found' && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="h-8 w-8 rounded-[9px] bg-red-900/40 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-4 w-4 text-red-400" />
            </div>
            <div className="flex-1 min-w-0 text-right">
              <div className="text-[12px] font-semibold text-red-300">
                {spUser?.name || 'משתמש לא מזוהה'}
              </div>
              <div className="text-[10px] text-red-500">לא הצליח להתחבר — לא רשום במערכת</div>
            </div>
          </div>
        )}
      </div>

      {/* ─── כל המשתמשים הרשומים ─── */}
      <div className="px-3 py-2 pb-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
          משתמשים רשומים
        </p>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
        {users.map(u => {
          const isCurrent = user?._id === u._id;
          const label = getUserLabel(u);
          return (
            <button key={u._id} onClick={() => handleSwitch(u)}
              className={clsx('w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors text-right',
                isCurrent ? 'bg-white/10' : 'hover:bg-white/5')}>
              <div className="h-8 w-8 rounded-[9px] flex items-center justify-center text-[13px] font-bold flex-shrink-0"
                style={isCurrent
                  ? { background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_H})`, color: 'white' }
                  : { background: '#3a3a3a', color: '#aaa' }}>
                {u.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0 text-right">
                <div className={clsx('text-[13px] font-medium truncate',
                  isCurrent ? 'text-white' : 'text-slate-200')}>
                  {u.name}
                </div>
                <div className="text-[10px] text-slate-500">{label}</div>
              </div>
              {isCurrent && <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: ACCENT }} />}
            </button>
          );
        })}
        {users.length === 0 && (
          <div className="px-3 py-4 text-center text-[12px] text-slate-500">אין משתמשים</div>
        )}
      </div>
    </div>
  );
}
