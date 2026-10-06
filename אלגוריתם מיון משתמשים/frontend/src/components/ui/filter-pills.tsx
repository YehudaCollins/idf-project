import { cn } from '../../lib/utils';

export function FilterPills({
  options,
  value,
  onChange,
  className,
}: {
  options: { id: string; label: string; count?: number }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('segmented flex-wrap', className)}>
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn('segmented-item', active && 'segmented-item-active')}
          >
            {opt.label}
            {opt.count != null && (
              <span className="mr-1 font-mono text-[10px] opacity-70">({opt.count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
