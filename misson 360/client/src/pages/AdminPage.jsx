import { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import DashboardPage from './DashboardPage';
import AdminTasksPage from './AdminTasksPage';
import SystemPage from './SystemPage';
import MyTasksPage from './MyTasksPage';
import EnvSettingsPage from './EnvSettingsPage';
import api from '../api/axios';

const LAST_ENV_STORAGE_KEY = 'missions360_lastEnvironmentId';

export default function AdminPage() {
  const location = useLocation();
  const [selectedEnv, setSelectedEnv] = useState(null);
  const [environments, setEnvironments] = useState([]);
  const [users, setUsers] = useState([]);

  const selectEnv = useCallback((env) => {
    setSelectedEnv(env);
    try {
      if (env?._id) localStorage.setItem(LAST_ENV_STORAGE_KEY, String(env._id));
      else localStorage.removeItem(LAST_ENV_STORAGE_KEY);
    } catch {}
  }, []);

  const fetchEnvironments = useCallback(async () => {
    try {
      const res = await api.get('/environments');
      const list = res.data || [];
      setEnvironments(list);

      setSelectedEnv((prev) => {
        if (prev) {
          const stillThere = list.find((e) => String(e._id) === String(prev._id));
          if (stillThere) return stillThere;
        }
        let savedId = null;
        try {
          savedId = localStorage.getItem(LAST_ENV_STORAGE_KEY);
        } catch {}
        const fromStorage = savedId && list.find((e) => String(e._id) === String(savedId));
        if (fromStorage) return fromStorage;
        return list[0] ?? null;
      });
    } catch {}
  }, []);

  const fetchUsers = useCallback(async () => {
    if (!selectedEnv) return;
    try {
      const res = await api.get(`/users?environmentId=${selectedEnv._id}`);
      setUsers(res.data);
    } catch {}
  }, [selectedEnv]);

  useEffect(() => { fetchEnvironments(); }, [fetchEnvironments]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  /* רענון אוטומטי כשחוזרים לחלון — לוכד סביבות שנוצרו ב-SystemPage */
  useEffect(() => {
    const onFocus = () => fetchEnvironments();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchEnvironments]);

  /* רענון כשנכנסים לנתיב /system → יוצאים ממנו */
  const prevPath = useRef('');
  useEffect(() => {
    if (prevPath.current.startsWith('/admin/system') && !location.pathname.startsWith('/admin/system')) {
      fetchEnvironments();
    }
    prevPath.current = location.pathname;
  }, [location.pathname, fetchEnvironments]);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const envId = q.get('env');
    if (!envId || !environments.length) return;
    const env = environments.find(e => String(e._id) === envId);
    if (env) selectEnv(env);
  }, [location.search, environments, selectEnv]);

  return (
    <AppLayout
      selectedEnv={selectedEnv}
      environments={environments}
      onSelectEnv={selectEnv}
      onEnvsChanged={fetchEnvironments}
    >
      <Routes>
        <Route path="/"          element={<DashboardPage  selectedEnv={selectedEnv} />} />
        <Route path="/projects"  element={<AdminTasksPage selectedEnv={selectedEnv} users={users} />} />
        <Route path="/projects/:projectId" element={<AdminTasksPage selectedEnv={selectedEnv} users={users} />} />
        {/* תאימות לאחור */}
        <Route path="/tasks"     element={<Navigate to="/admin/projects" replace />} />
        <Route path="/system"    element={<SystemPage     selectedEnv={selectedEnv} />} />
        <Route path="/my-tasks"  element={<MyTasksPage />} />
        <Route path="/my-tasks/:projectId" element={<MyTasksPage />} />
        <Route path="/env-settings"  element={<EnvSettingsPage selectedEnv={selectedEnv} />} />
        <Route path="*"          element={<Navigate to="/admin" replace />} />
      </Routes>
    </AppLayout>
  );
}
