import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Save, Check, Settings2, ChevronLeft, Bell, Calendar, AlertTriangle, ToggleLeft, ToggleRight, Globe, Lock, UserPlus, X, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import api from '../api/axios';
import { AlertModal } from '../components/ui/ConfirmModal';
import { useAuth } from '../context/AuthContext';

const DEFAULT_COLUMNS = ['מספר סידורי', 'נושא', 'פירוט', 'תג"ב', 'סיכום דיון'];

export default function EnvSettingsPage({ selectedEnv }) {
  const { isSuperAdmin } = useAuth();
  const [levels, setLevels]                   = useState(4);
  const [cols, setCols]                       = useState([]);
  const [newLabel, setNewLabel]               = useState('');
  const [defaultDueDays, setDefaultDueDays]   = useState(14);
  const [overdueThreshold, setOverdueThreshold] = useState(0);
  const [reminderDays, setReminderDays]       = useState(3);
  const [reminderOn, setReminderOn]           = useState(true);
  const [visibility, setVisibility]           = useState('public');
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [saved, setSaved]                     = useState(false);
  const [saveAlert, setSaveAlert]             = useState(null);
  const newLabelRef = useRef(null);

  // Pending access requests
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [decisionFor, setDecisionFor] = useState(null); // { id, type: 'approve'|'reject' }
  const [decisionNote, setDecisionNote] = useState('');
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!selectedEnv) return;
    setLoading(true);
    try {
      const r = await api.get(`/environments/${selectedEnv._id}/template`);
      setLevels(r.data?.responsibilityLevels ?? 4);
      setCols(Array.isArray(r.data?.customColumns) ? r.data.customColumns : []);
      setDefaultDueDays(r.data?.defaultDueDays ?? 14);
      setOverdueThreshold(r.data?.overdueThresholdDays ?? 0);
      const rd = r.data?.autoReminderDays ?? 3;
      setReminderDays(rd);
      setReminderOn(rd > 0);
    } catch {}
    finally { setLoading(false); }
  }, [selectedEnv]);

  useEffect(() => { load(); }, [load]);

  // טען visibility מתוך הסביבה
  useEffect(() => {
    setVisibility(selectedEnv?.visibility || 'public');
  }, [selectedEnv?._id, selectedEnv?.visibility]);

  // טען בקשות ממתינות
  const loadRequests = useCallback(async () => {
    if (!selectedEnv?._id) { setRequests([]); return; }
    setLoadingRequests(true);
    try {
      const r = await api.get('/environment-requests', {
        params: { environmentId: selectedEnv._id, status: 'pending' },
      });
      setRequests(Array.isArray(r.data) ? r.data : []);
    } catch {
      setRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  }, [selectedEnv?._id]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  // עדכון visibility — נשמר מיידית
  const toggleVisibility = async () => {
    if (!selectedEnv?._id || savingVisibility) return;
    const next = visibility === 'public' ? 'private' : 'public';
    setSavingVisibility(true);
    setVisibility(next); // optimistic
    try {
      await api.put(`/environments/${selectedEnv._id}`, { visibility: next });
    } catch (err) {
      setVisibility(visibility);
      setSaveAlert({ title: 'לא ניתן לעדכן', message: err.response?.data?.message || 'שגיאה' });
    } finally {
      setSavingVisibility(false);
    }
  };

  const handleApprove = async (id) => {
    setDecisionSubmitting(true);
    try {
      await api.post(`/environment-requests/${id}/approve`);
      await loadRequests();
    } catch (err) {
      setSaveAlert({ title: 'אישור נכשל', message: err.response?.data?.message || 'שגיאה' });
    } finally {
      setDecisionSubmitting(false);
    }
  };

  const openReject = (id) => {
    setDecisionFor({ id, type: 'reject' });
    setDecisionNote('');
  };

  const confirmReject = async () => {
    if (!decisionFor) return;
    setDecisionSubmitting(true);
    try {
      await api.post(`/environment-requests/${decisionFor.id}/reject`, { note: decisionNote.trim() });
      setDecisionFor(null);
      setDecisionNote('');
      await loadRequests();
    } catch (err) {
      setSaveAlert({ title: 'דחייה נכשלה', message: err.response?.data?.message || 'שגיאה' });
    } finally {
      setDecisionSubmitting(false);
    }
  };

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      await api.put(`/environments/${selectedEnv._id}/template`, {
        responsibilityLevels: levels,
        customColumns: cols,
        defaultDueDays,
        overdueThresholdDays: overdueThreshold,
        autoReminderDays: reminderOn ? reminderDays : 0,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveAlert({ title: 'לא ניתן לשמור', message: err.response?.data?.message || 'שגיאה' });
    }
    finally { setSaving(false); }
  };

  const addCol = () => {
    const label = newLabel.trim();
    if (!label) return;
    setCols(prev => [...prev, { id: `col_${Date.now()}`, label }]);
    setNewLabel('');
    newLabelRef.current?.focus();
  };

  const removeCol = id => setCols(prev => prev.filter(c => c.id !== id));
  const updateCol = (id, label) => setCols(prev => prev.map(c => c.id === id ? { ...c, label } : c));

  if (!selectedEnv) return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <Settings2 className="h-12 w-12 text-slate-200 dark:text-slate-700" />
      <p className="text-[15px] font-medium text-slate-400">בחר סביבה מהתפריט הצדדי</p>
    </div>
  );

  if (loading) return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#c47f17] border-t-transparent" />
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-0 overflow-hidden">

      {/* ── TopBar ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/80 px-6 py-4 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/60">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#c47f17]">תבנית סביבה</p>
          <h1 className="mt-0.5 truncate text-[22px] font-bold text-slate-900 dark:text-slate-50">{selectedEnv.name}</h1>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className={clsx(
            'inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-bold text-white shadow-md transition-all',
            saved ? 'bg-emerald-600' : 'bg-gradient-to-l from-[#a0660e] to-[#c47f17] hover:brightness-105 active:scale-[0.98]',
          )}
        >
          {saved ? <><Check className="h-4 w-4" />נשמר!</> : saving ? 'שומר...' : <><Save className="h-4 w-4" />שמור שינויים</>}
        </button>
      </div>

      {/* ── Body — שני עמודות ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* ── עמוד שמאל: עמודות ── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-l border-slate-200/80 dark:border-slate-700">
          <div className="shrink-0 px-6 pt-5 pb-3">
            <h2 className="text-[16px] font-bold text-slate-900 dark:text-slate-50">עמודות הטבלה</h2>
            <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">הגדר אילו עמודות יופיעו בכל הנחיה</p>
          </div>

          {/* עמודות קבועות */}
          <div className="shrink-0 px-6 pb-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">קבועות — לא ניתן לשנות</p>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_COLUMNS.map(c => (
                <span key={c} className="rounded-lg border border-slate-200 bg-slate-100/80 px-3 py-1.5 text-[13px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="mx-6 h-px shrink-0 bg-slate-100 dark:bg-slate-800" />

          {/* עמודות מותאמות — גלילה */}
          <div className="flex min-h-0 basis-[26%] flex-none flex-col overflow-hidden px-6 pt-2">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">מותאמות אישית</p>
              {cols.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                  {cols.length} עמודות
                </span>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {cols.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-200/80 py-4 text-center dark:border-slate-700">
                  <p className="text-[14px] font-medium text-slate-400">אין עמודות מותאמות עדיין</p>
                  <p className="text-[12px] text-slate-300 dark:text-slate-600">הוסף עמודות שיופיעו כשדות חופשיים בכל הנחיה</p>
                </div>
              ) : (
                <div className="space-y-1.5 pb-2">
                  {cols.map((col, i) => (
                    <div
                      key={col.id}
                      className="group flex items-center gap-2.5 rounded-xl border border-amber-100/80 bg-gradient-to-l from-amber-50/60 to-white px-3 py-2 shadow-sm dark:border-amber-900/30 dark:from-amber-950/20 dark:to-slate-900/40"
                    >
                      <span className="w-6 shrink-0 text-center text-[13px] font-black tabular-nums text-amber-400/70">{i + 1}</span>
                      <input
                        value={col.label}
                        onChange={e => updateCol(col.id, e.target.value)}
                        className="flex-1 bg-transparent text-[14px] font-medium text-slate-800 outline-none placeholder:text-amber-300 dark:text-slate-100"
                        placeholder="שם העמודה..."
                      />
                      <button
                        type="button"
                        onClick={() => removeCol(col.id)}
                        className="shrink-0 rounded-lg p-1.5 text-slate-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* הוספה */}
            <div className="shrink-0 border-t border-slate-100 pb-2 pt-2 dark:border-slate-800">
              <div className="flex gap-2">
                <input
                  ref={newLabelRef}
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCol(); } }}
                  placeholder="שם עמודה חדשה... (Enter להוספה)"
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2 text-[14px] text-slate-800 placeholder:text-slate-400 focus:border-[#c47f17] focus:outline-none focus:ring-2 focus:ring-[#c47f17]/20 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={addCol}
                  disabled={!newLabel.trim()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-l from-[#a0660e] to-[#c47f17] px-4 py-2 text-[13px] font-bold text-white shadow-sm transition hover:brightness-105 active:scale-[0.98] disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                  הוסף
                </button>
              </div>
            </div>
          </div>

          {/* ── הגדרות מתן הנחיות ── */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t-2 border-dashed border-slate-200/80 dark:border-slate-700">
            <div className="shrink-0 px-6 pt-4 pb-3">
              <h3 className="text-[15px] font-bold text-slate-800 dark:text-slate-100">הגדרות מתן הנחיות</h3>
              <p className="mt-0.5 text-[12px] text-slate-400">ברירות מחדל לכל הנחיה חדשה בסביבה זו</p>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-5 space-y-3">

              {/* ברירת מחדל תג"ב */}
              <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/40">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/30">
                  <Calendar className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">ברירת מחדל לתג״ב</p>
                  <p className="text-[11px] text-slate-400">כמה ימים מהיום יהיה תג״ב כשפותחים הנחיה חדשה</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={() => setDefaultDueDays(d => Math.max(1, d - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[16px] font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">−</button>
                  <span className="w-12 text-center text-[18px] font-black tabular-nums text-[#c47f17]">{defaultDueDays}</span>
                  <button type="button" onClick={() => setDefaultDueDays(d => d + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[16px] font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">+</button>
                  <span className="text-[12px] text-slate-400 dark:text-slate-500">ימים</span>
                </div>
              </div>

              {/* סף חריגה */}
              <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/40">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/30">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">סף חריגה</p>
                  <p className="text-[11px] text-slate-400">
                    {overdueThreshold === 0
                      ? 'הנחיה תסומן "בחריגה" מיד עם חריגה מהתג״ב'
                      : `הנחיה תסומן "בחריגה" רק ${overdueThreshold} ימים אחרי התג״ב`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={() => setOverdueThreshold(d => Math.max(0, d - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[16px] font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">−</button>
                  <span className="w-12 text-center text-[18px] font-black tabular-nums text-red-500">{overdueThreshold}</span>
                  <button type="button" onClick={() => setOverdueThreshold(d => d + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[16px] font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">+</button>
                  <span className="text-[12px] text-slate-400 dark:text-slate-500">ימים</span>
                </div>
              </div>

              {/* תזכורת אוטומטית */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/40">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/30">
                    <Bell className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">תזכורת אוטומטית</p>
                    <p className="text-[11px] text-slate-400">שלח תזכורת למפקד לפני תג״ב</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReminderOn(o => !o)}
                    className="shrink-0"
                    title={reminderOn ? 'כבה תזכורות' : 'הפעל תזכורות'}
                  >
                    {reminderOn
                      ? <ToggleRight className="h-8 w-8 text-[#c47f17]" />
                      : <ToggleLeft className="h-8 w-8 text-slate-300 dark:text-slate-600" />}
                  </button>
                </div>
                {reminderOn && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl bg-amber-50/60 px-4 py-2.5 dark:bg-amber-950/20">
                    <span className="text-[12px] text-slate-500 dark:text-slate-400 shrink-0">שלח תזכורת</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <button type="button" onClick={() => setReminderDays(d => Math.max(1, d - 1))}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-200 bg-white text-[14px] font-bold text-amber-600 transition hover:bg-amber-50 dark:border-amber-800 dark:bg-slate-800 dark:text-amber-400">−</button>
                      <span className="w-8 text-center text-[16px] font-black tabular-nums text-amber-600 dark:text-amber-400">{reminderDays}</span>
                      <button type="button" onClick={() => setReminderDays(d => d + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-200 bg-white text-[14px] font-bold text-amber-600 transition hover:bg-amber-50 dark:border-amber-800 dark:bg-slate-800 dark:text-amber-400">+</button>
                    </div>
                    <span className="text-[12px] text-slate-500 dark:text-slate-400">ימים לפני התג״ב</span>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* ── עמוד ימין: גישה + רמות אחריות ── */}
        <div className="flex w-72 shrink-0 flex-col overflow-hidden lg:w-80 xl:w-96">

          {/* ── גישה לסביבה (visibility + בקשות) ── */}
          <div id="requests" className="shrink-0 border-b-2 border-dashed border-slate-200/80 dark:border-slate-700">
            <div className="px-6 pt-5 pb-3">
              <h2 className="text-[16px] font-bold text-slate-900 dark:text-slate-50">גישה לסביבה</h2>
              <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">מי יכול לראות ולבקש להצטרף</p>
            </div>

            {/* Visibility toggle */}
            <div className="px-6 pb-3">
              <button
                type="button"
                onClick={toggleVisibility}
                disabled={savingVisibility}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-right transition-all',
                  visibility === 'public'
                    ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-700/60 dark:bg-emerald-900/15'
                    : 'border-slate-300 bg-slate-50/70 dark:border-slate-600 dark:bg-slate-800/60',
                  savingVisibility && 'opacity-70',
                )}
              >
                <span className={clsx(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                  visibility === 'public'
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'bg-slate-400 text-white shadow-md',
                )}>
                  {visibility === 'public' ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={clsx(
                      'text-[14px] font-bold',
                      visibility === 'public'
                        ? 'text-emerald-800 dark:text-emerald-200'
                        : 'text-slate-700 dark:text-slate-200',
                    )}>
                      {visibility === 'public' ? 'סביבה ציבורית' : 'סביבה פרטית'}
                    </p>
                    {savingVisibility && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
                    {visibility === 'public'
                      ? 'מופיעה בחיפוש, ניתן לבקש גישה'
                      : 'מוסתרת מחיפוש, גישה בהזמנה בלבד'}
                  </p>
                </div>
                {visibility === 'public'
                  ? <ToggleRight className="h-8 w-8 shrink-0 text-emerald-500" />
                  : <ToggleLeft className="h-8 w-8 shrink-0 text-slate-400" />
                }
              </button>
            </div>

            {/* Pending requests */}
            <div className="px-6 pb-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5 text-slate-400" />
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">בקשות גישה</p>
                </div>
                {requests.length > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                    {requests.length} ממתינות
                  </span>
                )}
              </div>

              {loadingRequests ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : requests.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 py-5 text-center dark:border-slate-700 dark:bg-slate-800/30">
                  <p className="text-[12.5px] font-medium text-slate-400">אין בקשות ממתינות</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {requests.map(r => (
                    <RequestCard
                      key={r._id}
                      req={r}
                      canApproveManager={isSuperAdmin}
                      submitting={decisionSubmitting}
                      onApprove={() => handleApprove(r._id)}
                      onReject={() => openReject(r._id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 px-6 pt-5 pb-3">
            <h2 className="text-[16px] font-bold text-slate-900 dark:text-slate-50">רמות אחריות</h2>
            <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">כמה שלבים בבחירת האחראי</p>
          </div>

          {/* בחירת רמות — רצועות אנכיות */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(n => {
                const active = levels === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setLevels(n)}
                    className={clsx(
                      'flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-3.5 text-right transition-all',
                      active
                        ? 'border-[#c47f17] bg-gradient-to-l from-amber-50 to-white shadow-md dark:from-amber-950/30 dark:to-slate-900/60'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-slate-600',
                    )}
                  >
                    {/* מספר */}
                    <span
                      className={clsx(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[22px] font-black tabular-nums transition-all',
                        active
                          ? 'bg-[#c47f17] text-white shadow-md'
                          : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500',
                      )}
                    >
                      {n}
                    </span>

                    {/* תיאור */}
                    <div className="min-w-0 flex-1">
                      <p className={clsx('text-[14px] font-bold', active ? 'text-[#7a4a12] dark:text-amber-200' : 'text-slate-700 dark:text-slate-300')}>
                        {n === 1 ? 'רמה אחת' : `${n} רמות`}
                      </p>
                      <div className="mt-1 flex items-center gap-1 overflow-hidden">
                        {Array.from({ length: n }, (_, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <span className={clsx(
                              'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                              active ? 'bg-amber-200/80 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500',
                            )}>
                              {i + 1}
                            </span>
                            {i < n - 1 && <ChevronLeft className={clsx('h-2.5 w-2.5 shrink-0', active ? 'text-amber-400' : 'text-slate-300')} />}
                          </span>
                        ))}
                        <ChevronLeft className={clsx('h-2.5 w-2.5 shrink-0', active ? 'text-emerald-500' : 'text-slate-200')} />
                        <span className={clsx('rounded px-1.5 py-0.5 text-[10px] font-semibold', active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500')}>
                          אחראי
                        </span>
                      </div>
                    </div>

                    {/* סימון פעיל */}
                    {active && (
                      <Check className="h-5 w-5 shrink-0 text-[#c47f17]" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* הסבר */}
            <div className="mt-4 rounded-xl border border-slate-200/60 bg-slate-50/60 p-4 text-[12px] leading-relaxed text-slate-500 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-400">
              <strong className="text-slate-700 dark:text-slate-300">איך זה עובד?</strong>
              <br />
              כשמוסיפים הנחיה, המנהל בוחר ערך בכל רמה. המערכת מוצאת אוטומטית את האחראי שמתאים לכל הרמות שנבחרו.
            </div>
          </div>
        </div>
      </div>

      <AlertModal
        open={!!saveAlert}
        title={saveAlert?.title || ''}
        message={saveAlert?.message}
        variant="error"
        onClose={() => setSaveAlert(null)}
      />

      {/* Reject modal */}
      {decisionFor?.type === 'reject' && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-3 backdrop-blur-[3px]"
          onClick={() => !decisionSubmitting && setDecisionFor(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative bg-gradient-to-l from-red-700 to-red-500 px-5 py-4">
              <button
                type="button"
                onClick={() => !decisionSubmitting && setDecisionFor(null)}
                className="absolute right-4 top-3.5 rounded-lg border border-white/70 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center justify-center gap-2 text-white">
                <XCircle className="h-5 w-5" />
                <div className="text-[18px] font-bold tracking-tight">דחיית בקשת גישה</div>
              </div>
            </div>
            <div className="space-y-3 px-5 py-5">
              <label className="block text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                סיבת דחייה (אופציונלי) — תיראה למבקש
              </label>
              <textarea
                value={decisionNote}
                onChange={e => setDecisionNote(e.target.value.slice(0, 600))}
                rows={3}
                placeholder="הסבר קצר…"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13.5px] text-slate-700 placeholder-slate-400 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDecisionFor(null)}
                  disabled={decisionSubmitting}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={confirmReject}
                  disabled={decisionSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-[13px] font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
                >
                  {decisionSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                  דחה בקשה
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestCard({ req, canApproveManager, submitting, onApprove, onReject }) {
  const user = req.userId || {};
  const isManagerReq = req.requestType === 'manager';
  const cantApprove = isManagerReq && !canApproveManager;

  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-l from-amber-50/60 to-white p-3 shadow-sm dark:border-amber-900/40 dark:from-amber-950/15 dark:to-slate-900/40">
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-[14px] font-bold text-[#a0660e] dark:bg-amber-900/40 dark:text-amber-200">
          {user.name?.charAt(0) || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[13.5px] font-bold text-slate-800 dark:text-slate-100">
              {user.name || 'משתמש'}
            </p>
            <span className={clsx(
              'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
              isManagerReq
                ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
            )}>
              {isManagerReq ? 'מנהל' : 'מפקד'}
            </span>
          </div>
          {user.jobTitle && (
            <p className="truncate text-[11.5px] text-slate-500 dark:text-slate-400">{user.jobTitle}</p>
          )}
          {req.note && (
            <p className="mt-1.5 line-clamp-3 text-[12px] italic text-slate-600 dark:text-slate-300">"{req.note}"</p>
          )}
          <div className="mt-1 flex items-center gap-1 text-[10.5px] text-slate-400">
            <Clock className="h-3 w-3" />
            {new Date(req.createdAt).toLocaleDateString('he-IL')}
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-end gap-1.5">
        {cantApprove && (
          <span className="ml-auto truncate text-[10.5px] text-amber-700 dark:text-amber-300">רק מנהל על</span>
        )}
        <button
          type="button"
          onClick={onReject}
          disabled={submitting}
          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-slate-800 dark:text-red-300"
        >
          <XCircle className="h-3 w-3" />
          דחה
        </button>
        <button
          type="button"
          onClick={onApprove}
          disabled={submitting || cantApprove}
          className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-l from-emerald-700 to-emerald-500 px-2.5 py-1.5 text-[11.5px] font-bold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50"
        >
          <CheckCircle2 className="h-3 w-3" />
          אשר
        </button>
      </div>
    </div>
  );
}
