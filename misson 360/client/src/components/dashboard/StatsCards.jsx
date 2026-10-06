import { Clock, AlertTriangle, CheckCircle2, Hourglass, TrendingUp } from 'lucide-react';
import clsx from 'clsx';

const colorClasses = {
  teal:  { bg: 'bg-gradient-to-br from-teal-50 to-cyan-50',   icon: 'bg-gradient-to-br from-teal-400 to-cyan-500',   text: 'text-teal-700',  border: 'border-teal-100' },
  amber: { bg: 'bg-gradient-to-br from-amber-50 to-yellow-50',icon: 'bg-gradient-to-br from-amber-400 to-yellow-500', text: 'text-amber-700', border: 'border-amber-100' },
  red:   { bg: 'bg-gradient-to-br from-rose-50 to-red-50',    icon: 'bg-gradient-to-br from-rose-400 to-red-500',     text: 'text-rose-700',  border: 'border-rose-100' },
  blue:  { bg: 'bg-gradient-to-br from-blue-50 to-indigo-50', icon: 'bg-gradient-to-br from-blue-400 to-indigo-500',  text: 'text-blue-700',  border: 'border-blue-100' },
};

function StatCard({ title, value, icon, color, trend }) {
  const c = colorClasses[color];
  return (
    <div className={clsx('rounded-xl border p-5', c.bg, c.border)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className={clsx('text-3xl font-bold', c.text)}>{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
              <TrendingUp className="h-3 w-3" />
              <span>{trend}</span>
            </div>
          )}
        </div>
        <div className={clsx('rounded-xl p-3 shadow-sm text-white', c.icon)}>{icon}</div>
      </div>
    </div>
  );
}

export function StatsCards({ stats }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard title='סה"כ משימות' value={stats.total}            icon={<CheckCircle2 className="h-5 w-5" />} color="teal" />
      <StatCard title="בתהליך"      value={stats.in_progress}      icon={<Clock className="h-5 w-5" />}        color="amber" />
      <StatCard title="בחריגה"      value={stats.overdue}          icon={<AlertTriangle className="h-5 w-5" />} color="red" />
      <StatCard title="ממתין לאישור" value={stats.waiting_approval} icon={<Hourglass className="h-5 w-5" />}   color="blue" />
    </div>
  );
}
