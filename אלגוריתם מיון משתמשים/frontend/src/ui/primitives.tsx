import type { ButtonHTMLAttributes, ComponentType, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import { Loader2, Inbox } from 'lucide-react';
import { cn } from '../lib/utils';

const btnVariants = {
  primary: 'bg-brand text-white hover:bg-brand-hover shadow-sm',
  secondary: 'bg-surface border border-border text-foreground hover:bg-surface-2 shadow-sm',
  ghost: 'text-muted hover:bg-surface-2 hover:text-foreground',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof btnVariants;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = {
    sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-lg',
    md: 'h-10 px-4 text-sm gap-2 rounded-lg',
    lg: 'h-11 px-5 text-[15px] gap-2 rounded-lg',
  };
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30',
        'disabled:pointer-events-none disabled:opacity-50',
        btnVariants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-lg border border-border bg-surface px-3.5 text-[15px] text-foreground',
        'placeholder:text-subtle transition-colors focus-ring',
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-[100px] w-full resize-y rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[15px]',
        'placeholder:text-subtle transition-colors focus-ring',
        className
      )}
      {...props}
    />
  );
}

const badgeVariants = {
  default: 'bg-surface-2 text-muted',
  accent: 'bg-brand-soft text-brand-text',
  success: 'bg-success-soft text-success-text',
  warning: 'bg-warning-soft text-warning-text',
  danger: 'bg-danger-soft text-danger-text',
};

export function Badge({
  variant = 'default',
  className,
  children,
}: {
  variant?: keyof typeof badgeVariants;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium', badgeVariants[variant], className)}>
      {children}
    </span>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('card overflow-hidden', className)}>{children}</div>;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-6 py-5', className)}>
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-6 pb-6', className)}>{children}</div>;
}

export function Page({
  title,
  description,
  actions,
  wide,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn('mx-auto w-full', wide ? 'max-w-[1280px]' : 'max-w-5xl')}>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: number | string;
  icon?: ComponentType<{ className?: string }>;
  hint?: string;
}) {
  return (
    <div className="card card-hover p-5">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-subtle">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-3 text-right text-xs font-medium text-subtle first:pr-0 last:pl-0">
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('border-t border-border/60 px-4 py-3.5 first:pr-0 last:pl-0', className)}>{children}</td>;
}

export function Tr({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr className={cn('transition-colors hover:bg-surface-2/60', onClick && 'cursor-pointer', className)} onClick={onClick}>
      {children}
    </tr>
  );
}

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string; count?: number }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150',
            value === item.id
              ? 'bg-surface text-foreground shadow-sm'
              : 'text-muted hover:text-foreground'
          )}
        >
          {item.label}
          {item.count != null && <span className="mr-1 text-xs opacity-60">({item.count})</span>}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ label = 'טוען...' }: { label?: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-brand" />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

export function Empty({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-subtle">
        <Inbox className="h-6 w-6" />
      </div>
      <p className="text-[15px] font-medium text-foreground">{title}</p>
      {description && <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">{description}</p>}
    </div>
  );
}

export function Alert({ children, tone = 'danger' }: { children: ReactNode; tone?: 'danger' | 'warning' }) {
  return (
    <div
      className={cn(
        'rounded-xl px-4 py-3 text-sm',
        tone === 'danger' && 'bg-danger-soft text-danger-text',
        tone === 'warning' && 'bg-warning-soft text-warning-text'
      )}
    >
      {children}
    </div>
  );
}

export function Callout({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    info: 'bg-brand-soft text-foreground',
    success: 'bg-success-soft text-success-text',
    warning: 'bg-warning-soft text-warning-text',
    danger: 'bg-danger-soft text-danger-text',
  };
  return (
    <div className={cn('rounded-xl px-4 py-3 text-sm', tones[tone], className)}>
      {title && <p className="mb-1 font-medium">{title}</p>}
      <div className={tone === 'info' ? 'text-muted' : undefined}>{children}</div>
    </div>
  );
}

export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-[#1e1e2e] p-4 font-mono text-xs leading-relaxed text-[#cdd6f4]">
      {children}
    </pre>
  );
}

export function Panel({ title, description, action, children, className }: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('card', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && <p className="text-sm text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Divider() {
  return <div className="h-px bg-border" />;
}
