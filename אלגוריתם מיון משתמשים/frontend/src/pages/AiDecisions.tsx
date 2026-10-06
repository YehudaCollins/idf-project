import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BrainCircuit, Sparkles, Filter, X } from 'lucide-react';
import { api, type AiDecision } from '../api/client';
import { PageShell, LoadingScreen, ErrorBanner, EmptyPlaceholder } from '../components/ui/page-shell';
import { Card, CardBody, CardHeader } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { SearchBar } from '../components/ui/search-bar';
import { FilterPills } from '../components/ui/filter-pills';
import { ConfidenceBar } from '../components/ui/confidence-bar';
import { AiStatusBar } from '../components/ai/AiStatusBar';
import {
  DataTable,
  DataTableHead,
  DataTableHeader,
  DataTableBody,
  DataTableRow,
  DataTableCell,
} from '../components/ui/data-table';
import { formatDate } from '../lib/utils';
import { actionLabel, confidenceVariant } from '../lib/labels';

const CONF_FILTERS = [
  { id: 'all', label: 'הכל' },
  { id: 'high', label: '≥95%' },
  { id: 'med', label: 'בינוני' },
  { id: 'low', label: 'נמוך' },
];

const ACTION_FILTERS = [
  { id: '', label: 'כל הפעולות' },
  { id: 'exact_match', label: 'מדויק' },
  { id: 'alias_match', label: 'כינוי' },
  { id: 'fuzzy_auto', label: 'fuzzy' },
  { id: 'semantic_match', label: 'OpenAI' },
  { id: 'review_medium', label: 'ביקורת' },
  { id: 'create_unit', label: 'יצירה' },
  { id: 'admin_approved', label: 'אושר' },
];

export function AiDecisions() {
  const [q, setQ] = useState('');
  const [confFilter, setConfFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('');
  const [selected, setSelected] = useState<AiDecision | null>(null);

  const { data: stats } = useQuery({
    queryKey: ['aiStats'],
    queryFn: api.aiStats,
    refetchInterval: 30_000,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['aiDecisions', actionFilter, q],
    queryFn: () =>
      api.aiDecisions({
        action: actionFilter || undefined,
        q: q.trim() || undefined,
        limit: 200,
      }),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data;
    if (confFilter === 'high') list = list.filter((d) => d.confidence >= 0.95);
    else if (confFilter === 'med')
      list = list.filter((d) => d.confidence >= 0.85 && d.confidence < 0.95);
    else if (confFilter === 'low') list = list.filter((d) => d.confidence < 0.85);
    return list;
  }, [data, confFilter]);

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorBanner message={(error as Error).message} />;

  return (
    <PageShell
      title="החלטות AI"
      description="יומן audit מלא — מוכן לחיבור LLM. כל החלטה נשמרת עם מקור, מודל וסיגנלים."
      badge={stats ? `${stats.totalDecisions} סה״כ` : undefined}
    >
      <div className="mb-6 space-y-4">
        <AiStatusBar />
        {stats && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatPill label="היום" value={stats.decisionsToday} />
            <StatPill label="ממתינים" value={stats.pendingReviews} accent="amber" />
            <StatPill label="סה״כ" value={stats.totalDecisions} />
            <StatPill
              label="מקור"
              value={stats.provider.provider === 'mock' ? 'כללים' : stats.provider.provider}
            />
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBar
          containerClassName="flex-1 max-w-md"
          placeholder="חיפוש..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <FilterPills options={CONF_FILTERS} value={confFilter} onChange={setConfFilter} />
      </div>

      <FilterPills
        className="mb-5"
        options={ACTION_FILTERS}
        value={actionFilter}
        onChange={setActionFilter}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader
            icon={BrainCircuit}
            title="יומן החלטות"
            description={`${filtered.length} מוצגות`}
          />
          <CardBody className="!p-0">
            {!filtered.length ? (
              <EmptyPlaceholder
                icon={Filter}
                title="אין תוצאות"
                description="הרץ דemo או שנה סינון"
              />
            ) : (
              <DataTable stickyHeader>
                <DataTableHead>
                  <DataTableHeader>זמן</DataTableHeader>
                  <DataTableHeader>סוג</DataTableHeader>
                  <DataTableHeader>ערך</DataTableHeader>
                  <DataTableHeader>התאמה</DataTableHeader>
                  <DataTableHeader>פעולה</DataTableHeader>
                  <DataTableHeader>ביטחון</DataTableHeader>
                </DataTableHead>
                <DataTableBody>
                  {filtered.map((d, i) => (
                    <DataTableRow
                      key={d._id}
                      index={i}
                      className="cursor-pointer"
                      onClick={() => setSelected(d)}
                    >
                      <DataTableCell mono className="whitespace-nowrap text-slate-400">
                        {formatDate(d.createdAt)}
                      </DataTableCell>
                      <DataTableCell className="text-[11px] text-slate-500">
                        {d.decisionType}
                      </DataTableCell>
                      <DataTableCell className="max-w-[100px] font-semibold">
                        {d.rawValue}
                      </DataTableCell>
                      <DataTableCell className="max-w-[100px] text-[11px] text-accent">
                        {d.matchedCanonicalName ?? '—'}
                      </DataTableCell>
                      <DataTableCell>
                        <span className="inline-flex items-center gap-1 text-[12px]">
                          <Sparkles className="h-3 w-3 text-accent" />
                          {actionLabel(d.action)}
                        </span>
                      </DataTableCell>
                      <DataTableCell>
                        <Badge variant={confidenceVariant(d.confidence)} className="font-mono">
                          {Math.round(d.confidence * 100)}%
                        </Badge>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            )}
          </CardBody>
        </Card>

        <div className="xl:sticky xl:top-24 xl:self-start">
          {selected ? (
            <DecisionDetail decision={selected} onClose={() => setSelected(null)} />
          ) : (
            <Card className="border-dashed border-slate-200 bg-slate-50/50 shadow-none">
              <CardBody className="py-16 text-center text-[13px] text-slate-500">
                לחץ על שורה לפרטי החלטה
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function DecisionDetail({ decision, onClose }: { decision: AiDecision; onClose: () => void }) {
  return (
    <Card className="overflow-hidden animate-scale-in">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
        <p className="text-[13px] font-bold text-slate-800">פרטי החלטה</p>
        <Button variant="ghost" size="iconSm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <CardBody className="space-y-4 p-4">
        <div>
          <p className="text-[10px] font-bold uppercase text-slate-400">ערך גולמי</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{decision.rawValue}</p>
          {decision.matchedCanonicalName && (
            <p className="mt-1 text-[13px] text-accent">→ {decision.matchedCanonicalName}</p>
          )}
        </div>

        <ConfidenceBar value={decision.confidence} />

        <div className="space-y-2 text-[12px]">
          <Row label="פעולה" value={actionLabel(decision.action)} />
          <Row label="סוג" value={decision.decisionType} />
          <Row label="מקור" value={decision.source ?? '—'} mono />
          <Row label="מודל" value={decision.modelVersion ?? '—'} mono />
          {decision.personalNumber && (
            <Row label="משתמש" value={decision.personalNumber} mono />
          )}
        </div>

        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
          <p className="text-[10px] font-bold uppercase text-slate-400">הסבר</p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-700">{decision.reason}</p>
        </div>

        {decision.signals && Object.keys(decision.signals).length > 0 && (
          <div className="rounded-xl bg-indigo-50/50 p-3 ring-1 ring-indigo-100">
            <p className="text-[10px] font-bold uppercase text-indigo-600">סיגנלים</p>
            <pre className="mt-1 overflow-x-auto text-[10px] text-indigo-900">
              {JSON.stringify(decision.signals, null, 2)}
            </pre>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className={mono ? 'font-mono font-semibold text-slate-800' : 'font-semibold text-slate-800'}>
        {value}
      </span>
    </div>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: 'amber';
}) {
  return (
    <div
      className={`rounded-xl px-4 py-3 ring-1 ${
        accent === 'amber' ? 'bg-amber-50 ring-amber-200' : 'bg-white ring-slate-200'
      }`}
    >
      <p className="font-mono text-xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  );
}
