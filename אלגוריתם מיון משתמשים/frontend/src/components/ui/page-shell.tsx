import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export function PageShell({
  title,
  description,
  actions,
  children,
  className,
  badge,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  badge?: string;
}) {
  return (
    <div className={cn('mx-auto max-w-6xl', className)}>
      <header className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {badge && (
              <span className="mb-2 inline-block rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {badge}
              </span>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            {description && (
              <p className="mt-1.5 max-w-2xl text-[14px] text-slate-500">{description}</p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </header>
      {children}
    </div>
  );
}

export function LoadingScreen({ message = 'טוען...' }: { message?: string }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-accent" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>
  );
}

export function EmptyPlaceholder({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      <h3 className="font-semibold text-slate-800">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] text-slate-500">{description}</p>
    </div>
  );
}
