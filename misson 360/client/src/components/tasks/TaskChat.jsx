import { useState, useEffect, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';
import clsx from 'clsx';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { fmt } from './InstructionUX';

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('he-IL', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * TaskChat
 *
 * props:
 *   taskId   — מזהה ההנחיה
 *   dueDate  — תג"ב
 *   status   — סטטוס (לצבע ה-pill)
 *   showDuePill — האם להציג pill פנימי (ברירת מחדל: כן)
 */
export function TaskChat({ taskId, dueDate, status, showDuePill = true }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    if (!taskId) return;
    try {
      const r = await api.get(`/tasks/${taskId}/messages`);
      setMessages(r.data.messages || []);
      // סמן כנקרא
      api.patch(`/tasks/${taskId}/messages/mark-read`).catch(() => {});
    } catch { /* ignore */ }
  }, [taskId]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 8000);
    return () => clearInterval(pollRef.current);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText('');
    try {
      const r = await api.post(`/tasks/${taskId}/messages`, { text: t });
      setMessages(prev => [...prev, r.data]);
    } catch {
      setText(t);
    } finally {
      setSending(false);
    }
  };

  const onKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const myId = user?._id;

  /* צבע pill תג"ב */
  const pillColor =
    status === 'overdue' ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
    : status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200';

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[18px] border border-slate-200/80 bg-white/65 shadow-sm backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/50">
      <div className="pointer-events-none absolute -right-10 top-8 h-28 w-28 rounded-full bg-slate-200/35 blur-2xl dark:bg-slate-700/20" />
      <div className="pointer-events-none absolute -left-8 bottom-10 h-24 w-24 rounded-full bg-slate-100/40 blur-2xl dark:bg-slate-800/20" />
      {/* תג"ב pill */}
      {showDuePill && dueDate && (
        <div className="shrink-0 px-4 pb-2 pt-3">
          <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold', pillColor)}>
            <span>תג&quot;ב:</span>
            <span>{fmt(dueDate)}</span>
          </span>
        </div>
      )}

      {/* הודעות */}
      <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
        {messages.length === 0 && (
          <p className="py-10 text-center text-[13px] text-slate-400 dark:text-slate-500">
            אין הודעות עדיין — שלח את הראשונה
          </p>
        )}
        {messages.map(m => {
          const isMine = m.sender === myId || m.sender?._id === myId;
          return (
            <div key={m._id} className={clsx('flex flex-col gap-0.5', isMine ? 'items-end' : 'items-start')}>
              <div className={clsx(
                'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed shadow-sm ring-1',
                isMine
                  ? 'rounded-tr-sm bg-gradient-to-l from-[#c47f17] to-[#a0660e] text-white ring-[#c47f17]/30'
                  : 'rounded-tl-sm bg-white text-slate-900 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700',
              )}>
                {m.text}
              </div>
              <div className="flex items-center gap-1.5 px-1">
                {!isMine && (
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{m.senderName}</span>
                )}
                <span className="text-[10px] text-slate-400 dark:text-slate-500">{fmtTime(m.createdAt)}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* קלט */}
      <div className="shrink-0 border-t border-slate-200/80 bg-white/70 px-3 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder="כתוב הודעה… (Enter לשליחה)"
            className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-[#c47f17] focus:outline-none focus:ring-2 focus:ring-[#c47f17]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            style={{ maxHeight: '6rem', overflowY: 'auto' }}
          />
          <button
            type="button"
            onClick={send}
            disabled={!text.trim() || sending}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#c47f17] text-white shadow-sm transition hover:brightness-110 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** הוק לטעינת מספר הודעות שלא נקראו — לסימון על הכפתור */
export function useTaskChatUnread(taskId) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    const check = async () => {
      try {
        const r = await api.get(`/tasks/${taskId}/messages/unread-count`);
        if (!cancelled) setUnread(r.data.unreadCount ?? 0);
      } catch { /* ignore */ }
    };
    check();
    const t = setInterval(check, 20000);
    return () => { cancelled = true; clearInterval(t); };
  }, [taskId]);

  const reset = () => setUnread(0);
  return { unread, reset };
}
