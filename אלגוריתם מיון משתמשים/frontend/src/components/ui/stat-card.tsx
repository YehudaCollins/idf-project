import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export function StatCard({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={cn('panel p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-medium text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
