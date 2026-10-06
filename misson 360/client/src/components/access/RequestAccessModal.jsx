import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Search, Globe, ShieldCheck, Eye, Send, Loader2, CheckCircle2,
  AlertCircle, Clock, Inbox, Trash2, KeyRound,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../api/axios';

/**
 * RequestAccessModal — חיפוש סביבות פתוחות ובקשת גישה.
 * tabs: "חיפוש" + "הבקשות שלי".
 */
export function RequestAccessModal({ open, onClose, onRequestCreated }) {
  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [myRequests, setMyRequests] = useState([]);
  const [loadingMine, setLoadingMine] = useState(false);

  const [activeEnv, setActiveEnv] = useState(null);
  const [requestType, setRequestType] = useState('viewer');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [successFlash, setSuccessFlash] = useState(false);

  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setQuery(''); setResults([]); setActiveEnv(null);
      setRequestType('viewer'); setNote(''); setSubmitError(null); setSuccessFlash(false);
      setTab('search');
      return;
    }
    setTimeout(() => searchRef.current?.focus(), 50);
    runSearch('');
    fetchMine();
  }, [open]);

  // חיפוש עם debounce
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => runSearch(query), 250);
    return () => clearTimeout(id);
  }, [query, open]);

  const runSearch = async (q) => {
    setSearching(true);
    try {
      const r = await api.get('/environments/search', { params: { q } });
      setResults(Array.isArray(r.data) ? r.data : []);
      setSearchError(null);
    } catch (err) {
      setSearchError(err?.response?.data?.message || 'שגיאה בחיפוש');
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const fetchMine = async () => {
    setLoadingMine(true);
    try {
      const r = await api.get('/environment-requests/mine');
      setMyRequests(Array.isArray(r.data) ? r.data : []);
    } catch {
      setMyRequests([]);
    } finally {
      setLoadingMine(false);
    }
  };

  const submit = async () => {
    if (!activeEnv) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.post('/environment-requests', {
        environmentId: activeEnv._id,
        requestType,
        note: note.trim(),
      });
      setSuccessFlash(true);
      setActiveEnv(null);
      setNote('');
      setRequestType('viewer');
      await fetchMine();
      await runSearch(query);
      onRequestCreated?.();
      setTimeout(() => setSuccessFlash(false), 2200);
      setTab('mine');
    } catch (err) {
      setSubmitError(err?.response?.data?.message || 'לא ניתן לשלוח את הבקשה');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (id) => {
    try {
      await api.delete(`/environment-requests/${id}`);
      await fetchMine();
      await runSearch(query);
    } catch {}
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-3 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-[min(96vw,46rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
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
            <KeyRound className="h-5 w-5" />
            <div className="text-[20px] font-bold tracking-tight">בקש גישה לסביבה</div>
          </div>
          <p className="mt-0.5 text-center text-[12.5px] text-amber-50/85">
            חפש סביבה ציבורית ובחר את סוג ההרשאה. מנהל הסביבה יאשר את הבקשה.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-slate-200 dark:border-slate-700">
          <TabBtn active={tab === 'search'} onClick={() => setTab('search')} icon={Search} label="חיפוש" />
          <TabBtn active={tab === 'mine'} onClick={() => setTab('mine')} icon={Inbox}
            label={`הבקשות שלי${myRequests.length ? ` (${myRequests.length})` : ''}`} />
        </div>

        {/* Success flash */}
        {successFlash && (
          <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-[13px] text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> הבקשה נשלחה למנהל הסביבה</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {tab === 'search' ? (
            <SearchTab
              query={query}
              setQuery={setQuery}
              searching={searching}
              searchError={searchError}
              results={results}
              activeEnv={activeEnv}
              setActiveEnv={setActiveEnv}
              requestType={requestType}
              setRequestType={setRequestType}
              note={note}
              setNote={setNote}
              submit={submit}
              submitting={submitting}
              submitError={submitError}
              inputRef={searchRef}
            />
          ) : (
            <MineTab
              items={myRequests}
              loading={loadingMine}
              onCancel={cancelRequest}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-[13.5px] font-semibold transition',
        active
          ? 'border-b-2 border-[#c47f17] text-[#a0660e] dark:text-amber-300'
          : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

/* ───────────────────── Search Tab ───────────────────── */
function SearchTab({
  query, setQuery, searching, searchError, results,
  activeEnv, setActiveEnv,
  requestType, setRequestType, note, setNote,
  submit, submitting, submitError, inputRef,
}) {
  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="חפש סביבה לפי שם או תיאור…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-9 pl-3 text-[14px] text-slate-700 placeholder-slate-400 shadow-sm focus:border-[#c47f17] focus:outline-none focus:ring-2 focus:ring-[#c47f17]/20 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
        />
      </div>

      {/* Active env panel */}
      {activeEnv && (
        <RequestForm
          env={activeEnv}
          onCancel={() => { setActiveEnv(null); setNote(''); setRequestType('viewer'); }}
          requestType={requestType}
          setRequestType={setRequestType}
          note={note}
          setNote={setNote}
          submit={submit}
          submitting={submitting}
          submitError={submitError}
        />
      )}

      {/* Results */}
      <div className="space-y-2">
        {searching ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-[13px]">מחפש…</span>
          </div>
        ) : searchError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {searchError}
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800/30">
            <Globe className="h-8 w-8 text-slate-300" />
            <p className="text-[13.5px] font-medium">לא נמצאו סביבות פתוחות</p>
            <p className="text-[12px]">סביבות פרטיות אינן מופיעות בחיפוש</p>
          </div>
        ) : (
          results.map(env => (
            <EnvResultRow
              key={env._id}
              env={env}
              active={activeEnv?._id === env._id}
              onPick={() => {
                setActiveEnv(env);
                setRequestType(env.myPermission === 'viewer' ? 'manager' : 'viewer');
                setNote('');
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

function EnvResultRow({ env, active, onPick }) {
  const hasPerm = !!env.myPermission;
  const isPending = env.myRequestStatus === 'pending';
  const fullyBlocked = env.myPermission === 'manager';

  return (
    <button
      type="button"
      onClick={fullyBlocked ? undefined : onPick}
      disabled={fullyBlocked}
      className={clsx(
        'group flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-right transition',
        active
          ? 'border-[#c47f17] bg-amber-50 shadow-sm dark:bg-amber-900/20'
          : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/40 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:bg-slate-800',
        fullyBlocked && 'opacity-60',
      )}
    >
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-[#a0660e] dark:bg-amber-900/40 dark:text-amber-200">
        <Globe className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-semibold text-slate-800 dark:text-slate-100">{env.name}</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
            פתוח
          </span>
          {hasPerm && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10.5px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
              יש לך גישה: {env.myPermission === 'manager' ? 'מנהל' : 'מפקד'}
            </span>
          )}
          {isPending && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              בקשה ממתינה
            </span>
          )}
        </div>
        {env.description && (
          <p className="mt-1 line-clamp-2 text-[12.5px] text-slate-500 dark:text-slate-400">{env.description}</p>
        )}
      </div>
      {!fullyBlocked && (
        <div className="self-center text-[12px] font-semibold text-[#a0660e] opacity-0 transition group-hover:opacity-100">
          בחר ←
        </div>
      )}
    </button>
  );
}

function RequestForm({ env, onCancel, requestType, setRequestType, note, setNote, submit, submitting, submitError }) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-700/60 dark:bg-amber-900/15">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#a0660e]">בקשת גישה לסביבה</p>
          <h3 className="truncate text-[16px] font-bold text-slate-800 dark:text-slate-100">{env.name}</h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 transition hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mb-3">
        <label className="mb-1.5 block text-[12px] font-semibold text-slate-600 dark:text-slate-300">סוג בקשה</label>
        <div className="grid grid-cols-2 gap-2">
          <RoleCard
            active={requestType === 'viewer'}
            onClick={() => setRequestType('viewer')}
            icon={Eye}
            title="מפקד / צופה"
            subtitle="צפייה והנחיות אישיות"
            disabled={env.myPermission === 'viewer'}
          />
          <RoleCard
            active={requestType === 'manager'}
            onClick={() => setRequestType('manager')}
            icon={ShieldCheck}
            title="מנהל סביבה"
            subtitle="ניהול מלא של הסביבה"
          />
        </div>
        {env.myPermission === 'viewer' && requestType === 'manager' && (
          <p className="mt-1.5 text-[11.5px] text-slate-500">יש לך כבר גישת מפקד. הבקשה נועדה לשדרוג להרשאת מנהל.</p>
        )}
      </div>

      <div className="mb-3">
        <label className="mb-1.5 block text-[12px] font-semibold text-slate-600 dark:text-slate-300">
          הערה למנהל (אופציונלי)
        </label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value.slice(0, 600))}
          rows={2}
          placeholder="מה הסיבה לבקשה? איזה תפקיד / פעולה אתה צריך…"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13.5px] text-slate-700 placeholder-slate-400 shadow-sm focus:border-[#c47f17] focus:outline-none focus:ring-2 focus:ring-[#c47f17]/20 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
        />
        <div className="mt-1 text-left text-[10.5px] text-slate-400">{note.length}/600</div>
      </div>

      {submitError && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <AlertCircle className="h-4 w-4" />
          {submitError}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          ביטול
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-l from-[#a0660e] to-[#c47f17] px-4 py-2 text-[13px] font-bold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          שלח בקשה
        </button>
      </div>
    </div>
  );
}

function RoleCard({ active, onClick, icon: Icon, title, subtitle, disabled }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={clsx(
        'flex items-start gap-2 rounded-xl border px-3 py-2.5 text-right transition',
        active
          ? 'border-[#c47f17] bg-white shadow-sm dark:bg-slate-800'
          : 'border-slate-200 bg-white/70 hover:border-amber-300 dark:border-slate-700 dark:bg-slate-800/60',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span className={clsx(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
        active ? 'bg-[#c47f17]/15 text-[#a0660e]' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
      )}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{title}</div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</div>
      </div>
    </button>
  );
}

/* ───────────────────── Mine Tab ───────────────────── */
function MineTab({ items, loading, onCancel }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-[13px]">טוען…</span>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800/30">
        <Inbox className="h-8 w-8 text-slate-300" />
        <p className="text-[13.5px] font-medium">אין לך בקשות גישה</p>
        <p className="text-[12px]">חפש סביבה כדי לשלוח בקשה ראשונה</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map(r => (
        <RequestRow key={r._id} req={r} onCancel={onCancel} />
      ))}
    </div>
  );
}

function RequestRow({ req, onCancel }) {
  const STATUS = {
    pending:  { label: 'ממתין',  icon: Clock,        cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
    approved: { label: 'אושר',   icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
    rejected: { label: 'נדחה',   icon: AlertCircle,  cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' },
  }[req.status] || { label: req.status, icon: Clock, cls: 'bg-slate-100 text-slate-700' };
  const Icon = STATUS.icon;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/50">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-slate-800 dark:text-slate-100">
              {req.environmentId?.name || '—'}
            </span>
            <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold', STATUS.cls)}>
              <Icon className="h-3 w-3" />
              {STATUS.label}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              {req.requestType === 'manager' ? 'מנהל' : 'מפקד'}
            </span>
          </div>
          {req.note && (
            <p className="mt-1 text-[12.5px] text-slate-500 dark:text-slate-400">"{req.note}"</p>
          )}
          {req.decisionNote && req.status === 'rejected' && (
            <p className="mt-1 text-[12px] text-red-600 dark:text-red-300">
              סיבת דחייה: {req.decisionNote}
            </p>
          )}
          <div className="mt-1.5 text-[11px] text-slate-400">
            נשלחה: {new Date(req.createdAt).toLocaleDateString('he-IL')}
            {req.decidedAt && ` · טופלה: ${new Date(req.decidedAt).toLocaleDateString('he-IL')}`}
          </div>
        </div>
        {req.status === 'pending' && (
          <button
            type="button"
            onClick={() => onCancel(req._id)}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11.5px] font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          >
            <Trash2 className="h-3 w-3" />
            בטל
          </button>
        )}
      </div>
    </div>
  );
}
