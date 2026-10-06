import type { OrgTreeNode } from '../../api/client';
import { cn } from '../../lib/utils';

export function OrgSearchDropdown({
  hits,
  query,
  onSelect,
  onClose,
}: {
  hits: OrgTreeNode[];
  query: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  if (!query.trim()) return null;

  return (
    <div className="org-search-dropdown absolute right-0 top-full mt-2 max-h-[380px] w-full min-w-[340px] overflow-y-auto rounded-lg border border-border bg-surface py-2 shadow-[var(--shadow-card-hover)]">
      <p className="px-4 py-2 text-[13px] font-semibold text-subtle">
        {hits.length} תוצאות
      </p>
      {hits.length === 0 && (
        <p className="px-4 py-5 text-[15px] font-medium text-muted">לא נמצאו יחידות מתאימות</p>
      )}
      {hits.slice(0, 12).map((n) => (
        <button
          key={n._id}
          type="button"
          onClick={() => { onSelect(n._id); onClose(); }}
          className="flex w-full flex-col gap-1 px-4 py-3 text-right transition-colors hover:bg-surface-2"
        >
          <span className="text-[15px] font-semibold text-foreground">{n.canonicalName}</span>
          <span className="truncate text-[13px] text-muted">{n.pathText}</span>
        </button>
      ))}
      {hits.length > 12 && (
        <p className="px-4 py-2 text-[13px] text-muted">+{hits.length - 12} נוספות</p>
      )}
    </div>
  );
}

export function OrgBreadcrumb({
  path,
  onSelect,
  onClear,
}: {
  path: OrgTreeNode[];
  onSelect: (id: string) => void;
  onClear: () => void;
}) {
  if (!path.length) return null;

  return (
    <div className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto bg-surface-2 px-4 py-2">
      <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-foreground" onClick={onClear} aria-label="נקה בחירה">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>
      {path.map((n, i) => (
        <button
          key={n._id}
          type="button"
          onClick={() => onSelect(n._id)}
          className={cn(
            'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            i === path.length - 1
              ? 'bg-brand-soft text-brand-text'
              : 'text-muted hover:bg-surface hover:text-foreground'
          )}
        >
          {n.canonicalName}
        </button>
      ))}
    </div>
  );
}
