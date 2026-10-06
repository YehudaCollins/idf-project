import { ChevronLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

const chipColors = [
  'bg-slate-800 text-white ring-slate-700',
  'bg-emerald-700 text-white ring-emerald-600',
  'bg-teal-600 text-white ring-teal-500',
  'bg-sky-600 text-white ring-sky-500',
  'bg-cyan-700 text-white ring-cyan-600',
  'bg-blue-700 text-white ring-blue-600',
  'bg-slate-600 text-white ring-slate-500',
];

export function PathBreadcrumb({
  segments,
  className,
}: {
  segments: string[];
  className?: string;
}) {
  if (!segments.length) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)} dir="rtl">
      {segments.map((seg, i) => (
        <span key={`${seg}-${i}`} className="inline-flex items-center">
          <span
            className={cn(
              'rounded-lg px-2.5 py-1 text-[11px] font-bold ring-1 shadow-sm',
              chipColors[Math.min(i, chipColors.length - 1)]
            )}
          >
            {seg}
          </span>
          {i < segments.length - 1 && (
            <ChevronLeft className="mx-0.5 h-3.5 w-3.5 rotate-180 text-slate-300" aria-hidden />
          )}
        </span>
      ))}
    </div>
  );
}
