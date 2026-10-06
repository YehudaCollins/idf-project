import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../api/axios';
import { StatsCards } from '../components/dashboard/StatsCards';
import { StatusPieCharts } from '../components/dashboard/StatusPieCharts';
import { MonthlyChart } from '../components/dashboard/MonthlyChart';
import { TasksByRoleChart } from '../components/dashboard/TasksByRoleChart';

function getStats(tasks) {
  return {
    total: tasks.length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    waiting_approval: tasks.filter(t => t.status === 'waiting_approval').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => t.status === 'overdue').length,
    pending: tasks.filter(t => t.status === 'pending').length,
  };
}

function getTasksByRole(tasks) {
  const byRole = {};
  tasks.forEach(t => {
    const label = t.assignedTo?.jobTitle || t.assignedTo?.name || t.targetRole;
    if (label) byRole[label] = (byRole[label] || 0) + 1;
  });
  return Object.entries(byRole).map(([role, count]) => ({ role, count }));
}

function buildMonthlySeries(tasks) {
  const HE = ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'];
  const buckets = {};
  tasks.forEach(t => {
    const raw = t.givenDate || t.createdAt;
    if (!raw) return;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`;
    if (!buckets[key]) buckets[key] = { y: d.getFullYear(), m: d.getMonth(), inProgress: 0, overdue: 0 };
    if (t.status === 'overdue') buckets[key].overdue++;
    else if (['pending','in_progress','waiting_approval'].includes(t.status)) buckets[key].inProgress++;
  });
  return Object.values(buckets)
    .sort((a,b) => (a.y*12+a.m)-(b.y*12+b.m))
    .map(b => ({ month: `${HE[b.m]} ${String(b.y).slice(-2)}`, inProgress: b.inProgress, overdue: b.overdue }));
}

export default function DashboardPage({ selectedEnv }) {
  const [tasks, setTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editEnv, setEditEnv] = useState(null);

  const fetchTasks = useCallback(async () => {
    if (!selectedEnv) return;
    try { const res = await api.get(`/tasks?environmentId=${selectedEnv._id}`); setTasks(res.data); } catch {}
  }, [selectedEnv]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const stats = getStats(tasks);
  const tasksByRole = getTasksByRole(tasks);
  const monthlyData = buildMonthlySeries(tasks);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[28px] font-bold text-slate-900 dark:text-slate-100 leading-tight">דשבורד הנחיות</h1>
        <p className="text-[14px] text-slate-500 dark:text-slate-400 mt-0.5">סקירה כללית של משימות וסטטוסים</p>
      </div>

      {!selectedEnv ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <BarChart3Icon />
          </div>
          <h3 className="text-[16px] font-semibold text-slate-700 dark:text-slate-300 mb-1">בחר סביבה מהתפריט</h3>
          <p className="text-sm text-slate-400 dark:text-slate-500 max-w-[260px]">הנתונים יוצגו לפי הסביבה שנבחרה בתפריט הצדדי</p>
        </div>
      ) : (
        <>
          <StatsCards stats={stats} />
          <div className="grid grid-cols-3 gap-5">
            <StatusPieCharts stats={stats} />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <MonthlyChart data={monthlyData} />
            <TasksByRoleChart data={tasksByRole} total={tasksByRole.reduce((s,d)=>s+d.count,0)} />
          </div>
        </>
      )}
    </div>
  );
}

function BarChart3Icon() {
  return (
    <svg className="h-7 w-7 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
