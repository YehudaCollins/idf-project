import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, User, Network } from 'lucide-react';
import { api } from '../api/client';
import { Page, Spinner, Panel, Badge, Button, Empty, Input } from '../ui/primitives';
import { actionLabel, confidenceVariant } from '../lib/labels';
import { formatDate } from '../lib/utils';
import { ConfidenceBar } from '../components/ui/confidence-bar';
import { cn } from '../lib/utils';

const ACTION_FILTERS = [
  { id: 'all', label: 'הכל' },
  { id: 'exact_match', label: 'מדויק' },
  { id: 'alias_match', label: 'כינוי' },
  { id: 'fuzzy_auto', label: 'Fuzzy' },
  { id: 'semantic_match', label: 'סמנטי' },
  { id: 'create_unit', label: 'יצירה' },
  { id: 'review_conflict', label: 'ביקורת' },
];

export function AiPage() {
  const [q, setQ] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);

  const { data: status } = useQuery({ queryKey: ['aiStatus'], queryFn: api.aiStatus });
  const { data: stats } = useQuery({ queryKey: ['aiStats'], queryFn: api.aiStats });
  const { data, isLoading } = useQuery({
    queryKey: ['aiDecisions', q, actionFilter],
    queryFn: () =>
      api.aiDecisions({
        q: q.trim() || undefined,
        action: actionFilter === 'all' ? undefined : actionFilter,
        limit: 100,
      }),
  });

  const decisions = data ?? [];
  const picked = decisions.find((d) => d._id === selected) ?? decisions[0] ?? null;
  const aiActive = status?.connected ?? status?.ready;

  return (
    <Page
      wide
      title="החלטות AI"
      description="יומן audit של כל החלטות ההתאמה — מקור, ביטחון והסבר."
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="סה״כ" value={stats?.totalDecisions ?? 0} />
        <MiniStat label="היום" value={stats?.decisionsToday ?? 0} />
        <MiniStat label="לביקורת" value={stats?.pendingReviews ?? 0} />
        <MiniStat
          label="מנוע"
          value={status?.provider ?? '—'}
          hint={aiActive ? 'מחובר' : status?.message}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input className="pr-9" placeholder="חיפוש..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Panel title="סינון">
            <div className="space-y-1 p-3">
              {ACTION_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => { setActionFilter(f.id); setSelected(null); }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                    actionFilter === f.id ? 'bg-brand-soft font-medium text-brand-text' : 'text-muted hover:bg-surface-2'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </Panel>
        </aside>

        <Panel title={`יומן (${decisions.length})`}>
          {isLoading ? (
            <Spinner />
          ) : decisions.length === 0 ? (
            <Empty title="אין החלטות" description="נסה לשנות סינון או להריץ ingest." />
          ) : (
            <ul className="max-h-[640px] divide-y divide-border overflow-y-auto">
              {decisions.map((d) => (
                <li key={d._id}>
                  <button
                    type="button"
                    onClick={() => setSelected(d._id)}
                    className={cn(
                      'w-full rounded-xl px-4 py-3 text-right transition-colors hover:bg-surface-2',
                      picked?._id === d._id && 'bg-brand-soft/70'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{d.rawValue}</p>
                        <p className="text-xs text-muted">{actionLabel(d.action)} · {formatDate(d.createdAt)}</p>
                      </div>
                      <Badge variant={confidenceVariant(d.confidence)}>{Math.round(d.confidence * 100)}%</Badge>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="פרטים">
          {picked ? (
            <div className="space-y-4 p-4">
              <div>
                <p className="text-base font-semibold">{picked.rawValue}</p>
                {picked.matchedCanonicalName && (
                  <p className="mt-1 text-sm text-brand-text">{picked.matchedCanonicalName}</p>
                )}
              </div>
              <ConfidenceBar value={picked.confidence} />
              <dl className="space-y-2 text-sm">
                <Row label="פעולה" value={actionLabel(picked.action)} />
                <Row label="סוג" value={picked.decisionType} />
                <Row label="מקור" value={picked.source ?? '—'} />
                {picked.personalNumber && <Row label="משתמש" value={picked.personalNumber} mono />}
              </dl>
              <p className="rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-muted">{picked.reason}</p>
              <div className="flex flex-wrap gap-2">
                {picked.personalNumber && (
                  <Link to={`/users?pn=${encodeURIComponent(picked.personalNumber)}`}>
                    <Button variant="secondary" size="sm"><User className="h-3.5 w-3.5" />משתמש</Button>
                  </Link>
                )}
                {picked.parentId && (
                  <Link to={`/org-tree?unit=${picked.parentId}`}>
                    <Button variant="secondary" size="sm"><Network className="h-3.5 w-3.5" />יחידה</Button>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[200px] items-center justify-center p-4">
              <p className="text-sm text-muted">בחר החלטה מהרשימה</p>
            </div>
          )}
        </Panel>
      </div>
    </Page>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-subtle">{hint}</p>}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className={cn('font-medium', mono && 'font-mono text-xs')}>{value}</dd>
    </div>
  );
}
