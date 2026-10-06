import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';

/**
 * ProjectsContext
 *
 * מנהל רשימת הפרויקטים של הסביבה הנבחרת — זמין לכל המסכים והסיידבר.
 * • viewer: יקבל רק פרויקטים שיש בהם משימות שמוקצות אליו (לפי השרת)
 * • manager / admin: יקבל את כל הפרויקטים בסביבה
 */
const ProjectsContext = createContext(null);

export function ProjectsProvider({ selectedEnv, children }) {
  const { user, isSuperAdmin, envPermissions } = useAuth();

  const [projects, setProjects] = useState([]);
  const [mineProjects, setMineProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const envId = selectedEnv?._id || null;

  const isManagerInSelected = useMemo(() => {
    if (!envId) return false;
    if (isSuperAdmin) return true;
    return envPermissions.some(p => String(p.environmentId) === String(envId) && p.type === 'manager');
  }, [envId, isSuperAdmin, envPermissions]);

  const fetchProjects = useCallback(async () => {
    if (!envId) {
      setProjects([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/projects?environmentId=${envId}`);
      setProjects(res.data || []);
    } catch (err) {
      setError(err);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [envId]);

  const fetchMineProjects = useCallback(async () => {
    if (!user) {
      setMineProjects([]);
      return;
    }
    try {
      const res = await api.get('/projects/mine');
      setMineProjects(res.data || []);
    } catch {
      setMineProjects([]);
    }
  }, [user]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);
  useEffect(() => { fetchMineProjects(); }, [fetchMineProjects]);

  const createProject = useCallback(async ({ name, description, givenDate }) => {
    if (!envId) throw new Error('no_env');
    const res = await api.post('/projects', {
      environmentId: envId,
      name,
      description,
      givenDate,
    });
    setProjects(prev => {
      const next = [...prev];
      next.push(res.data);
      next.sort((a, b) => (a.projectNumber || 0) - (b.projectNumber || 0));
      return next;
    });
    return res.data;
  }, [envId]);

  const updateProject = useCallback(async (id, patch) => {
    const res = await api.put(`/projects/${id}`, patch);
    setProjects(prev => prev.map(p => (p._id === id ? res.data : p)));
    return res.data;
  }, []);

  const deleteProject = useCallback(async (id) => {
    await api.delete(`/projects/${id}`);
    setProjects(prev => prev.filter(p => p._id !== id));
  }, []);

  const value = useMemo(() => ({
    projects,
    mineProjects,
    loading,
    error,
    isManagerInSelected,
    refresh: fetchProjects,
    refreshMine: fetchMineProjects,
    createProject,
    updateProject,
    deleteProject,
  }), [projects, mineProjects, loading, error, isManagerInSelected, fetchProjects, fetchMineProjects, createProject, updateProject, deleteProject]);

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjects must be used inside ProjectsProvider');
  return ctx;
}
