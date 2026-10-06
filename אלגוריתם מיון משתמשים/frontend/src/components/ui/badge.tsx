import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const variants = {
  default: 'bg-slate-100/90 text-slate-700 ring-slate-200/80',
  brand: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200/80',
  danger: 'bg-red-50 text-red-800 ring-red-200/80',
  info: 'bg-sky-50 text-sky-800 ring-sky-200/80',
};

export function Badge({
  className,
  variant = 'default',
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof variants }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
