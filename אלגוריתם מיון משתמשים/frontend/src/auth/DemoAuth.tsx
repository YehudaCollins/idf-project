import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, type DemoActorResponse } from '../api/client';
import { getMicrosoftCurrentUserProfile } from '../lib/microsoftProfile';
import {
  DEMO_ACTORS,
  allowDemoAuthFallback,
  getDemoActor,
  getDemoActorById,
  readStoredSessionActor,
  setDemoActorId,
  writeStoredSessionActor,
  type DemoActorId,
  type SessionActor,
} from './demoSession';

interface DemoAuthValue {
  actor: SessionActor | null;
  actors: SessionActor[];
  isAdmin: boolean;
  loading: boolean;
  authError: string | null;
  source: SessionActor['source'] | null;
  createdOnLogin: boolean;
  switchActor: (id: DemoActorId) => void;
  refreshFromSharePoint: () => Promise<void>;
}

const DemoAuthContext = createContext<DemoAuthValue | null>(null);

function toSessionActor(payload: DemoActorResponse, source: SessionActor['source'] = 'sharepoint'): SessionActor {
  return {
    id: payload.id === 'admin' || payload.id === 'regular' ? payload.id : 'session',
    personalNumber: payload.personalNumber,
    fullName: payload.fullName,
    accessRole: payload.accessRole === 'admin' ? 'admin' : 'regular',
    label: payload.label || (payload.accessRole === 'admin' ? 'מנהל' : 'משתמש'),
    source,
    rank: payload.rank,
    role: payload.role,
    profileImageUrl: payload.profileImageUrl,
    currentOrgPathText: payload.currentOrgPathText,
  };
}

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [actor, setActor] = useState<SessionActor | null>(() => readStoredSessionActor());
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [createdOnLogin, setCreatedOnLogin] = useState(false);
  const qc = useQueryClient();

  const applyActor = useCallback(
    (next: SessionActor, opts?: { created?: boolean }) => {
      setActor(next);
      writeStoredSessionActor(next);
      if (next.source === 'demo' && (next.id === 'admin' || next.id === 'regular')) {
        setDemoActorId(next.id);
      }
      setCreatedOnLogin(Boolean(opts?.created));
      setAuthError(null);
      qc.invalidateQueries();
    },
    [qc]
  );

  const loginFromSharePoint = useCallback(async () => {
    const profile = await getMicrosoftCurrentUserProfile({ timeoutMs: 3500 });
    if (!profile) return false;

    const result = await api.loginMicrosoftProfile(profile);
    applyActor(toSessionActor(result.actor, 'sharepoint'), { created: result.created });
    return true;
  }, [applyActor]);

  const refreshFromSharePoint = useCallback(async () => {
    setLoading(true);
    try {
      const ok = await loginFromSharePoint();
      if (!ok) {
        if (allowDemoAuthFallback()) {
          applyActor({ ...getDemoActor(), source: 'demo' });
          setAuthError('לא זוהה משתמש SharePoint — במצב פיתוח נטען משתמש דמו');
        } else {
          setActor(null);
          writeStoredSessionActor(null);
          setAuthError('לא ניתן לזהות משתמש מ-SharePoint');
        }
      }
    } catch (e) {
      if (allowDemoAuthFallback()) {
        applyActor({ ...getDemoActor(), source: 'demo' });
        setAuthError(e instanceof Error ? e.message : 'שגיאת זיהוי SharePoint');
      } else {
        setActor(null);
        writeStoredSessionActor(null);
        setAuthError(e instanceof Error ? e.message : 'שגיאת זיהוי SharePoint');
      }
    } finally {
      setLoading(false);
    }
  }, [applyActor, loginFromSharePoint]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const ok = await loginFromSharePoint();
        if (cancelled) return;
        if (ok) return;

        const stored = readStoredSessionActor();
        if (stored?.source === 'sharepoint') {
          try {
            writeStoredSessionActor(stored);
            const me = await api.currentActor();
            if (!cancelled) applyActor(toSessionActor(me, 'sharepoint'));
            return;
          } catch {
            writeStoredSessionActor(null);
          }
        }

        if (allowDemoAuthFallback()) {
          if (!cancelled) applyActor({ ...getDemoActor(), source: 'demo' });
          return;
        }

        if (!cancelled) {
          setActor(null);
          setAuthError('לא ניתן לזהות משתמש מ-SharePoint');
        }
      } catch (e) {
        if (cancelled) return;
        if (allowDemoAuthFallback()) {
          applyActor({ ...getDemoActor(), source: 'demo' });
          setAuthError(e instanceof Error ? `${e.message} · נטען מצב דמו` : 'נטען מצב דמו');
        } else {
          setActor(null);
          setAuthError(e instanceof Error ? e.message : 'שגיאת זיהוי');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [applyActor, loginFromSharePoint]);

  const value = useMemo<DemoAuthValue>(
    () => ({
      actor,
      actors: DEMO_ACTORS,
      isAdmin: actor?.accessRole === 'admin',
      loading,
      authError,
      source: actor?.source ?? null,
      createdOnLogin,
      switchActor: (id) => {
        if (!allowDemoAuthFallback()) return;
        setDemoActorId(id);
        applyActor({ ...getDemoActorById(id), source: 'demo' });
      },
      refreshFromSharePoint,
    }),
    [actor, applyActor, authError, createdOnLogin, loading, refreshFromSharePoint]
  );

  return <DemoAuthContext.Provider value={value}>{children}</DemoAuthContext.Provider>;
}

export function useDemoAuth() {
  const value = useContext(DemoAuthContext);
  if (!value) throw new Error('useDemoAuth must be used within DemoAuthProvider');
  return value;
}

/** לשימוש בתוך AuthGate — מבטיח שיש actor מחובר */
export function useRequiredAuth() {
  const value = useDemoAuth();
  if (!value.actor) throw new Error('משתמש לא מחובר');
  return { ...value, actor: value.actor };
}
