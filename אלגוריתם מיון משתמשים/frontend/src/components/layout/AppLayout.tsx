import { useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  LogIn,
  Network,
  Search,
  BrainCircuit,
  ClipboardCheck,
  Menu,
  X,
} from 'lucide-react';
import { api } from '../../api/client';
import { cn } from '../../lib/utils';

const navigation = [
  { to: '/', label: 'לוח בקרה', icon: LayoutDashboard, end: true },
  { to: '/demo-login', label: 'התחברות דמו', icon: LogIn },
  { to: '/org-tree', label: 'תרשים ארגוני', icon: Network },
  { to: '/users', label: 'חיפוש משתמש', icon: Search },
  { to: '/ai-decisions', label: 'החלטות AI', icon: BrainCircuit },
  { to: '/reviews', label: 'מרכז ביקורת', icon: ClipboardCheck, badgeKey: 'reviews' as const },
];

const titles: Record<string, string> = {
  '/': 'לוח בקרה',
  '/demo-login': 'התחברות דמו',
  '/org-tree': 'תרשים ארגוני',
  '/users': 'חיפוש משתמש',
  '/ai-decisions': 'החלטות AI',
  '/reviews': 'מרכז ביקורת',
};

function Sidebar({
  pendingReviews,
  onNavigate,
}: {
  pendingReviews: number;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="border-b border-sidebar-border px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white">
            <Network className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-white">Unitree</p>
            <p className="text-[11px] text-sidebar-muted">עץ ארגוני חכם</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {navigation.map(({ to, label, icon: Icon, end, badgeKey }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-elevated text-white'
                  : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('h-4 w-4', isActive ? 'text-teal-300' : '')} />
                <span className="flex-1">{label}</span>
                {badgeKey === 'reviews' && pendingReviews > 0 && (
                  <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    {pendingReviews}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <p className="text-[11px] leading-relaxed text-sidebar-muted">
          סביבת דמו · נתונים פיקטיביים · MongoDB מקומי
        </p>
      </div>
    </>
  );
}

export function AppLayout() {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pageTitle = titles[pathname] ?? 'Unitree';
  const isOrgTree = pathname === '/org-tree';

  const { data: reviews } = useQuery({
    queryKey: ['reviews', 'needs_review'],
    queryFn: () => api.reviews('needs_review'),
    refetchInterval: 20000,
  });
  const pendingReviews = reviews?.length ?? 0;

  return (
    <div className={cn('flex app-canvas', isOrgTree ? 'h-dvh max-h-dvh overflow-hidden' : 'min-h-screen')}>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="סגור תפריט"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-64 flex-col bg-sidebar transition-transform lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        )}
      >
        <Sidebar pendingReviews={pendingReviews} onNavigate={() => setMobileOpen(false)} />
      </aside>

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col lg:mr-64',
          isOrgTree ? 'h-full min-h-0 overflow-hidden' : 'min-h-screen'
        )}
      >
        {!isOrgTree && (
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm md:px-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
                  onClick={() => setMobileOpen((o) => !o)}
                  aria-label="תפריט"
                >
                  {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
                <h1 className="text-[15px] font-semibold text-slate-900">{pageTitle}</h1>
              </div>
              {pendingReviews > 0 && pathname !== '/reviews' && (
                <Link
                  to="/reviews"
                  className="rounded-lg bg-amber-50 px-3 py-1.5 text-[12px] font-semibold text-amber-800 ring-1 ring-amber-200"
                >
                  {pendingReviews} ביקורות
                </Link>
              )}
            </div>
          </header>
        )}

        <main
          className={cn(
            'flex flex-1 flex-col',
            isOrgTree ? 'min-h-0 overflow-hidden' : 'px-4 py-8 md:px-8'
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
