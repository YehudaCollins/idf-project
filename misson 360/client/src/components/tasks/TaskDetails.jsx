import { useState } from 'react';
import { Check, X, Send, Bell, Trash2 } from 'lucide-react';
import clsx from 'clsx';

const STATUS_LABELS = {
  pending: 'ממתין', in_progress: 'בתהליך',
  waiting_approval: 'ממתין לאישור', completed: 'הושלם', overdue: 'בחריגה',
};

const statusColors = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-amber-100 text-amber-700',
  waiting_approval: 'bg-cyan-100 text-cyan-700',
  completed: 'bg-teal-100 text-teal-700',
  overdue: 'bg-red-100 text-red-700',
};

function daysRemaining(dueDate) {
  if (!dueDate) return null;
  return Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
}

function DaysIndicator({ dueDate, status }) {
  if (!dueDate || status === 'completed') return null;
  const days = daysRemaining(dueDate);
  if (days < 0) return (
    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
      <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
      <span className="text-red-700 font-bold">{Math.abs(days)} ימים בחריגה</span>
    </div>
  );
  if (days <= 3) return (
    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="w-3 h-3 rounded-full bg-amber-500" />
      <span className="text-amber-700 font-medium">{days === 0 ? 'מועד אחרון היום!' : `${days} ימים נותרו`}</span>
    </div>
  );
  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
      <div className="w-3 h-3 rounded-full bg-gray-400" />
      <span className="text-gray-600">{days} ימים נותרו</span>
    </div>
  );
}

const fmt = (d) => d ? new Date(d).toLocaleDateString('he-IL') : '—';

export function TaskDetails({ task, isAdmin, currentUserId, onApprove, onReject, onSubmit, onDelete }) {
  const [notes, setNotes] = useState('');
  const isAssignedToMe = task.assignedTo?._id === currentUserId || task.assignedTo === currentUserId;
  const canSubmit = isAssignedToMe && ['pending', 'in_progress'].includes(task.status);
  const canApprove = isAdmin && task.status === 'waiting_approval';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-400">משימה #{task.taskNumber}</span>
        <span className={clsx('px-3 py-1 rounded-full text-xs font-medium', statusColors[task.status])}>
          {STATUS_LABELS[task.status]}
        </span>
      </div>

      <h2 className="text-lg font-bold text-gray-800">{task.title}</h2>

      <DaysIndicator dueDate={task.dueDate} status={task.status} />

      {task.description && (
        <div>
          <div className="text-xs text-gray-400 mb-1">פירוט</div>
          <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{task.description}</p>
        </div>
      )}

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><div className="text-xs text-gray-400">ניתן בתאריך</div><div className="font-medium">{fmt(task.givenDate)}</div></div>
        <div><div className="text-xs text-gray-400">תג"ב</div><div className="font-medium">{fmt(task.dueDate)}</div></div>
        <div className="col-span-2">
          <div className="text-xs text-gray-400">הצוות שאליו שויך</div>
          <div className="font-medium">
            {[task.level1, task.level2, task.level3, task.level4, task.level5].filter(Boolean).join(' / ') || '—'}
            {task.targetRole && (
              <span className="text-gray-500"> · תפקיד רלוונטי: {task.targetRole}</span>
            )}
          </div>
        </div>
      </div>

      {task.submissionNote && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3">
          <div className="text-xs text-cyan-600 mb-1">הערות הגשה</div>
          <p className="text-sm text-cyan-800">{task.submissionNote}</p>
        </div>
      )}

      {/* Submit Form */}
      {canSubmit && (
        <div className="space-y-2 pt-3 border-t border-gray-100">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="הערות להגשה..." rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none" />
          <button onClick={() => onSubmit(notes)} className="w-full flex items-center justify-center gap-2 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition-colors">
            <Send className="h-4 w-4" />
            הגשת המשימה
          </button>
        </div>
      )}

      {/* Approve/Reject */}
      {canApprove && (
        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <button onClick={onApprove} className="flex-1 flex items-center justify-center gap-2 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition-colors">
            <Check className="h-4 w-4" />אישור
          </button>
          <button onClick={onReject} className="flex-1 flex items-center justify-center gap-2 py-2 border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium rounded-lg transition-colors">
            <X className="h-4 w-4" />החזרה
          </button>
        </div>
      )}

      {/* Admin Actions */}
      {isAdmin && (
        <div className="flex justify-between pt-3 border-t border-gray-100 text-sm">
          <button className="text-teal-600 hover:text-teal-700 flex items-center gap-1">
            <Bell className="h-4 w-4" />תזכורת
          </button>
          <button onClick={onDelete} className="text-red-500 hover:text-red-600 flex items-center gap-1">
            <Trash2 className="h-4 w-4" />מחק
          </button>
        </div>
      )}
    </div>
  );
}
