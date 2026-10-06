import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { getMicrosoftCurrentUserProfile } from '../lib/microsoftProfile';

/**
 * AuthContext
 *
 * אימות לפי חוגר (military tag ID) — ללא סיסמה.
 *
 * זרימה אמיתית (ייצור):
 *   1. החוגר נקרא על ידי קורא החוגר
 *   2. נשלח POST /api/auth/tag עם { tagId }
 *   3. אם רשום → מקבלים JWT ומתחברים
 *   4. אם לא → "לא רשום במערכת"
 *
 * זרימת DEV (פיתוח):
 *   DevUserSwitcher מחליף משתמשים ללא חוגר פיזי
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [envPermissions, setEnvPerms] = useState([]);

  /* ── שלוף הרשאות סביבה למשתמש ── */
  const fetchPermissions = useCallback(async (currentUser) => {
    if (!currentUser || currentUser.role === 'admin') {
      setEnvPerms([]); return;
    }
    try {
      const envsRes = await api.get('/environments');
      const results = await Promise.all(
        envsRes.data.map(env =>
          api.get(`/environments/${env._id}/permissions`)
            .then(r => {
              const mine = r.data.find(p =>
                p.userId?._id === currentUser._id || p.userId === currentUser._id
              );
              return mine ? { environmentId: env._id, type: mine.type, environmentName: env.name } : null;
            })
            .catch(() => null)
        )
      );
      setEnvPerms(results.filter(Boolean));
    } catch {
      setEnvPerms([]);
    }
  }, []);

  /* ── בדוק טוקן קיים / auto-login מ-SharePoint ── */
  useEffect(() => {
    const init = async () => {
      // 1. טוקן קיים
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
          await fetchPermissions(res.data);
          setLoading(false);
          return;
        } catch {
          localStorage.removeItem('token');
        }
      }

      // 2. DEV mode — auto-login כמנהל ראשי (ללא טוקן)
      try {
        const devRes = await api.get('/dev/auto-login');
        if (devRes.data.token) {
          localStorage.setItem('token', devRes.data.token);
          setUser(devRes.data.user);
          await fetchPermissions(devRes.data.user);
          setLoading(false);
          return;
        }
      } catch {}

      // 3. נסה auto-login מהפרופיל המלא של Microsoft/SharePoint
      try {
        const profile = await getMicrosoftCurrentUserProfile({ timeoutMs: 3000 });
        if (profile) {
          const msRes = await api.post('/auth/microsoft-profile', { sharePointProfile: profile });
          if (msRes.data?.token) {
            localStorage.setItem('token', msRes.data.token);
            setUser(msRes.data.user);
            await fetchPermissions(msRes.data.user);
            setLoading(false);
            return;
          }
        }
      } catch {}

      setLoading(false);
    };
    init();
  }, [fetchPermissions]);

  /**
   * loginByTag(tagId)
   * ── נקרא כאשר החוגר מזוהה (ייצור)
   * ── DEV: נקרא גם על ידי DevUserSwitcher
   */
  const loginByTag = async (tagId) => {
    const res = await api.post('/auth/tag', { tagId });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    await fetchPermissions(res.data.user);
    return res.data.user;
  };

  /**
   * login(token, userObj)
   * ── שימוש פנימי: DevUserSwitcher מזריק טוקן ישירות
   */
  const login = async (tokenOrTagId, userObj) => {
    if (typeof userObj === 'object' && userObj !== null) {
      // dev switch: login(token, userObject)
      localStorage.setItem('token', tokenOrTagId);
      setUser(userObj);
      await fetchPermissions(userObj);
      return userObj;
    }
    // נקרא עם tagId
    return loginByTag(tokenOrTagId);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setEnvPerms([]);
  };

  const isSuperAdmin  = user?.role === 'admin';
  const canManageEnv  = (envId) => isSuperAdmin || envPermissions.some(p => p.environmentId === envId && p.type === 'manager');
  const canViewEnv    = (envId) => isSuperAdmin || envPermissions.some(p => p.environmentId === envId);

  return (
    <AuthContext.Provider value={{
      user, loading, login, loginByTag, logout,
      envPermissions, isSuperAdmin, canManageEnv, canViewEnv,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
