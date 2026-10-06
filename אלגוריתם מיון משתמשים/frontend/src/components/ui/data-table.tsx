import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function DataTable({
  children,
  className,
  stickyHeader,
}: {
  children: ReactNode;
  className?: string;
  stickyHeader?: boolean;
}) {
  return (
    <div className={cn('overflow-x-auto', stickyHeader && 'max-h-[420px] overflow-y-auto', className)}>
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  );
}

export function DataTableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-slate-200/80 bg-slate-50/95 [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-slate-50/95 [&>th]:backdrop-blur-sm">
        {children}
      </tr>
    </thead>
  );
}

export function DataTableHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        'px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400 first:rounded-tr-lg last:rounded-tl-lg',
        className
      )}
    >
      {children}
    </th>
  );
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function DataTableRow({
  children,
  className,
  index,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'transition-colors hover:bg-accent-soft/40',
        index != null && index % 2 === 1 && 'bg-slate-50/40',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </tr>
  );
}

export function DataTableCell({
  children,
  className,
  mono,
}: {
  children: ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <td
      className={cn(
        'px-5 py-3.5 text-slate-700',
        mono && 'font-mono text-[12px] tabular-nums',
        className
      )}
    >
      {children}
    </td>
  );
}
