import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Eye, LogOut } from 'lucide-react';
import clsx from 'clsx';
import api from '../api/axios';

const STATUS_CONFIG = {
  pending:   { label: 'ממתין לביצוע',     dot: 'bg-gray-400',  pill: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'הוגש — ממתין לאישור', dot: 'bg-cyan-500', pill: 'bg-cyan-100 text-cyan-700' },
  approved:  { label: 'אושר',             dot: 'bg-teal-500',  pill: 'bg-teal-100 text-teal-700' },
  rejected:  { label: 'נדחה',             dot: 'bg-red-500',   pill: 'bg-red-100 text-red-700' },
};

function StatusDot({ status }) {
  return <span className={clsx('w-2.5 h-2.5 rounded-full inline-block flex-shrink-0', STATUS_CONFIG[status]?.dot || 'bg-gray-300')} />;
}

function getWeekNumber(date) {
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.ceil((date - start) / 604800000);
}

export default function CommanderPage() {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const week = getWeekNumber(new Date());

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/tasks/mine');
      setTasks(res.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleSubmit = async (taskId, note) => {
    await api.post(`/tasks/${taskId}/submit`, { note });
    fetchTasks();
    setSelectedTask(null);
  };

  const pending = tasks.filter(t => t.status === 'pending').length;
  const submitted = tasks.filter(t => t.status === 'submitted').length;
  const approved = tasks.filter(t => t.status === 'approved').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-white/80 backdrop-blur-sm border-b border-gray-200 px-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center shadow-sm">
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 2a10 10 0 0 1 0 20" /><path d="M2 12h20" />
            </svg>
          </div>
          <div>
            <span className="font-bold text-gray-900">MISSIONS 360</span>
            <span className="text-xs text-gray-400 mr-2">מערכת ניהול משימות</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-gradient-to-l from-teal-50 to-cyan-50 px-4 py-2 rounded-full">
            <span className="font-semibold text-teal-700 text-sm">{user?.name}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <span className="text-sm">שבוע</span>
            <span className="text-lg font-bold text-gray-800">{week}</span>
          </div>
          <button onClick={logout} className="flex items-center gap-1.5 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'ממתינות', value: pending, color: 'from-gray-50 to-gray-100', text: 'text-gray-700' },
            { label: 'הוגשו', value: submitted, color: 'from-cyan-50 to-cyan-100', text: 'text-cyan-700' },
            { label: 'אושרו', value: approved, color: 'from-teal-50 to-teal-100', text: 'text-teal-700' },
          ].map(({ label, value, color, text }) => (
            <div key={label} className={`bg-gradient-to-br ${color} rounded-xl p-5 border border-gray-200`}>
              <div className={`text-3xl font-bold ${text}`}>{value}</div>
              <div className="text-sm text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Tasks */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800">מאגר משימות</h1>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">טוען...</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2.5 text-right font-medium text-gray-600 w-10">#</th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-600">נושא</th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-600">סביבה</th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-600">סטטוס</th>
                  <th className="px-3 py-2.5 text-center font-medium text-gray-600 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task, idx) => (
                  <tr key={task._id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-3 py-2.5 font-medium text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-gray-800">{task.title}</div>
                      {task.description && <div className="text-xs text-gray-400 truncate max-w-xs">{task.description}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{task.environmentId?.name || '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <StatusDot status={task.status} />
                        <span className="text-gray-600">{STATUS_CONFIG[task.status]?.label}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button onClick={() => setSelectedTask(task)} className="p-1 text-gray-400 hover:text-teal-600 rounded">
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-12 text-center text-gray-400">אין משימות מוקצות עדיין</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSubmit={(note) => handleSubmit(selectedTask._id, note)}
        />
      )}
    </div>
  );
}

function TaskModal({ task, onClose, onSubmit }) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const cfg = STATUS_CONFIG[task.status];

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit(note);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">פרטי משימה</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between">
            <h2 className="font-bold text-gray-900 text-lg flex-1">{task.title}</h2>
            <span className={clsx('mr-3 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0', cfg?.pill)}>{cfg?.label}</span>
          </div>
          {task.description && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{task.description}</div>
          )}
          {task.submissionNote && (
            <div>
              <div className="text-xs text-gray-400 mb-1">הערה שנשלחה</div>
              <div className="text-sm text-gray-600 bg-cyan-50 rounded-lg p-3 border border-cyan-100">{task.submissionNote}</div>
            </div>
          )}

          {task.status === 'pending' && !showSubmitForm && (
            <button
              onClick={() => setShowSubmitForm(true)}
              className="w-full py-2.5 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              📤 דווח על סיום
            </button>
          )}

          {task.status === 'pending' && showSubmitForm && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">הערה (אופציונלי)</label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  placeholder="הוסף הערה להגשה..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowSubmitForm(false)} className="flex-1 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">ביטול</button>
                <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-2 text-sm text-white bg-teal-500 rounded-lg hover:bg-teal-600 font-medium disabled:opacity-50">
                  {submitting ? 'שולח...' : 'שלח דיווח'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
