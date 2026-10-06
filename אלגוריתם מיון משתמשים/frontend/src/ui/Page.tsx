import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export function Page({
  title,
  description,
  actions,
  wide,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  wide?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(wide ? 'u-container-wide' : 'u-container', className)}>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="u-page-title">{title}</h1>
          {description && <p className="u-page-desc">{description}</p>}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}

export function Spinner({ label = 'טוען...' }: { label?: string }) {
  return (
    <div className="u-empty">
      <div className="u-spinner" />
      <p className="mt-3 text-[13px]">{label}</p>
    </div>
  );
}

export function Alert({ children, tone = 'bad' }: { children: ReactNode; tone?: 'bad' | 'warn' }) {
  return (
    <div
      className={cn(
        'rounded-md border px-4 py-3 text-[13px]',
        tone === 'bad' && 'border-red-200 bg-red-50 text-bad',
        tone === 'warn' && 'border-amber-200 bg-amber-50 text-warn'
      )}
    >
      {children}
    </div>
  );
}
