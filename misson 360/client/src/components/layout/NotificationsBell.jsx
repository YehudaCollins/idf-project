import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import api from '../../api/axios';

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('he-IL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NotificationsBell({ onSelectEnv, environments = [] }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/notifications?limit=50');
      setItems(r.data.items || []);
      setUnreadCount(r.data.unreadCount ?? 0);
    } catch {
      /* התראות אופציונליות */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(load, 45000);
    const onFocus = () => load();
    const onVis = () => {
      if (document.visibilityState === 'visible') load();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = e => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const markRead = async id => {
    try {
      const r = await api.patch(`/notifications/${id}/read`);
      setUnreadCount(r.data.unreadCount ?? 0);
      setItems(prev => prev.map(it => (it._id === id ? { ...it, read: true } : it)));
    } catch {
      //
    }
  };

  const markAll = async () => {
    try {
      await api.patch('/notifications/read-all');
      setUnreadCount(0);
      setItems(prev => prev.map(it => ({ ...it, read: true })));
    } catch {
      //
    }
  };

  const onItemClick = async n => {
    const href = n.href || '';
    const qIndex = href.indexOf('?');
    const qs = qIndex >= 0 ? href.slice(qIndex + 1) : '';
    const params = qs ? new URLSearchParams(qs) : null;
    const envId = params?.get('env');

    setOpen(false);

    if (!href.startsWith('/')) return;

    if (envId && onSelectEnv && environments.length) {
      const env = environments.find(e => String(e._id) === envId);
      if (env) onSelectEnv(env);
    }

    navigate(href);

    if (!n.read && n._id) await markRead(n._id);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen(o => !o);
          if (!loading) load();
        }}
        className="relative p-1.5 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200"
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent';
        }}
        aria-label="התראות"
      >
        {loading && open ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Bell className="h-4 w-4" strokeWidth={2} />
        )}
        {unreadCount > 0 ? (
          <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-[9px] font-bold leading-[14px] text-center text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute bottom-full right-0 z-[60] mb-2 flex max-h-[min(70vh,24rem)] w-[min(94vw,20rem)] flex-col overflow-hidden rounded-2xl border shadow-2xl"
          style={{ background: '#2a2a2a', borderColor: 'rgba(255,255,255,0.12)' }}
        >
          <div
            className="flex items-center justify-between border-b px-3 py-2"
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <span className="text-[13px] font-bold text-white">התראות</span>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAll}
                className="text-[11px] font-semibold text-amber-400 hover:text-amber-300"
              >
                סמן הכל כנקרא
              </button>
            ) : null}
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {items.length === 0 && !loading ? (
              <p className="px-4 py-8 text-center text-[13px] text-zinc-500">אין התראות</p>
            ) : (
              items.map(n => (
                <button
                  key={n._id}
                  type="button"
                  onClick={() => onItemClick(n)}
                  className={clsx(
                    'w-full border-b px-3 py-2.5 text-right transition-colors hover:bg-white/[0.06]',
                    n.read ? 'opacity-75' : 'bg-white/[0.04]',
                  )}
                  style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <span className="shrink-0 text-[12px] text-zinc-500">{fmtTime(n.createdAt)}</span>
                    <span
                      className={clsx(
                        'text-[13px] font-bold leading-tight',
                        n.read ? 'text-zinc-300' : 'text-white',
                      )}
                    >
                      {n.title}
                    </span>
                  </div>
                  {n.body ? (
                    <p className="line-clamp-2 text-[12px] leading-snug text-zinc-400">{n.body}</p>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
