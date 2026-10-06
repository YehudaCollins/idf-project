import type { InputHTMLAttributes } from 'react';
import { Search } from 'lucide-react';
import { Input } from './input';
import { cn } from '../../lib/utils';

export function SearchBar({
  className,
  containerClassName,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { containerClassName?: string }) {
  return (
    <div className={cn('relative', containerClassName)}>
      <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input className={cn('pr-11 shadow-sm', className)} {...props} />
    </div>
  );
}
