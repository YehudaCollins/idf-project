import { cn } from '../../lib/utils';

export function ConfidenceBar({
  value,
  className,
  showLabel = true,
  size = 'md',
}: {
  value: number;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}) {
  const pct = Math.round(value * 100);

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className={cn('flex-1 overflow-hidden rounded-full bg-surface-2', size === 'sm' ? 'h-1.5' : 'h-2')}>
        <div
          className="h-full rounded-full bg-brand transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <span className="w-9 text-xs font-medium tabular-nums text-muted">{pct}%</span>}
    </div>
  );
}
