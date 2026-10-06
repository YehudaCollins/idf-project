import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { User, ArrowRight, History, FileText, MapPin, Route, BrainCircuit } from 'lucide-react';
import { api } from '../api/client';
import { PageShell, LoadingScreen, EmptyPlaceholder } from '../components/ui/page-shell';
import { Card, CardBody, CardHeader } from '../components/ui/card';
import { SearchBar } from '../components/ui/search-bar';
import { Button } from '../components/ui/button';
import { Avatar } from '../components/ui/avatar';
import {
  DataTable,
  DataTableHead,
  DataTableHeader,
  DataTableBody,
  DataTableRow,
  DataTableCell,
} from '../components/ui/data-table';
import { formatDate } from '../lib/utils';
import { actionLabel } from '../lib/labels';
import { Badge } from '../components/ui/badge';

const SUGGESTIONS = ['DEMO-1001', 'יהודה', 'תמר', 'אגף'];

export function UserLookup() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('pn') ?? params.get('q') ?? '');
  const [selected, setSelected] = useState<string | null>(params.get('pn'));

  useEffect(() => {
    const pn = params.get('pn');
    if (pn) {
      setSelected(pn);
      setQ(pn);
    }
  }, [params]);

  const { data: list, isFetching } = useQuery({
    queryKey: ['users', q],
    queryFn: () => api.users(q || undefined),
    enabled: q.trim().length >= 1,
  });

  const { data: detail, isLoading } = useQuery({
    queryKey: ['user', selected],
    queryFn: () => api.user(selected!),
    enabled: !!selected,
  });

  const selectUser = (pn: string) => {
    setSelected(pn);
    setParams({ pn });
  };

  return (
    <PageShell
      title="חיפוש משתמש"
      description="מספר אישי, שם או נתיב — כולל היסטוריית מעבר ארגוני."
      badge="חיפוש"
    >
      <div className="mb-4">
        <SearchBar
          containerClassName="max-w-xl"
          placeholder="הקלד לחיפוש..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSelected(null);
            setParams({});
          }}
        />
        {!q.trim() && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400">דוגמאות:</span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQ(s)}
                className="rounded-lg bg-white px-3 py-1 text-[12px] font-semibold text-slate-600 ring-1 ring-slate-200 transition-all hover:bg-accent-soft hover:text-accent hover:ring-teal-200"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {!selected && q.trim() && (
        <Card className="mb-6 overflow-hidden">
          {isFetching ? (
            <LoadingScreen message="מחפש..." />
          ) : list && list.length > 0 ? (
            <CardBody className="!p-0 divide-y divide-slate-100">
              {list.map((u) => (
                <button
                  key={u.personalNumber}
                  type="button"
                  onClick={() => selectUser(u.personalNumber)}
                  className="group flex w-full items-center gap-4 px-6 py-4 text-right transition-all hover:bg-accent-soft/50"
                >
                  <Avatar name={u.fullName} imageUrl={u.profileImageUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 group-hover:text-accent">
                      {u.fullName}
                    </p>
                    <p className="font-mono text-[11px] font-semibold text-accent">
                      {u.personalNumber}
                    </p>
                    <p className="mt-1 truncate text-[12px] text-slate-500">
                      {u.currentOrgPathText}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:-translate-x-0.5 group-hover:text-accent" />
                </button>
              ))}
            </CardBody>
          ) : (
            <EmptyPlaceholder
              icon={User}
              title="לא נמצאו משתמשים"
              description="נסה מספר אישי או שם אחר"
            />
          )}
        </Card>
      )}

      {!q.trim() && !selected && (
        <div className="surface-card flex flex-col items-center py-20 text-center animate-scale-in">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-accent-soft ring-1 ring-teal-100">
            <User className="h-8 w-8 text-accent" />
          </div>
          <p className="text-lg font-bold text-slate-800">חפש משתמש במערכת</p>
          <p className="mt-2 text-[13px] text-slate-500">
            לחץ על דוגמה למעלה או הקלד בשדה החיפוש
          </p>
        </div>
      )}

      {selected && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="mb-5"
            onClick={() => {
              setSelected(null);
              setParams({});
            }}
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
            חזרה לתוצאות
          </Button>

          {isLoading ? (
            <LoadingScreen />
          ) : detail ? (
            <div className="space-y-6 animate-slide-up">
              <div className="surface-card overflow-hidden">
                <div className="flex flex-wrap items-center gap-5 border-b border-slate-100 bg-white p-6 text-slate-900">
                  <Avatar name={detail.user.fullName} imageUrl={detail.user.profileImageUrl} size="lg" />
                  <div>
                    <h2 className="text-[22px] font-semibold tracking-tight">
                      {detail.user.fullName}
                    </h2>
                    <p className="mt-1 font-mono text-sm font-semibold text-accent">
                      {detail.user.personalNumber}
                    </p>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-100">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        נתיב נוכחי
                      </p>
                      <p className="mt-1 text-[13px] font-medium leading-relaxed text-slate-800">
                        {detail.user.currentOrgPathText || '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader icon={FileText} title="נתיבים גולמיים" description="קלט מקורי" />
                  <CardBody>
                    <ul className="space-y-2">
                      {detail.user.rawPaths?.length ? (
                        detail.user.rawPaths.map((p, i) => (
                          <li
                            key={i}
                            className="rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3 text-[12px] leading-relaxed text-slate-700"
                          >
                            {p}
                          </li>
                        ))
                      ) : (
                        <p className="text-center text-slate-400">אין נתיבים גולמיים</p>
                      )}
                    </ul>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader icon={Route} title="סיכום" />
                  <CardBody className="space-y-4">
                    <SummaryRow label="נתיבים גולמיים" value={detail.user.rawPaths?.length ?? 0} />
                    <SummaryRow label="מעברים ארגוניים" value={detail.history.length} />
                    <SummaryRow label="החלטות AI" value={detail.decisions?.length ?? 0} />
                    <SummaryRow
                      label="נראה לאחרונה"
                      value={
                        detail.user.lastSeenAt
                          ? formatDate(detail.user.lastSeenAt)
                          : '—'
                      }
                      mono
                    />
                  </CardBody>
                </Card>
              </div>

              <Card>
                <CardHeader
                  icon={History}
                  title="היסטוריית מעבר"
                  description="שינויי יחידה בין התחברויות"
                />
                <CardBody className="!p-0">
                  {detail.history.length === 0 ? (
                    <p className="px-6 py-10 text-center text-slate-400">אין היסטוריה</p>
                  ) : (
                    <DataTable>
                      <DataTableHead>
                        <DataTableHeader>נתיב גולמי</DataTableHeader>
                        <DataTableHeader>מ</DataTableHeader>
                        <DataTableHeader>אל</DataTableHeader>
                        <DataTableHeader>תאריך</DataTableHeader>
                      </DataTableHead>
                      <DataTableBody>
                        {detail.history.map((h, i) => (
                          <DataTableRow key={i}>
                            <DataTableCell className="max-w-[140px] text-[11px]">
                              {h.rawPath}
                            </DataTableCell>
                            <DataTableCell className="max-w-[120px] text-[11px] text-slate-500">
                              {h.fromPathText ?? '—'}
                            </DataTableCell>
                            <DataTableCell className="max-w-[120px] text-[11px] text-accent">
                              {h.toPathText ?? '—'}
                            </DataTableCell>
                            <DataTableCell mono className="whitespace-nowrap text-slate-400">
                              {formatDate(h.changedAt)}
                            </DataTableCell>
                          </DataTableRow>
                        ))}
                      </DataTableBody>
                    </DataTable>
                  )}
                </CardBody>
              </Card>

              {detail.decisions && detail.decisions.length > 0 && (
                <Card>
                  <CardHeader
                    icon={BrainCircuit}
                    title="החלטות AI למשתמש"
                    description="יומן audit לפי מספר אישי"
                  />
                  <CardBody className="!p-0">
                    <DataTable>
                      <DataTableHead>
                        <DataTableHeader>ערך</DataTableHeader>
                        <DataTableHeader>פעולה</DataTableHeader>
                        <DataTableHeader>ביטחון</DataTableHeader>
                        <DataTableHeader>תאריך</DataTableHeader>
                      </DataTableHead>
                      <DataTableBody>
                        {detail.decisions.map((d, i) => (
                          <DataTableRow key={d._id} index={i}>
                            <DataTableCell className="font-semibold">{d.rawValue}</DataTableCell>
                            <DataTableCell className="text-[12px]">
                              {actionLabel(d.action)}
                              {d.matchedCanonicalName && (
                                <span className="block text-[10px] text-accent">
                                  → {d.matchedCanonicalName}
                                </span>
                              )}
                            </DataTableCell>
                            <DataTableCell>
                              <Badge variant="default" className="font-mono">
                                {Math.round(d.confidence * 100)}%
                              </Badge>
                            </DataTableCell>
                            <DataTableCell mono className="text-slate-400">
                              {formatDate(d.createdAt)}
                            </DataTableCell>
                          </DataTableRow>
                        ))}
                      </DataTableBody>
                    </DataTable>
                  </CardBody>
                </Card>
              )}
            </div>
          ) : null}
        </>
      )}
    </PageShell>
  );
}

function SummaryRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span className="text-[13px] text-slate-500">{label}</span>
      <span className={mono ? 'font-mono text-[12px] font-bold text-slate-700' : 'text-lg font-bold text-slate-900'}>
        {value}
      </span>
    </div>
  );
}
