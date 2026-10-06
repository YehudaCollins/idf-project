import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-[15px] text-slate-950 shadow-sm',
        'placeholder:text-slate-400',
        'focus:border-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-700/10',
        'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';
