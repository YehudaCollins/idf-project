import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  title,
  description,
  action,
  icon: Icon,
}: {
  className?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-5 border-b border-slate-200 bg-slate-50 px-6 py-5', className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h2 className="text-[18px] font-semibold text-slate-950">{title}</h2>
          {description && (
            <p className="mt-1.5 text-[15px] leading-relaxed text-slate-500">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-6 py-5', className)}>{children}</div>;
}
