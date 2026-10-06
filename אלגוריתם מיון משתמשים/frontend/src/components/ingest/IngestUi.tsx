import { cn } from '../../lib/utils';
import { actionLabel, confidenceVariant } from '../../lib/labels';
import { Badge } from '../../ui/primitives';
import { ConfidenceBar } from '../ui/confidence-bar';

export function TreeGrowth({
  items,
}: {
  items: { segment: string; unitId: string; action: string; created: boolean }[];
}) {
  const created = items.filter((i) => i.created);
  if (!created.length) return null;

  return (
    <div className="rounded-2xl bg-warning-soft p-4">
      <p className="text-sm font-medium text-warning-text">צמיחת עץ · {created.length} יחידות חדשות</p>
      <ul className="mt-3 space-y-2">
        {created.map((item, i) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-xs font-bold text-warning-text ring-1 ring-amber-200">
              +
            </span>
            <span className="font-medium">{item.segment}</span>
            <Badge variant="warning" className="mr-auto">{actionLabel(item.action)}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ParsedPathInfo({
  parsed,
}: {
  parsed: { segments: string[]; userNameRemoved: boolean; suspectedMissingLevel: boolean };
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge>{parsed.segments.length} קטעים</Badge>
      {parsed.userNameRemoved && <Badge variant="accent">שם הוסר מהנתיב</Badge>}
      {parsed.suspectedMissingLevel && <Badge variant="warning">חשד לרמה חסרה</Badge>}
    </div>
  );
}

export function DecisionTimeline({
  decisions,
}: {
  decisions: {
    segment: string;
    action: string;
    confidence: number;
    created: boolean;
    reviewId?: string;
  }[];
}) {
  if (!decisions.length) {
    return <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">אין קטעי ארגון לעיבוד</p>;
  }

  return (
    <ol className="space-y-3">
      {decisions.map((d, i) => (
        <li key={i} className="flex gap-3">
          <span
            className={cn(
              'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
              d.created ? 'bg-warning-soft text-warning-text' : 'bg-brand-soft text-brand-text'
            )}
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 rounded-xl bg-surface-2 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-medium">{d.segment}</p>
              <div className="flex flex-wrap gap-1">
                {d.created && <Badge variant="warning">חדש בעץ</Badge>}
                {d.reviewId && <Badge variant="warning">לביקורת</Badge>}
                <Badge variant={confidenceVariant(d.confidence)}>{actionLabel(d.action)}</Badge>
              </div>
            </div>
            <ConfidenceBar value={d.confidence} className="mt-2" size="sm" />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function PathPreview({ rawPath }: { rawPath: string }) {
  const parts = rawPath
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!parts.length) {
    return <p className="text-sm text-subtle">הזן נתיב ארגוני...</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span className="rounded-lg bg-surface px-2.5 py-1 text-sm text-foreground shadow-sm">{part}</span>
          {i < parts.length - 1 && <span className="text-subtle">/</span>}
        </span>
      ))}
    </div>
  );
}
