import { Fragment, useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import {
  Plus, Search, LayoutGrid, Table as TableIcon, Bell, Check, X,
  Trash2, AlertCircle, Sparkles, Pencil, FileSpreadsheet,
  Calendar, Clock, Shield, MessageSquare, Paperclip, File, Image, FileText, Download,
  BarChart3, Folder, ChevronDown, Users, FolderPlus, SlidersHorizontal, RotateCcw,
} from 'lucide-react';
import { TaskChat, useTaskChatUnread } from '../components/tasks/TaskChat';
import clsx from 'clsx';
import api from '../api/axios';
import { TaskForm } from '../components/tasks/TaskForm';
import { ProjectForm } from '../components/projects/ProjectForm';
import { ProjectStatsPanel } from '../components/projects/ProjectStatsPanel';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectsContext';
import { useConfirm } from '../hooks/useConfirm';
import { AlertModal } from '../components/ui/ConfirmModal';
import {
  InstructionStatusBadge,
  DueUrgency,
  CustomFieldsSection,
  LevelsTrack,
  HistoryTimeline,
  MetaTile,
  PanelChrome,
  InstructionPanelHeader,
  InstructionPanelBody,
  InstructionPanelFooter,
  InstructionProse,
  fmt,
  fmtFull,
  normalizeCustomFields,
  teamAssignmentLabel,
  STATUS_ADMIN,
} from '../components/tasks/InstructionUX';
const FILTERS = [
  ['all', 'הכל', ''],
  ['waiting_approval', 'ממתין לאישור', 'from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30'],
  ['pending', 'ממתין', 'from-slate-50 to-zinc-50 dark:from-slate-900 dark:to-zinc-900/80'],
  ['in_progress', 'בתהליך', 'from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20'],
  ['overdue', 'בחריגה', 'from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20'],
  ['rejected', 'נדחו', 'from-red-50 to-red-100 dark:from-red-950/40'],
  ['completed', 'הושלמו', 'from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20'],
];

function TaskInstructionModalShell({ onClose, heading, actionLabel, actionFormId, children }) {
  return (
    <div
      className="max-h-[92vh] w-full max-w-[min(96vw,44rem)] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
      onClick={e => e.stopPropagation()}
    >
      <div className="relative bg-gradient-to-l from-[#a0660e] to-[#c47f17] px-3 py-3 sm:px-5 sm:py-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="סגור"
          className="absolute right-3 top-3 rounded-lg border border-white/70 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-50 sm:right-5 sm:top-4"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center justify-center gap-2">
          <div className="min-w-0 text-center text-white">
            <div className="text-[20px] font-bold tracking-tight sm:text-[22px]">{heading}</div>
          </div>
        </div>
        <button
          type="submit"
          form={actionFormId}
          className="absolute left-3 top-3 rounded-lg border border-white/70 bg-white px-3 py-1.5 text-[12px] font-bold text-[#a0660e] shadow-sm transition hover:bg-amber-50 sm:left-5 sm:top-4"
        >
          {actionLabel}
        </button>
      </div>
      <div className="max-h-[calc(92vh-7.5rem)] overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
        {children}
      </div>
    </div>
  );
}

export default function AdminTasksPage({ selectedEnv, users }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { projectId: urlProjectId } = useParams();
  const [searchParams] = useSearchParams();
  const taskFromUrl = searchParams.get('task');
  const { refresh: refreshProjectsCtx } = useProjects();

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('table');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [openTask, setOpenTask] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [formAlert, setFormAlert] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [submittingProject, setSubmittingProject] = useState(false);

  // Expansion + active project state
  const [expandedProjectIds, setExpandedProjectIds] = useState(() => new Set());
  const [activeProjectId, setActiveProjectId] = useState(null);

  // סינון מתקדם
  const ADVANCED_DEFAULTS = {
    assigneeId: '',
    level1: '',
    level2: '',
    level3: '',
    level4: '',
    level5: '',
    targetRole: '',
    dueFrom: '',
    dueTo: '',
    hasAttachments: false,
    groupedOnly: false,
  };
  const [advanced, setAdvanced] = useState(ADVANCED_DEFAULTS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const setAdv = (k, v) => setAdvanced(prev => ({ ...prev, [k]: v }));
  const clearAdvanced = () => setAdvanced(ADVANCED_DEFAULTS);

  const load = useCallback(async () => {
    if (!selectedEnv) return;
    setLoading(true);
    try {
      const [projectsRes, tasksRes, tmplRes] = await Promise.all([
        api.get(`/projects?environmentId=${selectedEnv._id}`),
        api.get(`/tasks?environmentId=${selectedEnv._id}`),
        api.get(`/environments/${selectedEnv._id}/template`).catch(() => ({ data: null })),
      ]);
      setProjects(projectsRes.data || []);
      setTasks(tasksRes.data || []);
      setTemplate(tmplRes.data);
    } finally {
      setLoading(false);
    }
  }, [selectedEnv]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-expand from URL (/admin/projects/:projectId)
  useEffect(() => {
    if (urlProjectId) {
      setExpandedProjectIds(prev => new Set([...prev, urlProjectId]));
      setActiveProjectId(urlProjectId);
    }
  }, [urlProjectId]);

  // Auto-open task panel + expand its project
  useEffect(() => {
    if (!taskFromUrl || !tasks.length) return;
    const t = tasks.find(x => String(x._id) === taskFromUrl);
    if (t) {
      setOpenTask(t);
      const pid = String(t.projectId?._id || t.projectId || '');
      if (pid) {
        setExpandedProjectIds(prev => new Set([...prev, pid]));
        setActiveProjectId(pid);
      }
    }
  }, [taskFromUrl, tasks]);

  const refreshOpen = async () => {
    await load();
    if (openTask && selectedEnv) {
      const r = await api.get(`/tasks?environmentId=${selectedEnv._id}`);
      const updated = r.data.find(t => t._id === openTask._id);
      if (updated) setOpenTask(updated);
    }
  };

  const toggleProject = (projectId) => {
    const wasExpanded = expandedProjectIds.has(projectId);
    setExpandedProjectIds(prev => {
      const next = new Set(prev);
      if (wasExpanded) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
    setActiveProjectId(wasExpanded ? null : projectId);
  };

  const tasksByProject = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      const pid = String(t.projectId?._id || t.projectId || '');
      if (!pid) continue;
      if (!map[pid]) map[pid] = [];
      map[pid].push(t);
    }
    return map;
  }, [tasks]);

  // קבוצות הקצאה: taskGroupId → רשימת ההנחיות שבקבוצה (לצורך תג "X/Y בקבוצה")
  const groupInfo = useMemo(() => {
    const m = new Map();
    for (const t of tasks) {
      if (!t.taskGroupId) continue;
      const gid = String(t.taskGroupId);
      if (!m.has(gid)) m.set(gid, { total: 0, completed: 0 });
      const g = m.get(gid);
      g.total += 1;
      if (t.status === 'completed') g.completed += 1;
    }
    return m;
  }, [tasks]);

  const projectStats = useMemo(() => {
    const stats = {};
    for (const p of projects) {
      const pid = String(p._id);
      const pTasks = tasksByProject[pid] || [];
      const completed = pTasks.filter(t => t.status === 'completed').length;
      const total = pTasks.length;
      const people = new Set(pTasks.map(t => String(t.assignedTo?._id || t.assignedTo || '')).filter(Boolean));
      stats[pid] = {
        total,
        completed,
        progressPct: total ? Math.round((completed / total) * 100) : 0,
        peopleCount: people.size,
      };
    }
    return stats;
  }, [projects, tasksByProject]);

  const activeProject = activeProjectId
    ? projects.find(p => String(p._id) === String(activeProjectId)) || null
    : null;

  const counts = useMemo(() => {
    const c = { all: tasks.length };
    Object.keys(STATUS_ADMIN).forEach(s => {
      c[s] = tasks.filter(t => t.status === s).length;
    });
    return c;
  }, [tasks]);

  const taskMatchesSearch = useCallback((t) => {
    const q = search.trim();
    if (!q) return true;
    const cf = normalizeCustomFields(t);
    const customHit = Object.values(cf).some(v => v && String(v).includes(q));
    return (
      t.title?.includes(q) ||
      t.description?.includes(q) ||
      String(t.taskNumber).includes(q) ||
      customHit ||
      t.assignedTo?.name?.includes(q) ||
      [t.level1, t.level2, t.level3, t.level4, t.level5, t.targetRole].filter(Boolean).join(' ').includes(q)
    );
  }, [search]);

  const taskMatchesStatus = useCallback((t) => (
    filterStatus === 'all' || t.status === filterStatus
  ), [filterStatus]);

  const taskMatchesAdvanced = useCallback((t) => {
    if (advanced.assigneeId) {
      const aid = String(t.assignedTo?._id || t.assignedTo || '');
      if (aid !== advanced.assigneeId) return false;
    }
    if (advanced.level1 && t.level1 !== advanced.level1) return false;
    if (advanced.level2 && t.level2 !== advanced.level2) return false;
    if (advanced.level3 && t.level3 !== advanced.level3) return false;
    if (advanced.level4 && t.level4 !== advanced.level4) return false;
    if (advanced.level5 && t.level5 !== advanced.level5) return false;
    if (advanced.targetRole) {
      const q = advanced.targetRole.trim();
      if (!t.targetRole || !t.targetRole.includes(q)) return false;
    }
    if (advanced.dueFrom) {
      if (!t.dueDate) return false;
      if (new Date(t.dueDate) < new Date(advanced.dueFrom)) return false;
    }
    if (advanced.dueTo) {
      if (!t.dueDate) return false;
      // עד סוף היום של תאריך-עד
      const end = new Date(advanced.dueTo);
      end.setHours(23, 59, 59, 999);
      if (new Date(t.dueDate) > end) return false;
    }
    if (advanced.hasAttachments && !(t.attachments?.length > 0)) return false;
    if (advanced.groupedOnly && !t.taskGroupId) return false;
    return true;
  }, [advanced]);

  const activeAdvancedCount = useMemo(() => {
    let n = 0;
    if (advanced.assigneeId) n++;
    if (advanced.level1) n++;
    if (advanced.level2) n++;
    if (advanced.level3) n++;
    if (advanced.level4) n++;
    if (advanced.level5) n++;
    if (advanced.targetRole.trim()) n++;
    if (advanced.dueFrom) n++;
    if (advanced.dueTo) n++;
    if (advanced.hasAttachments) n++;
    if (advanced.groupedOnly) n++;
    return n;
  }, [advanced]);

  // אפשרויות לרמות — נשאבות מהמשתמשים בסביבה (עם cascading קל: לאחר רמה גבוהה, רק מותאמים)
  const levelOptions = useMemo(() => {
    const fits = (u) => (
      (!advanced.level1 || u.level1 === advanced.level1) &&
      (!advanced.level2 || u.level2 === advanced.level2) &&
      (!advanced.level3 || u.level3 === advanced.level3) &&
      (!advanced.level4 || u.level4 === advanced.level4) &&
      (!advanced.level5 || u.level5 === advanced.level5)
    );
    const collect = (k, ignoreSelf = true) => {
      const set = new Set();
      for (const u of users) {
        if (!u[k]) continue;
        // לכל רמה, נכלול ערכים שמתאימים לסינון של שאר הרמות (תמיכה ב-cascade עדין)
        const matchOthers = ignoreSelf
          ? Object.keys(advanced).every(key => {
              if (!key.startsWith('level')) return true;
              if (key === k) return true;
              return !advanced[key] || u[key] === advanced[key];
            })
          : fits(u);
        if (matchOthers) set.add(u[k]);
      }
      return [...set].sort();
    };
    return {
      level1: collect('level1'),
      level2: collect('level2'),
      level3: collect('level3'),
      level4: collect('level4'),
      level5: collect('level5'),
    };
  }, [users, advanced]);

  const responsibilityLevels = template?.responsibilityLevels ?? 4;
  const visibleLevelKeys = useMemo(() => {
    const all = ['level1', 'level2', 'level3', 'level4', 'level5'];
    return all.slice(all.length - responsibilityLevels);
  }, [responsibilityLevels]);

  // אנשים זמינים לסינון: מוגבל לאלה שמופיעים בפועל כ-assignedTo במשימות הסביבה
  const assigneeOptions = useMemo(() => {
    const m = new Map();
    for (const t of tasks) {
      if (t.assignedTo?._id) m.set(String(t.assignedTo._id), t.assignedTo);
    }
    return [...m.values()].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'));
  }, [tasks]);

  const filtered = useMemo(() => {
    return tasks.filter(t => taskMatchesStatus(t) && taskMatchesSearch(t) && taskMatchesAdvanced(t));
  }, [tasks, taskMatchesStatus, taskMatchesSearch, taskMatchesAdvanced]);

  // פילטור פרויקטים: מציגים פרויקטים שהשם/תיאור שלהם תואמים לחיפוש,
  // או שיש בהם משימות תואמות.
  const filteredProjects = useMemo(() => {
    const q = search.trim();
    const anyFilterActive = q || filterStatus !== 'all' || activeAdvancedCount > 0;
    return projects.filter(p => {
      const pid = String(p._id);
      const pTasks = tasksByProject[pid] || [];
      const tasksHere = pTasks.filter(t => taskMatchesStatus(t) && taskMatchesSearch(t) && taskMatchesAdvanced(t));
      if (q) {
        const projectMatches = p.name?.includes(q) || p.description?.includes(q);
        return projectMatches || tasksHere.length > 0;
      }
      // אין סינון פעיל — הצג הכל. אחרת הצג רק פרויקטים שיש בהם תוצאות.
      if (!anyFilterActive) return true;
      return tasksHere.length > 0;
    });
  }, [projects, tasksByProject, search, filterStatus, activeAdvancedCount, taskMatchesStatus, taskMatchesSearch, taskMatchesAdvanced]);

  const tasksForProject = useCallback((projectId) => {
    const pTasks = tasksByProject[String(projectId)] || [];
    return pTasks.filter(t => taskMatchesStatus(t) && taskMatchesSearch(t) && taskMatchesAdvanced(t));
  }, [tasksByProject, taskMatchesStatus, taskMatchesSearch, taskMatchesAdvanced]);

  const customCols = template?.customColumns ?? [];

  const handleCreateProject = async (data) => {
    setSubmittingProject(true);
    try {
      const res = await api.post('/projects', {
        environmentId: selectedEnv._id,
        ...data,
      });
      setShowAddProject(false);
      await load();
      await refreshProjectsCtx?.();
      // פתח את הפרויקט החדש
      const newId = res.data._id;
      setExpandedProjectIds(prev => new Set([...prev, newId]));
      setActiveProjectId(newId);
    } catch (err) {
      setFormAlert({
        title: 'לא ניתן ליצור פרויקט',
        message: err.response?.data?.message || 'שגיאה',
      });
    } finally {
      setSubmittingProject(false);
    }
  };

  const handleExportExcel = async () => {
    if (!filtered.length || exporting) return;
    setExporting(true);
    try {
      const XLSX = await import('xlsx-js-style');
      const rows = filtered.map(task => {
        const cf = normalizeCustomFields(task);
        const row = {
          'מספר הנחיה': task.taskNumber ?? '',
          'נושא ההנחיה': task.title || '',
          'פירוט ההנחיה': task.description || '',
          'מועד מתן': fmt(task.givenDate),
          'תאריך גמר ביצוע': fmt(task.dueDate),
          'סטטוס': STATUS_ADMIN[task.status]?.label || task.status || '',
          'שיוך לצוות': teamAssignmentLabel(task),
          'תפקיד רלוונטי': task.targetRole || '',
        };
        customCols.forEach(col => {
          row[col.label] = cf[col.id] || '';
        });
        return row;
      });

      const headers = Object.keys(rows[0] || {});
      const title = `דוח הנחיות - ${selectedEnv?.name || ''}`;
      const generatedAt = `הופק בתאריך: ${new Date().toLocaleString('he-IL')}`;
      const dataAoa = [
        [title],
        [generatedAt],
        [],
        headers,
        ...rows.map(r => headers.map(h => r[h] ?? '')),
      ];

      const ws = XLSX.utils.aoa_to_sheet(dataAoa);
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(headers.length - 1, 0) } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(headers.length - 1, 0) } },
      ];

      // פילטר על שורת הכותרות (שורה 4 באקסל)
      ws['!autofilter'] = {
        ref: XLSX.utils.encode_range({
          s: { r: 3, c: 0 },
          e: { r: Math.max(rows.length + 3, 3), c: Math.max(headers.length - 1, 0) },
        }),
      };

      // רוחבי עמודות לקריאות טובה
      ws['!cols'] = headers.map(h => {
        if (h === 'פירוט ההנחיה') return { wch: 52 };
        if (h === 'נושא ההנחיה') return { wch: 32 };
        if (h === 'שיוך לצוות') return { wch: 26 };
        if (h === 'תפקיד רלוונטי') return { wch: 20 };
        return { wch: 16 };
      });

      // הקפאת שורות עליונות (כותרת+מטא+שורת כותרות)
      ws['!freeze'] = { xSplit: 0, ySplit: 4 };

      // סגנון מתקדם
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          if (!ws[cellRef]) continue;
          ws[cellRef].s = {
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
              top: { style: 'thin', color: { rgb: 'D1D5DB' } },
              bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
              left: { style: 'thin', color: { rgb: 'D1D5DB' } },
              right: { style: 'thin', color: { rgb: 'D1D5DB' } },
            },
            font: { name: 'Calibri', sz: 11, color: { rgb: '1F2937' } },
          };

          if (r === 0) {
            ws[cellRef].s.font = { name: 'Calibri', bold: true, sz: 20, color: { rgb: 'FFFFFF' } };
            ws[cellRef].s.fill = { patternType: 'solid', fgColor: { rgb: 'A0660E' } };
            ws[cellRef].s.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
            ws[cellRef].s.border = {};
          } else if (r === 1) {
            ws[cellRef].s.font = { name: 'Calibri', bold: false, italic: true, sz: 12, color: { rgb: '4B5563' } };
            ws[cellRef].s.fill = { patternType: 'solid', fgColor: { rgb: 'FDF2D8' } };
            ws[cellRef].s.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
            ws[cellRef].s.border = {};
          } else if (r === 3) {
            ws[cellRef].s.font = { name: 'Calibri', bold: true, sz: 11, color: { rgb: 'FFFFFF' } };
            ws[cellRef].s.fill = { patternType: 'solid', fgColor: { rgb: 'A0660E' } };
            ws[cellRef].s.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
          } else if (r > 3 && (r - 4) % 2 === 1) {
            ws[cellRef].s.fill = { patternType: 'solid', fgColor: { rgb: 'FFF8E6' } };
          }
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'הנחיות');
      const safeEnv = (selectedEnv?.name || 'env').replace(/[\\/:*?"<>|]/g, '_');
      const datePart = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `instructions-${safeEnv}-${datePart}.xlsx`);
    } catch (err) {
      setFormAlert({
        title: 'לא ניתן לייצא לאקסל',
        message: err?.message || 'שגיאה בלתי צפויה',
      });
    } finally {
      setExporting(false);
    }
  };

  if (!selectedEnv) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <Sparkles className="h-10 w-10 text-slate-300 dark:text-slate-600" />
        <p className="text-[15px] font-medium text-slate-500 dark:text-slate-400">בחר סביבה מהתפריט הצדדי כדי לנהל הנחיות</p>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'flex min-h-0 flex-1 flex-col gap-5 overflow-hidden lg:flex-row lg:gap-4 xl:gap-5',
        openTask && 'lg:items-stretch',
      )}
    >
      {/* רשימה — חלק גדול מהרוחב כשפאנל פתוח */}
      <section
        className={clsx(
          'flex min-h-0 min-w-0 flex-col gap-5 transition-[flex] duration-300',
          openTask
            ? 'lg:basis-0 lg:flex-[2] lg:min-w-[min(100%,26rem)]'
            : 'w-full flex-1',
        )}
      >
        {/* כותרת */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-slate-100/70 p-6 text-slate-900 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 dark:text-white">
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--institutional)]">
                מתן הנחיות
              </p>
              <h1 className="mt-1 text-[26px] font-bold tracking-tight text-slate-900 dark:text-white">
                הנחיות בסביבה
              </h1>
              <p className="mt-1 text-[14px] text-slate-600 dark:text-slate-200/85">
                {selectedEnv.name}
              </p>
              {activeProject && (
                <div className="mt-3 inline-flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[12px] font-semibold text-[#a0660e] ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900/50">
                    <Folder className="h-3.5 w-3.5" />
                    פרויקט פעיל: {activeProject.name}
                  </span>
                  {activeProject.givenDate && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-[12px] font-medium text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                      <Calendar className="h-3.5 w-3.5" />
                      תאריך מתן: {new Date(activeProject.givenDate).toLocaleDateString('he-IL')}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowStats(true)}
                disabled={!activeProject}
                title={!activeProject ? 'בחר פרויקט כדי לצפות בסטטיסטיקות' : `סטטיסטיקות לפרויקט: ${activeProject.name}`}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-bold text-slate-700 shadow-sm transition hover:border-[#c47f17]/40 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-amber-950/30"
              >
                <BarChart3 className="h-4 w-4 text-[#c47f17]" />
                סטטיסטיקות
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={!filtered.length || exporting}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-gradient-to-l from-emerald-700 to-emerald-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {exporting ? 'מכין קובץ…' : 'הורד כאקסל'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddProject(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#a0660e]/30 bg-white px-4 py-2.5 text-[13px] font-bold text-[#a0660e] shadow-sm transition hover:border-[#c47f17] hover:bg-amber-50 dark:border-amber-900/40 dark:bg-slate-800 dark:text-amber-300 dark:hover:bg-amber-950/30"
              >
                <FolderPlus className="h-5 w-5" />
                פרויקט חדש
              </button>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                disabled={!activeProject}
                title={!activeProject ? 'בחר/פתח פרויקט תחילה כדי להוסיף לו הנחיה' : `הוסף הנחיה לפרויקט: ${activeProject.name}`}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-[#a0660e] to-[#c47f17] px-5 py-2.5 text-[14px] font-bold text-white shadow-lg shadow-amber-900/15 transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-5 w-5" />
                הנחיה חדשה
              </button>
            </div>
          </div>
        </div>

        {/* סרגל כלים */}
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/50">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="חיפוש לפי צוות (מסלול), כותרת, פירוט, אדם, מס׳…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pr-10 pl-9 text-[14px] text-slate-800 placeholder:text-slate-400 focus:border-[var(--institutional)] focus:outline-none focus:ring-2 focus:ring-[var(--institutional)]/25 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-600 dark:hover:bg-slate-700"
                  aria-label="נקה חיפוש"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className={clsx(
                'relative inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-bold shadow-sm transition',
                showAdvanced || activeAdvancedCount > 0
                  ? 'border-[#c47f17] bg-gradient-to-l from-amber-50 to-white text-[#a0660e] dark:border-amber-700/70 dark:from-amber-950/40 dark:to-slate-900/40 dark:text-amber-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-[#c47f17]/40 hover:bg-amber-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-amber-950/30',
              )}
              aria-expanded={showAdvanced}
            >
              <SlidersHorizontal className="h-4 w-4" />
              סינון
              {activeAdvancedCount > 0 && (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#c47f17] px-1.5 text-[10.5px] font-bold text-white">
                  {activeAdvancedCount}
                </span>
              )}
              <ChevronDown
                className={clsx('h-3.5 w-3.5 transition-transform', showAdvanced && 'rotate-180')}
              />
            </button>
            <div className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-600 dark:bg-slate-800">
              {[
                ['table', TableIcon],
                ['cards', LayoutGrid],
              ].map(([m, Icon]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setViewMode(m)}
                  className={clsx(
                    'rounded-lg p-2.5 transition-all',
                    viewMode === m
                      ? 'bg-white text-[var(--institutional)] shadow-sm dark:bg-slate-700'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
                  )}
                  aria-label={m === 'table' ? 'תצוגת טבלה' : 'תצוגת כרטיסים'}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FILTERS.map(([key, label, grad]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilterStatus(key)}
                className={clsx(
                  'shrink-0 rounded-full border px-4 py-2 text-[13px] font-semibold transition-all',
                  filterStatus === key
                    ? clsx('border-transparent bg-gradient-to-l text-slate-900 shadow-md dark:text-slate-50', grad || 'from-[var(--institutional-light)] to-amber-100/80 dark:from-amber-950/50 dark:to-amber-900/30')
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
                )}
              >
                {label}
                <span className="mr-1.5 text-[12px] font-bold opacity-70">({counts[key] ?? 0})</span>
              </button>
            ))}
          </div>

          {/* Panel סינון מתקדם */}
          {showAdvanced && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-amber-100/80 bg-gradient-to-br from-amber-50/40 via-white to-white p-4 ring-1 ring-amber-100/40 dark:border-amber-900/40 dark:from-amber-950/15 dark:via-slate-900/60 dark:to-slate-900/60 dark:ring-amber-900/20">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-slate-900/60">
                    <SlidersHorizontal className="h-4 w-4 text-[#c47f17]" />
                  </div>
                  <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">סינון מתקדם</p>
                  {activeAdvancedCount > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-[#a0660e] dark:bg-amber-950/40 dark:text-amber-200">
                      {activeAdvancedCount} פעילים
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {activeAdvancedCount > 0 && (
                    <button
                      type="button"
                      onClick={clearAdvanced}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-red-950/30"
                    >
                      <RotateCcw className="h-3 w-3" />
                      נקה הכל
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(false)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                    aria-label="סגור"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <FilterField label="אדם מוקצה" hint={advanced.assigneeId ? '' : 'כל המוקצים'}>
                  <select
                    value={advanced.assigneeId}
                    onChange={e => setAdv('assigneeId', e.target.value)}
                    className={advSelectCls}
                  >
                    <option value="">כל האנשים</option>
                    {assigneeOptions.map(u => (
                      <option key={u._id} value={u._id}>
                        {u.name}{u.jobTitle ? ` · ${u.jobTitle}` : ''}
                      </option>
                    ))}
                  </select>
                </FilterField>

                <FilterField label="תפקיד רלוונטי">
                  <input
                    value={advanced.targetRole}
                    onChange={e => setAdv('targetRole', e.target.value)}
                    placeholder="ק״אג״מ · רמ״ד…"
                    className={advInputCls}
                  />
                </FilterField>

                <FilterField label="קבצים / קבוצה">
                  <div className="flex flex-wrap gap-1.5">
                    <FilterChip
                      active={advanced.hasAttachments}
                      onClick={() => setAdv('hasAttachments', !advanced.hasAttachments)}
                      icon={Paperclip}
                    >
                      עם קבצים
                    </FilterChip>
                    <FilterChip
                      active={advanced.groupedOnly}
                      onClick={() => setAdv('groupedOnly', !advanced.groupedOnly)}
                      icon={Users}
                    >
                      בקבוצת הקצאה
                    </FilterChip>
                  </div>
                </FilterField>

                <FilterField label="תג״ב מתאריך">
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      value={advanced.dueFrom}
                      onChange={e => setAdv('dueFrom', e.target.value)}
                      className={advInputCls + ' pr-8'}
                    />
                  </div>
                </FilterField>

                <FilterField label="תג״ב עד תאריך">
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      value={advanced.dueTo}
                      onChange={e => setAdv('dueTo', e.target.value)}
                      className={advInputCls + ' pr-8'}
                    />
                  </div>
                </FilterField>

                {visibleLevelKeys.length > 0 && (
                  <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-inner dark:border-slate-700 dark:bg-slate-900/40 sm:col-span-2 lg:col-span-3">
                    <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      שיוך לרמות
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {visibleLevelKeys.map((key, i) => {
                        const opts = levelOptions[key] || [];
                        return (
                          <div key={key}>
                            <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                              רמה {i + 1}
                            </label>
                            <select
                              value={advanced[key]}
                              onChange={e => setAdv(key, e.target.value)}
                              className={advSelectCls}
                            >
                              <option value="">— הכל —</option>
                              {opts.map(o => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Summary bar */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-amber-100/70 pt-3 text-[12px] dark:border-amber-900/30">
                <p className="text-slate-500 dark:text-slate-400">
                  מציג <span className="font-bold text-slate-800 dark:text-slate-100">{filtered.length}</span>
                  {' '}מתוך <span className="font-bold text-slate-800 dark:text-slate-100">{tasks.length}</span> הנחיות
                </p>
                {activeAdvancedCount === 0 && (
                  <p className="text-[11.5px] text-slate-400">בחר ערכים כדי לסנן</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* תוכן — גלילה רק באזור הרשימה */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 py-20 dark:border-slate-700">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--institutional)] border-t-transparent" />
            <p className="text-[14px] text-slate-500">טוען הנחיות…</p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/30">
            <div className="max-w-full overflow-x-auto">
              <table
                className={clsx(
                  'w-full border-collapse text-right',
                  openTask ? 'min-w-[600px]' : 'min-w-[720px]',
                )}
              >
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/95 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-400">
                    <th className="sticky right-0 z-[1] whitespace-nowrap bg-slate-50/95 px-3 py-3 dark:bg-slate-800/90">מס׳</th>
                    <th className="min-w-[140px] px-3 py-3">נושא</th>
                    <th className="min-w-[160px] px-3 py-3">פירוט</th>
                    {customCols.map(c => (
                      <th key={c.id} className="min-w-[100px] whitespace-nowrap px-3 py-3 text-[var(--institutional)]">
                        {c.label}
                      </th>
                    ))}
                    <th className="whitespace-nowrap px-3 py-3">תג&quot;ב</th>
                    <th className="min-w-[160px] px-3 py-3">הצוות</th>
                    <th className="whitespace-nowrap px-3 py-3">סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project) => {
                    const pid = String(project._id);
                    const expanded = expandedProjectIds.has(pid);
                    const isActive = String(activeProjectId) === pid;
                    const stats = projectStats[pid] || { total: 0, completed: 0, progressPct: 0, peopleCount: 0 };
                    const childTasks = expanded ? tasksForProject(pid) : [];
                    return (
                      <Fragment key={pid}>
                        <ProjectTableRow
                          project={project}
                          stats={stats}
                          expanded={expanded}
                          active={isActive}
                          customColCount={customCols.length}
                          onToggle={() => toggleProject(pid)}
                        />
                        {expanded && childTasks.map((task, i) => {
                          const cf = normalizeCustomFields(task);
                          const active = openTask?._id === task._id;
                          return (
                            <tr
                              key={task._id}
                              onClick={(e) => { e.stopPropagation(); setOpenTask(task); }}
                              className={clsx(
                                'cursor-pointer border-b border-slate-100 transition-colors dark:border-slate-800',
                                active
                                  ? 'bg-[var(--institutional-light)]/90 dark:bg-amber-950/25'
                                  : i % 2 === 0
                                    ? 'bg-white hover:bg-slate-50/90 dark:bg-transparent dark:hover:bg-slate-800/40'
                                    : 'bg-slate-50/40 hover:bg-slate-100/60 dark:bg-slate-900/20 dark:hover:bg-slate-800/50',
                              )}
                            >
                              <td className="sticky right-0 whitespace-nowrap border-l border-slate-100 bg-inherit px-3 py-3 font-mono text-[12px] text-slate-500 dark:border-slate-800">
                                <span className="inline-block min-w-[28px] pl-2 text-amber-700/60 dark:text-amber-300/50">↳</span>
                                {task.taskNumber}
                              </td>
                              <td className="max-w-[220px] px-3 py-3">
                                <div className="font-semibold text-slate-900 dark:text-slate-100">{task.title}</div>
                              </td>
                              <td className="max-w-[200px] px-3 py-3 text-[12px] text-slate-500 dark:text-slate-400">
                                <span className="line-clamp-2">{task.description || '—'}</span>
                              </td>
                              {customCols.map(col => (
                                <td key={col.id} className="max-w-[140px] px-3 py-3 text-[12px] text-slate-600 dark:text-slate-300">
                                  <span className="line-clamp-2">{cf[col.id] || '—'}</span>
                                </td>
                              ))}
                              <td className="whitespace-nowrap px-3 py-3">
                                <div className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{fmt(task.dueDate)}</div>
                                <div className="mt-0.5">
                                  <DueUrgency dueDate={task.dueDate} status={task.status} />
                                </div>
                              </td>
                              <td className="max-w-[220px] px-3 py-3 text-[12px] font-medium text-slate-700 dark:text-slate-200">
                                <div className="line-clamp-2" title={teamAssignmentLabel(task)}>
                                  {teamAssignmentLabel(task)}
                                </div>
                                {task.assignedTo?.name && (
                                  <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                    <Users className="h-3 w-3" />
                                    <span className="truncate">{task.assignedTo.name}</span>
                                    {task.taskGroupId && groupInfo.get(String(task.taskGroupId)) && (
                                      <span
                                        className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/50"
                                        title="חלק מהקצאה למספר אנשים"
                                      >
                                        {groupInfo.get(String(task.taskGroupId)).completed}/{groupInfo.get(String(task.taskGroupId)).total} בקבוצה
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3">
                                <InstructionStatusBadge status={task.status} />
                              </td>
                            </tr>
                          );
                        })}
                        {expanded && childTasks.length === 0 && (
                          <tr className="border-b border-slate-100 bg-slate-50/30 dark:border-slate-800 dark:bg-slate-900/20">
                            <td colSpan={7 + customCols.length} className="py-6 text-center text-[12.5px] text-slate-400">
                              אין הנחיות בפרויקט זה {search.trim() || filterStatus !== 'all' ? 'לפי הסינון' : ''}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {filteredProjects.length === 0 && (
                    <tr>
                      <td colSpan={7 + customCols.length} className="py-16 text-center text-[14px] text-slate-400">
                        אין פרויקטים בסביבה {search.trim() ? 'לפי החיפוש' : ''}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
            {filteredProjects.map((project) => {
              const pid = String(project._id);
              const expanded = expandedProjectIds.has(pid);
              const isActive = String(activeProjectId) === pid;
              const stats = projectStats[pid] || { total: 0, completed: 0, progressPct: 0, peopleCount: 0 };
              const childTasks = expanded ? tasksForProject(pid) : [];
              return (
                <div key={pid} className="space-y-3">
                  <ProjectCardHeader
                    project={project}
                    stats={stats}
                    expanded={expanded}
                    active={isActive}
                    onToggle={() => toggleProject(pid)}
                  />
                  {expanded && (
                    <div
                      className={clsx(
                        'grid gap-3 pr-3',
                        openTask ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
                      )}
                    >
                      {childTasks.map(task => {
                        const active = openTask?._id === task._id;
                        return (
                          <button
                            key={task._id}
                            type="button"
                            onClick={() => setOpenTask(task)}
                            className={clsx(
                              'rounded-2xl border p-5 text-right shadow-sm transition-all hover:shadow-md',
                              active
                                ? 'border-[var(--institutional)] bg-[var(--institutional-light)]/50 ring-2 ring-[var(--institutional)]/25 dark:bg-amber-950/20'
                                : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-slate-600',
                            )}
                          >
                            <div className="mb-3 flex items-start justify-between gap-2">
                              <span className="font-mono text-[11px] text-slate-400">#{task.taskNumber}</span>
                              <InstructionStatusBadge status={task.status} />
                            </div>
                            <h3 className="text-[16px] font-bold leading-snug text-slate-900 dark:text-slate-50">{task.title}</h3>
                            {task.description && (
                              <p
                                className={clsx(
                                  'mt-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400',
                                  openTask ? 'line-clamp-4' : 'line-clamp-2',
                                )}
                              >
                                {task.description}
                              </p>
                            )}
                            <div className="mt-4 border-t border-slate-100 pt-3 text-[12px] dark:border-slate-700">
                              <p
                                className={clsx(
                                  'font-medium leading-snug text-slate-600 dark:text-slate-300',
                                  openTask ? 'line-clamp-3' : 'line-clamp-2',
                                )}
                                title={teamAssignmentLabel(task)}
                              >
                                {teamAssignmentLabel(task)}
                              </p>
                              {task.assignedTo?.name && (
                                <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                  <Users className="h-3 w-3" />
                                  <span className="truncate">{task.assignedTo.name}</span>
                                  {task.taskGroupId && groupInfo.get(String(task.taskGroupId)) && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/50">
                                      {groupInfo.get(String(task.taskGroupId)).completed}/{groupInfo.get(String(task.taskGroupId)).total} בקבוצה
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="mt-2 flex justify-end">
                                <DueUrgency dueDate={task.dueDate} status={task.status} />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                      {childTasks.length === 0 && (
                        <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 py-8 text-center text-[13px] text-slate-400 dark:border-slate-700 dark:bg-slate-900/20">
                          אין הנחיות בפרויקט זה {search.trim() || filterStatus !== 'all' ? 'לפי הסינון' : ''}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredProjects.length === 0 && (
              <div className="py-16 text-center text-slate-400">אין פרויקטים בסביבה {search.trim() ? 'לפי החיפוש' : ''}</div>
            )}
          </div>
        )}
        </div>
      </section>

      {/* פאנל פרטי הנחיה */}
      {openTask && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:min-w-0 lg:flex-[1.15] lg:basis-0">
          <AdminTaskPanel
            task={openTask}
            template={template}
            currentUser={user}
            onClose={() => setOpenTask(null)}
            onRefresh={refreshOpen}
            onEdit={() => setShowEdit(true)}
          />
        </div>
      )}

      {showForm && selectedEnv && activeProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-[3px]"
          onClick={() => setShowForm(false)}
        >
          <TaskInstructionModalShell
            onClose={() => setShowForm(false)}
            heading="הנחיה חדשה"
            actionLabel="הוסף הנחיה"
            actionFormId="task-form-create"
          >
            <TaskForm
              formId="task-form-create"
              showFooterActions={false}
              users={users}
              template={template}
              project={activeProject}
              onSubmit={async ({ pendingFiles, ...data }) => {
                try {
                  const res = await api.post('/tasks', { ...data, projectId: activeProject._id });
                  // קביעה האם נוצרו מספר הנחיות (fan-out למספר אנשים) או אחת
                  const createdTasks = Array.isArray(res.data?.tasks) ? res.data.tasks : [res.data];
                  if (pendingFiles?.length && createdTasks.length) {
                    // מעלים פעם אחת — השרת מסנכרן את המטא-דאטה לאחיות בקבוצה
                    const fd = new FormData();
                    pendingFiles.forEach(f => fd.append('files', f));
                    await api.post(`/tasks/${createdTasks[0]._id}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                  }
                  await load();
                  setShowForm(false);
                } catch (err) {
                  setFormAlert({
                    title: 'לא ניתן ליצור הנחיה',
                    message: err.response?.data?.message || 'שגיאה',
                  });
                }
              }}
            />
          </TaskInstructionModalShell>
        </div>
      )}

      {showEdit && openTask && selectedEnv && (() => {
        const editProject = openTask.projectId && typeof openTask.projectId === 'object'
          ? openTask.projectId
          : (projects.find(p => String(p._id) === String(openTask.projectId)) || activeProject);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-[3px]"
            onClick={() => setShowEdit(false)}
          >
            <TaskInstructionModalShell
              onClose={() => setShowEdit(false)}
              heading={`הנחיה ${openTask.taskNumber}`}
              actionLabel="עדכן הנחיה"
              actionFormId="task-form-edit"
            >
              <TaskForm
                formId="task-form-edit"
                showFooterActions={false}
                key={openTask._id}
                users={users}
                template={template}
                project={editProject}
                initialTask={openTask}
                onSubmit={async ({ pendingFiles, ...data }) => {
                  try {
                    await api.put(`/tasks/${openTask._id}`, data);
                    if (pendingFiles?.length) {
                      const fd = new FormData();
                      pendingFiles.forEach(f => fd.append('files', f));
                      await api.post(`/tasks/${openTask._id}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                    }
                    await load();
                    await refreshOpen();
                    setShowEdit(false);
                  } catch (err) {
                    setFormAlert({
                      title: 'לא ניתן לעדכן',
                      message: err.response?.data?.message || 'שגיאה',
                    });
                  }
                }}
              />
            </TaskInstructionModalShell>
          </div>
        );
      })()}

      {showAddProject && selectedEnv && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-[3px]"
          onClick={() => !submittingProject && setShowAddProject(false)}
        >
          <TaskInstructionModalShell
            onClose={() => !submittingProject && setShowAddProject(false)}
            heading="פרויקט חדש"
            actionLabel={submittingProject ? 'יוצר…' : 'צור פרויקט'}
            actionFormId="project-form-create"
          >
            <ProjectForm
              formId="project-form-create"
              showFooterActions={false}
              onSubmit={handleCreateProject}
            />
          </TaskInstructionModalShell>
        </div>
      )}

      {showStats && activeProject && (
        <ProjectStatsPanel
          projectId={activeProject._id}
          onClose={() => setShowStats(false)}
        />
      )}

      <AlertModal
        open={!!formAlert}
        title={formAlert?.title || ''}
        message={formAlert?.message}
        variant="error"
        onClose={() => setFormAlert(null)}
      />
    </div>
  );
}

const advInputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 shadow-inner placeholder:text-slate-400 focus:border-[#c47f17] focus:outline-none focus:ring-2 focus:ring-[#c47f17]/25 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500';

const advSelectCls = advInputCls + ' appearance-none cursor-pointer pl-3';

function FilterField({ label, hint, children }) {
  return (
    <div className="min-w-0">
      <label className="mb-1 block text-[11.5px] font-semibold text-slate-600 dark:text-slate-300">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[10.5px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

function FilterChip({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition',
        active
          ? 'border-[#c47f17] bg-[#c47f17] text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-600 hover:border-[#c47f17]/40 hover:bg-amber-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-amber-950/30',
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

function ProjectProgressBadge({ pct, completed, total }) {
  const tone = total === 0
    ? 'neutral'
    : pct === 100
      ? 'success'
      : pct >= 50
        ? 'progress'
        : pct >= 1
          ? 'early'
          : 'neutral';
  const styles = {
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/50',
    progress: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50',
    early: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/50',
    neutral: 'bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  };
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold ring-1', styles[tone])}>
      <span>{pct}%</span>
      <span className="text-[10px] opacity-70">({completed}/{total})</span>
    </span>
  );
}

function ProjectTableRow({ project, stats, expanded, active, onToggle, customColCount }) {
  return (
    <tr
      onClick={onToggle}
      className={clsx(
        'group cursor-pointer border-b border-amber-200/40 transition-colors dark:border-amber-900/30',
        active
          ? 'bg-gradient-to-l from-amber-100/70 via-amber-50/50 to-amber-50/20 hover:from-amber-100/80 dark:from-amber-950/40 dark:via-amber-950/25 dark:to-amber-950/10'
          : 'bg-amber-50/35 hover:bg-amber-50/65 dark:bg-amber-950/15 dark:hover:bg-amber-950/25',
      )}
    >
      <td className="sticky right-0 z-[1] whitespace-nowrap border-l border-amber-200/30 bg-inherit px-3 py-3">
        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
          <ChevronDown
            className={clsx(
              'h-4 w-4 transition-transform duration-200',
              !expanded && '-rotate-90',
            )}
          />
          <span className="font-mono text-[11px] font-bold">P{project.projectNumber ?? '—'}</span>
        </div>
      </td>
      <td className="max-w-[260px] px-3 py-3">
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="truncate text-[14.5px] font-bold text-slate-900 dark:text-slate-50">{project.name}</span>
          {active && (
            <span className="rounded-full bg-amber-600/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
              פעיל
            </span>
          )}
        </div>
      </td>
      <td className="max-w-[200px] px-3 py-3 text-[12px] text-slate-500 dark:text-slate-400">
        <span className="line-clamp-2">{project.description || '—'}</span>
      </td>
      {Array.from({ length: customColCount }).map((_, i) => (
        <td key={i} className="px-3 py-3 text-center text-[11px] text-slate-300 dark:text-slate-600">·</td>
      ))}
      <td className="whitespace-nowrap px-3 py-3 text-[13px] font-medium text-slate-700 dark:text-slate-200">
        {fmt(project.givenDate)}
      </td>
      <td className="px-3 py-3 text-[12px] text-slate-700 dark:text-slate-200">
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-slate-400" />
          <span>{stats?.peopleCount || 0} אנשים</span>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        <ProjectProgressBadge
          pct={stats?.progressPct ?? 0}
          completed={stats?.completed ?? 0}
          total={stats?.total ?? 0}
        />
      </td>
    </tr>
  );
}

function ProjectCardHeader({ project, stats, expanded, active, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={clsx(
        'flex w-full items-center gap-3 rounded-2xl border-2 p-5 text-right shadow-sm transition-all hover:shadow-md',
        active
          ? 'border-amber-300/80 bg-gradient-to-l from-amber-100/55 via-amber-50/60 to-white dark:border-amber-700/60 dark:from-amber-950/30 dark:via-amber-950/20 dark:to-slate-900/40'
          : 'border-amber-100/80 bg-amber-50/40 hover:border-amber-200 hover:bg-amber-50/70 dark:border-amber-900/30 dark:bg-amber-950/15 dark:hover:border-amber-800/50 dark:hover:bg-amber-950/25',
      )}
    >
      <ChevronDown
        className={clsx(
          'h-5 w-5 shrink-0 text-amber-600 transition-transform duration-200 dark:text-amber-400',
          !expanded && '-rotate-90',
        )}
      />
      <Folder className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-amber-700/80 dark:text-amber-300/70">P{project.projectNumber ?? '—'}</span>
          <span className="text-[16px] font-bold leading-tight text-slate-900 dark:text-slate-50">{project.name}</span>
          {active && (
            <span className="rounded-full bg-amber-600/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
              פעיל
            </span>
          )}
        </div>
        {project.description && (
          <p className="mt-1 line-clamp-1 text-[12.5px] text-slate-500 dark:text-slate-400">{project.description}</p>
        )}
      </div>
      <div className="hidden flex-wrap items-center gap-4 text-[12px] sm:flex">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">תאריך מתן</div>
          <div className="font-semibold text-slate-700 dark:text-slate-200">{fmt(project.givenDate)}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">אנשים</div>
          <div className="font-semibold text-slate-700 dark:text-slate-200">{stats?.peopleCount || 0}</div>
        </div>
        <ProjectProgressBadge
          pct={stats?.progressPct ?? 0}
          completed={stats?.completed ?? 0}
          total={stats?.total ?? 0}
        />
      </div>
    </button>
  );
}

function fileIcon(mime) {
  if (!mime) return File;
  if (mime.startsWith('image/')) return Image;
  if (mime.includes('pdf') || mime.includes('text')) return FileText;
  return File;
}
function fmtBytes(b) {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function TaskAttachments({ taskId, attachments = [], onRefresh, canDelete }) {
  const [deleting, setDeleting] = useState(null);

  if (!attachments.length) return null;

  const handleDelete = async (filename) => {
    setDeleting(filename);
    try {
      await api.delete(`/tasks/${taskId}/attachments/${filename}`);
      await onRefresh();
    } catch {}
    finally { setDeleting(null); }
  };

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        <Paperclip className="h-4 w-4 text-[#c47f17]" />
        קבצים מצורפים
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          {attachments.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {attachments.map(a => {
          const Icon = fileIcon(a.mimeType);
          return (
            <div
              key={a.filename}
              className="group flex items-center gap-2.5 rounded-xl border border-amber-100/80 bg-gradient-to-l from-amber-50/40 to-white px-3 py-2.5 shadow-sm dark:border-amber-900/30 dark:from-amber-950/20 dark:to-slate-900/40"
            >
              <Icon className="h-4 w-4 shrink-0 text-amber-500" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {a.originalName}
              </span>
              <span className="shrink-0 text-[11px] text-slate-400">{fmtBytes(a.size)}</span>
              <a
                href={`/uploads/attachments/${a.filename}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                title="הורד"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleDelete(a.filename)}
                  disabled={deleting === a.filename}
                  className="shrink-0 rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 disabled:opacity-40 dark:hover:bg-red-950/30"
                  title="מחק קובץ"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminTaskPanel({ task, template, currentUser, onClose, onRefresh, onEdit }) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const { unread: chatUnread, reset: resetChatUnread } = useTaskChatUnread(task._id);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const act = async (fn, successMsg) => {
    setLoading(true);
    try {
      await fn();
      await onRefresh();
      showToast(successMsg);
    } catch (err) {
      showToast(err.response?.data?.message || 'שגיאה', 'error');
    } finally {
      setLoading(false);
    }
  };

  const approve = () => act(() => api.post(`/tasks/${task._id}/approve`), 'ההנחיה אושרה');
  const reject = () => {
    if (!rejectNote.trim()) return;
    act(async () => {
      await api.post(`/tasks/${task._id}/reject`, { note: rejectNote });
      setShowReject(false);
      setRejectNote('');
    }, 'ההנחיה נדחתה');
  };
  const remind = () => act(() => api.post(`/tasks/${task._id}/reminder`), 'תזכורת נרשמה');
  const del = async () => {
    const ok = await confirm({
      title: 'למחוק את ההנחיה?',
      message: 'ההנחיה תוסר מהמערכת לצמיתות. לא ניתן לשחזר את הפעולה.',
      confirmLabel: 'מחק',
      cancelLabel: 'ביטול',
      variant: 'danger',
    });
    if (!ok) return;
    setLoading(true);
    try {
      await api.delete(`/tasks/${task._id}`);
      await onRefresh();
      showToast('ההנחיה נמחקה');
      onClose();
    } catch (err) {
      showToast(err.response?.data?.message || 'שגיאה', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isWaiting = task.status === 'waiting_approval';
  const isRejected = task.status === 'rejected';

  const headerActions = (
    <div className="flex items-center gap-1.5 rounded-2xl border border-white/15 bg-black/15 p-1.5 backdrop-blur-sm sm:gap-2">
      <button
        type="button"
        onClick={() => { setShowChat(c => !c); if (!showChat) resetChatUnread(); }}
        className={clsx(
          'relative inline-flex items-center justify-center rounded-xl border p-2 text-white shadow-sm backdrop-blur-sm transition',
          showChat
            ? 'border-[#c47f17]/80 bg-[#c47f17]/30'
            : 'border-white/25 bg-white/12 hover:border-white/40 hover:bg-white/20',
        )}
        aria-label="צ׳אט"
        title="צ׳אט"
      >
        <MessageSquare className="h-4 w-4 shrink-0" />
        {chatUnread > 0 && !showChat && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {chatUnread > 9 ? '9+' : chatUnread}
          </span>
        )}
      </button>
      <span className="mx-0.5 h-6 w-px shrink-0 bg-white/30" aria-hidden="true" />
      <button
        type="button"
        onClick={onEdit}
        disabled={loading}
        aria-label="ערוך הנחיה"
        title="ערוך"
        className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/12 p-2 text-white shadow-sm backdrop-blur-sm transition hover:border-white/40 hover:bg-white/20 disabled:opacity-40"
      >
        <Pencil className="h-4 w-4 shrink-0" />
      </button>
      {task.dueDate && !['completed'].includes(task.status) && (
        <button
          type="button"
          onClick={remind}
          disabled={loading}
          title="תזכורת"
          className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 p-2 text-white shadow-sm backdrop-blur-sm transition hover:border-white/35 hover:bg-white/18 disabled:opacity-40"
        >
          <Bell className="h-4 w-4 shrink-0" />
        </button>
      )}
      <button
        type="button"
        onClick={del}
        disabled={loading}
        title="מחק"
        className="inline-flex items-center justify-center rounded-xl border border-red-400/40 bg-red-500/20 p-2 text-red-100 transition hover:border-red-300/60 hover:bg-red-500/30 disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4 shrink-0" />
      </button>
    </div>
  );

  const dueChatBadge = task.dueDate ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/12 px-3 py-1 text-[12px] font-bold text-white shadow-sm">
      <span>תג״ב:</span>
      <span>{fmt(task.dueDate)}</span>
    </span>
  ) : null;

  return (
    <>
      {ConfirmDialog}
      <PanelChrome className="relative flex h-full min-h-0 flex-1 flex-col">
      <InstructionPanelHeader
        tone={isRejected ? 'danger' : 'brand'}
        onClose={() => { if (showChat) { setShowChat(false); resetChatUnread(); } else { onClose(); } }}
        number={task.taskNumber}
        numberClassName={task.status === 'overdue' ? 'border-red-300/70 bg-red-500/25 text-red-100' : undefined}
        badge={<InstructionStatusBadge status={task.status} size="lg" onDark />}
        title={task.title}
        actions={headerActions}
        secondaryActions={dueChatBadge}
      />

      {showChat ? (
        <TaskChat taskId={task._id} dueDate={task.dueDate} status={task.status} showDuePill={false} />
      ) : (
      <InstructionPanelBody>
        <InstructionProse>{task.description}</InstructionProse>

        <CustomFieldsSection task={task} template={template} />

        <div className="grid gap-3 sm:grid-cols-2">
          <MetaTile icon={Calendar} label="תג״ב">
            {fmt(task.dueDate)}
          </MetaTile>
          <MetaTile icon={Clock} label="תאריך מתן">
            {fmt(task.givenDate)}
            <div className="mt-2 text-[13px] font-normal">
              <DueUrgency dueDate={task.dueDate} status={task.status} />
            </div>
          </MetaTile>
          <MetaTile icon={Shield} className="sm:col-span-2" label="נוצר ע״י">
            {task.createdBy?.name || currentUser?.name || '—'}
          </MetaTile>
        </div>

        <TaskAttachments taskId={task._id} attachments={task.attachments} onRefresh={onRefresh} canDelete />

        <LevelsTrack task={task} />

        {task.lastReminderAt && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-l from-amber-50/90 to-white p-4 dark:border-amber-800/50 dark:from-amber-950/30 dark:to-slate-900/40">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/50">
              <Bell className="h-5 w-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-[12px] font-bold text-amber-900 dark:text-amber-200">תזכורת אחרונה</p>
              <p className="mt-1 text-[14px] text-amber-800/90 dark:text-amber-100/90">{fmtFull(task.lastReminderAt)}</p>
            </div>
          </div>
        )}

        {task.submissionNote && (
          <div className="rounded-2xl border border-blue-200/60 bg-gradient-to-br from-blue-50/80 to-white p-5 dark:border-blue-900/40 dark:from-blue-950/25 dark:to-slate-900/50">
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-blue-800 dark:text-blue-200">הערה מהצוות בהגשה</p>
            <p className="text-[15px] leading-relaxed text-blue-950 dark:text-blue-100">{task.submissionNote}</p>
            {task.submittedAt && <p className="mt-2 text-[11px] text-blue-500">{fmtFull(task.submittedAt)}</p>}
          </div>
        )}

        {isRejected && task.rejectionNote && (
          <div className="rounded-2xl border-2 border-red-300/80 bg-gradient-to-br from-red-50 to-white p-5 dark:border-red-800 dark:from-red-950/40 dark:to-slate-950/50">
            <div className="mb-2 flex items-center gap-2 font-bold text-red-800 dark:text-red-200">
              <AlertCircle className="h-5 w-5 shrink-0" />
              סיבת סירוב
            </div>
            <p className="text-[15px] leading-relaxed text-red-950 dark:text-red-50">{task.rejectionNote}</p>
          </div>
        )}

        {showReject && (
          <div className="space-y-3 rounded-2xl border-2 border-red-200 bg-red-50/60 p-5 dark:border-red-900 dark:bg-red-950/25">
            <p className="text-[14px] font-bold text-red-800 dark:text-red-200">נדרשת סיבה לסירוב</p>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              rows={3}
              placeholder="מה צריך לתקן בצד הצוות…"
              className="w-full resize-none rounded-xl border border-red-200 bg-white px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-red-300 dark:border-red-800 dark:bg-slate-900 dark:text-slate-100"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowReject(false);
                  setRejectNote('');
                }}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[14px] font-medium text-slate-600 dark:border-slate-600"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={reject}
                disabled={!rejectNote.trim() || loading}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-[14px] font-bold text-white shadow-sm disabled:opacity-40"
              >
                אשר דחייה
              </button>
            </div>
          </div>
        )}

        <HistoryTimeline history={task.history} />
      </InstructionPanelBody>
      )}

      {!showReject && !showChat && isWaiting && (
        <InstructionPanelFooter>
          <div className="mx-auto flex w-full max-w-[640px] flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={approve}
              disabled={loading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-[14px] font-bold text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-40 sm:flex-initial"
            >
              <Check className="h-4 w-4" />
              אשר הגשה
            </button>
            <button
              type="button"
              onClick={() => setShowReject(true)}
              disabled={loading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-[14px] font-bold text-red-600 shadow-sm transition hover:bg-red-50 dark:border-red-900 dark:bg-slate-900 dark:hover:bg-red-950/30 sm:flex-initial"
            >
              <X className="h-4 w-4" />
              דחה
            </button>
          </div>
        </InstructionPanelFooter>
      )}

      {toast && (
        <div
          className={clsx(
            'pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-2xl px-6 py-3 text-[14px] font-semibold text-white shadow-xl',
            toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-600',
          )}
        >
          {toast.msg}
        </div>
      )}
    </PanelChrome>
    </>
  );
}
