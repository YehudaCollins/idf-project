import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BrainCircuit,
  ClipboardCheck,
  Code2,
  LayoutDashboard,
  LogIn,
  Menu,
  Network,
  Users,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { useDemoAuth } from '../auth/DemoAuth';
import { allowDemoAuthFallback } from '../auth/demoSession';
import { cn } from '../lib/utils';

const ADMIN_NAV = [
  { to: '/', label: 'לוח בקרה', icon: LayoutDashboard, end: true },
  { to: '/ingest', label: 'התחברות', icon: LogIn },
  { to: '/org-tree', label: 'עץ ארגוני', icon: Network },
  { to: '/users', label: 'משתמשים', icon: Users },
  { to: '/ai', label: 'החלטות AI', icon: BrainCircuit },
  { to: '/reviews', label: 'ביקורת', icon: ClipboardCheck, badge: true },
  { to: '/docs-api', label: 'API', icon: Code2 },
];

function CurrentUserPanel() {
  const { actor, actors, switchActor, source, createdOnLogin, authError, refreshFromSharePoint } = useDemoAuth();
  if (!actor) return null;

  const showDemoSwitcher = allowDemoAuthFallback() && source === 'demo';
  const { data: serverActors } = useQuery({
    queryKey: ['demoActors'],
    queryFn: api.demoActors,
    staleTime: 60000,
    enabled: showDemoSwitcher,
  });

  return (
    <div className="border-t border-border px-4 py-4">
      <p className="mb-2 px-2 text-xs font-medium text-subtle">
        {source === 'sharepoint' ? 'משתמש מחובר (SharePoint)' : 'מצב דמו'}
      </p>

      <div className="mb-2 rounded-xl bg-surface-2 px-3 py-2.5 text-right">
        <span className="block truncate text-sm font-medium text-foreground">{actor.fullName}</span>
        <span className="block truncate text-xs text-muted">
          {actor.personalNumber}
          {' · '}
          {actor.accessRole === 'admin' ? 'מנהל' : 'רגיל'}
        </span>
        {createdOnLogin && (
          <span className="mt-1 block text-[11px] font-medium text-brand-text">נרשם עכשיו לראשונה</span>
        )}
        {authError && source === 'demo' && (
          <span className="mt-1 block text-[11px] text-warning-text">{authError}</span>
        )}
        {source === 'sharepoint' && (
          <button
            type="button"
            onClick={() => void refreshFromSharePoint()}
            className="mt-2 text-[11px] font-medium text-brand-text hover:underline"
          >
            רענן מ-SharePoint
          </button>
        )}
      </div>

      {showDemoSwitcher && (
        <div className="space-y-1">
          {actors.map((item) => {
            if (item.id !== 'admin' && item.id !== 'regular') return null;
            const demoId = item.id;
            const server = serverActors?.find((s) => s.id === demoId);
            const active = demoId === actor.id;
            return (
              <button
                key={demoId}
                type="button"
                onClick={() => switchActor(demoId)}
                className={cn(
                  'w-full rounded-xl px-3 py-2.5 text-right transition-colors',
                  active ? 'bg-brand-soft text-brand-text' : 'text-muted hover:bg-surface-2 hover:text-foreground'
                )}
              >
                <span className="block truncate text-sm font-medium">{item.fullName}</span>
                <span className="block truncate text-xs opacity-70">
                  {server?.rank ?? item.rank ?? item.label}
                  {' · '}
                  {item.accessRole === 'admin' ? 'מנהל' : 'רגיל'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Sidebar({ pending, onClose }: { pending: number; onClose?: () => void }) {
  const { isAdmin } = useDemoAuth();
  const nav = isAdmin
    ? ADMIN_NAV
    : ADMIN_NAV.filter((n) => n.to === '/org-tree' || n.to === '/users')
        .map((n) => (n.to === '/users' ? { ...n, label: 'הפרופיל שלי' } : n));

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
          <Network className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-foreground">Unitree</p>
          <p className="text-xs text-muted">שיוך ארגוני חכם</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {nav.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-brand-soft text-brand-text'
                  : 'text-muted hover:bg-surface-2 hover:text-foreground'
              )
            }
          >
            <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
            <span className="flex-1">{label}</span>
            {badge && pending > 0 && (
              <span className="rounded-lg bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning-text">
                {pending}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <CurrentUserPanel />
    </div>
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  const { isAdmin } = useDemoAuth();
  const isTree = pathname === '/org-tree';
  const [mobile, setMobile] = useState(false);

  const { data: reviews } = useQuery({
    queryKey: ['reviews', 'needs_review'],
    queryFn: () => api.reviews('needs_review'),
    refetchInterval: 20000,
    enabled: isAdmin,
  });
  const pending = isAdmin ? reviews?.length ?? 0 : 0;

  return (
    <div className={cn('flex bg-background', isTree ? 'h-dvh max-h-dvh overflow-hidden' : 'min-h-screen')}>
      {mobile && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden"
          onClick={() => setMobile(false)}
          aria-label="סגור"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-60 flex-col border-l border-border bg-surface transition-transform md:translate-x-0',
          'md:shadow-[var(--shadow-sidebar)]',
          mobile ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        )}
      >
        <button
          type="button"
          className="absolute left-3 top-4 rounded-lg p-1.5 text-muted hover:bg-surface-2 md:hidden"
          onClick={() => setMobile(false)}
        >
          <X className="h-4 w-4" />
        </button>
        <Sidebar pending={pending} onClose={() => setMobile(false)} />
      </aside>

      <div className={cn('flex min-w-0 flex-1 flex-col md:mr-60', isTree && 'h-full min-h-0 overflow-hidden')}>
        {!isTree && (
          <button
            type="button"
            className="fixed right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-xl bg-surface shadow-sm md:hidden"
            onClick={() => setMobile(true)}
            aria-label="תפריט"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <main className={cn('flex-1', isTree ? 'min-h-0 overflow-hidden' : 'px-6 py-8 sm:px-8 lg:px-10')}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
