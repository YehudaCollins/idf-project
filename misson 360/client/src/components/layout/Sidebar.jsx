import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  BarChart3, FolderOpen, Settings,
  ClipboardList, SlidersHorizontal, ChevronDown,
  Sun, Moon, LayoutDashboard, KeyRound,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useProjects } from '../../context/ProjectsContext';
import { useDevMode, DevUserPopup } from './DevUserSwitcher';
import clsx from 'clsx';
import { NotificationsBell } from './NotificationsBell';
import { RequestAccessModal } from '../access/RequestAccessModal';

const GOLD     = '#f5d97a';
const GOLD_DIM = '#c9a84c';

const staticNavItems = [
  { label: 'ניהול משתמשים', href: '/admin/system',       icon: SlidersHorizontal, managerPlus: true },
  { label: 'הגדרות טבלה',  href: '/admin/env-settings',  icon: Settings,          managerPlus: true, requiresEnv: true },
];

export function Sidebar({ selectedEnv, environments = [], onSelectEnv }) {
  const { user, isSuperAdmin, envPermissions } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { isManagerInSelected } = useProjects();

  const [envOpen, setEnvOpen] = useState(false);
  const [requestAccessOpen, setRequestAccessOpen] = useState(false);
  const dev = useDevMode(selectedEnv);

  const isEnvManager = isSuperAdmin || envPermissions.some(p => p.type === 'manager');

  /* Bottom static items — system / env-settings */
  const renderStatic = () => staticNavItems
    .filter(item => (item.adminOnly ? isSuperAdmin : isManagerInSelected))
    .map(item => {
      const Icon = item.icon;
      return (
        <NavLink key={item.href} to={item.href} end={item.href === '/admin'}>
          {({ isActive }) => (
            <NavRow icon={Icon} active={isActive} label={item.label} />
          )}
        </NavLink>
      );
    });

  // האם הקישור הראשי "פרויקטים" / "ההנחיות שלי" פעיל כרגע
  const isProjectsActive = location.pathname.startsWith('/admin/projects');
  const isMyTasksActive = location.pathname.startsWith('/admin/my-tasks');

  return (
    <aside className="
      hidden md:flex flex-col shrink-0 w-[240px]
      rounded-3xl m-6 ml-0
      shadow-2xl border border-white/5
      no-print overflow-visible
    " style={{ background: 'linear-gradient(180deg, #252525 0%, #1c1c1c 60%, #161616 100%)' }}>

      {/* ── Logo ── */}
      <div className="shrink-0 px-3 pt-7 pb-5">
        <img
          src="/logo.svg"
          alt="Mission 360"
          className="w-full h-auto"
          style={{ maxHeight: '68px', objectFit: 'contain', objectPosition: 'center' }}
        />
      </div>

      <div className="h-px mx-4" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* ── Environment Selector ── */}
      <div className="px-4 py-3 relative">
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: `${GOLD}80` }}>סביבה פעילה</p>
        <button onClick={() => setEnvOpen(o => !o)}
          className="w-full flex items-center justify-between gap-2 rounded-[14px] px-3 py-2.5 transition-all text-sm"
          style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(196,127,23,0.25)` }}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
            <span className="font-medium text-white truncate text-[14px]">
              {selectedEnv?.name || 'בחר סביבה...'}
            </span>
          </div>
          <ChevronDown className={clsx('h-4 w-4 flex-shrink-0 transition-transform', envOpen && 'rotate-180')}
            style={{ color: GOLD_DIM }} />
        </button>

        {envOpen && (
          <div
            className="absolute right-4 left-4 top-full mt-1 rounded-xl shadow-2xl z-50 overflow-hidden overflow-y-auto"
            style={{
              background: '#2a2a2a',
              border: '1px solid rgba(255,255,255,0.1)',
              maxHeight: 'calc(100vh - 220px)',
            }}
          >
            {environments.map(env => (
              <button key={env._id} onClick={() => { onSelectEnv(env); setEnvOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-3 text-[14px] text-right transition-colors"
                style={{ color: selectedEnv?._id === env._id ? 'white' : '#ccc',
                  background: selectedEnv?._id === env._id ? `rgba(196,127,23,0.15)` : 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                onMouseLeave={e => e.currentTarget.style.background = selectedEnv?._id === env._id ? 'rgba(196,127,23,0.15)' : 'transparent'}>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: selectedEnv?._id === env._id ? '#4ade80' : '#555' }} />
                <span className="truncate flex-1">{env.name}</span>
              </button>
            ))}

            {!isSuperAdmin && (
              <>
                <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <button
                  onClick={() => { setEnvOpen(false); setRequestAccessOpen(true); }}
                  className="w-full flex items-center gap-2.5 px-3 py-3 text-[13px] text-right transition-colors"
                  style={{ color: GOLD }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(196,127,23,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <KeyRound className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="font-semibold">בקש גישה לסביבה אחרת</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal — בקשת גישה */}
      <RequestAccessModal
        open={requestAccessOpen}
        onClose={() => setRequestAccessOpen(false)}
      />

      <div className="h-px bg-gradient-to-l from-transparent via-slate-700/60 to-transparent mx-3" />

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">

        {/* דשבורד למנהל על */}
        {isSuperAdmin && (
          <NavLink to="/admin" end>
            {({ isActive }) => <NavRow icon={BarChart3} active={isActive} label="דשבורד" />}
          </NavLink>
        )}

        {/* הנחיות — למנהל סביבה / מנהל על */}
        {selectedEnv && isManagerInSelected && (
          <NavLink to="/admin/projects">
            {({ isActive }) => (
              <NavRow icon={FolderOpen} active={isActive || isProjectsActive} label="הנחיות" />
            )}
          </NavLink>
        )}

        {/* ההנחיות שלי — לא מנהל על */}
        {!isSuperAdmin && (
          <NavLink to="/admin/my-tasks">
            {({ isActive }) => (
              <NavRow icon={ClipboardList} active={isActive || isMyTasksActive} label="ההנחיות שלי" />
            )}
          </NavLink>
        )}

        {/* ── ניהול / הגדרות ── */}
        {(isSuperAdmin || isManagerInSelected) && (
          <>
            <div className="h-px mx-2 my-2" style={{ background: 'rgba(255,255,255,0.08)' }} />
            {renderStatic()}
          </>
        )}
      </nav>

      {/* ── Footer ── */}
      <div className="shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Bell + Theme toggle */}
        <div className="flex items-center justify-between px-5 py-3.5">
          <NotificationsBell onSelectEnv={onSelectEnv} environments={environments} />

          <button onClick={toggleTheme}
            className="relative flex items-center w-[52px] h-[28px] rounded-full transition-colors shrink-0 cursor-pointer"
            style={{ background: '#333' }}>
            <Sun className={clsx('absolute left-[6px] h-3.5 w-3.5 transition-opacity', isDark ? 'opacity-100 text-amber-400' : 'opacity-25 text-zinc-500')} strokeWidth={2} />
            <Moon className={clsx('absolute right-[6px] h-3.5 w-3.5 transition-opacity', !isDark ? `opacity-100` : 'opacity-25 text-zinc-500')}
              style={{ color: !isDark ? GOLD : undefined }} strokeWidth={2} />
            <span className={clsx('absolute top-[3px] h-[22px] w-[22px] rounded-full shadow-sm transition-all duration-200',
              isDark ? 'right-[3px]' : 'left-[3px]')} style={{ background: 'white' }} />
          </button>
        </div>

        <div className="h-px mx-4" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Admin Center button — super admin only */}
        {isSuperAdmin && (
          <div className="px-3 pt-2 pb-1">
            <button
              onClick={() => navigate('/analytics')}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[12px] transition-all text-sm"
              style={{ background: 'rgba(0,120,212,0.15)', border: '1px solid rgba(0,120,212,0.3)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,120,212,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,120,212,0.15)'}>
              <span className="flex items-center justify-center w-7 h-7 rounded-[8px] shrink-0"
                style={{ background: 'rgba(0,120,212,0.3)' }}>
                <LayoutDashboard className="h-[14px] w-[14px] text-[#60a5fa]" strokeWidth={2} />
              </span>
              <span className="text-[13px] font-medium text-[#93c5fd]">מרכז ניהול</span>
            </button>
          </div>
        )}

        <div className="h-px mx-4" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* User */}
        <div className="px-3 py-2 relative">
          <DevUserPopup {...dev} />
          <button onClick={() => dev.devMode && dev.setOpen(o => !o)}
            className={clsx('w-full flex items-center gap-3 p-2.5 rounded-[14px] transition-colors', dev.devMode ? 'cursor-pointer' : 'cursor-default')}
            onMouseEnter={e => { if (dev.devMode) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div className="h-10 w-10 rounded-[12px] flex items-center justify-center text-[16px] font-bold flex-shrink-0"
              style={{ background: `rgba(196,127,23,0.2)`, color: GOLD }}>
              {user?.name?.charAt(0) || 'מ'}
            </div>
            <div className="min-w-0 flex-1 text-right">
              <span className="text-[14px] font-semibold text-white block truncate">{user?.name}</span>
              <span className="text-[12px] block" style={{ color: `${GOLD_DIM}99` }}>
                {isSuperAdmin ? 'מנהל על' : isEnvManager ? 'מנהל סביבה' : 'מפקד'}
              </span>
            </div>
            {dev.devMode && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0"
                style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24' }}>DEV</span>
            )}
          </button>
        </div>

        {/* Environment card */}
        {selectedEnv && (
          <div className="px-2 pb-3">
            <div className="flex items-center justify-center rounded-[14px] px-1 py-1"
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(196,127,23,0.2)` }}>
              <img
                src="/logo-team-white.svg"
                alt="Alpha Development"
                className="w-full h-auto"
                style={{ maxHeight: '80px', objectFit: 'contain', objectPosition: 'center' }}
              />
            </div>
          </div>
        )}

        <p className="text-center text-[11px] pb-3 select-none" style={{ color: 'rgba(209, 194, 194, 0.98)' }}>v0.1.0</p>
      </div>
    </aside>
  );
}

function NavRow({ icon: Icon, active, label }) {
  return (
    <div
      className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 transition-all duration-200 cursor-pointer"
      style={{
        background: active ? `rgba(196,127,23,0.18)` : 'transparent',
        border: active ? `1px solid rgba(196,127,23,0.3)` : '1px solid transparent',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <span className="flex items-center justify-center w-8 h-8 rounded-[10px] shrink-0"
        style={{ background: active ? `rgba(196,127,23,0.3)` : 'rgba(255,255,255,0.06)', color: active ? GOLD : '#aaa' }}>
        {Icon ? <Icon className="h-[16px] w-[16px]" strokeWidth={2} /> : null}
      </span>
      <span className="text-[14px] tracking-tight truncate"
        style={{ color: active ? 'white' : '#bbb', fontWeight: active ? 600 : 400 }}>
        {label}
      </span>
    </div>
  );
}
