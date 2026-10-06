import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LogIn, RefreshCw, Search, Send, Network, User, MapPin, Users } from 'lucide-react';
import { api, type LoginResult } from '../api/client';
import {
  Page,
  Spinner,
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Textarea,
  Badge,
  Tabs,
  Empty,
  Alert,
  Callout,
} from '../ui/primitives';
import { DecisionTimeline, PathPreview, TreeGrowth, ParsedPathInfo } from '../components/ingest/IngestUi';
import { ROOT_PATH } from '../lib/orgConstants';
import { DEMO_CATEGORIES, CATEGORY_HE, CATEGORY_BADGE } from '../lib/demoCategories';
import { cn } from '../lib/utils';
import { parseSharePointProfileJson } from '../lib/sharePointProfile';

function ResultPanel({ result }: { result: LoginResult }) {
  const created = result.newOrgUnits ?? result.decisions.filter((d) => d.created).length;
  const leafId = result.pathIds?.[result.pathIds.length - 1];
  const enrichment = result.enrichment ?? [];
  const warnings = result.warnings ?? [];

  return (
    <Card>
      <CardHeader
        title="תוצאת עיבוד"
        description={`${result.user.fullName} · ${result.user.personalNumber}`}
        action={
          <Link to={`/users?pn=${encodeURIComponent(result.user.personalNumber)}`}>
            <Button variant="secondary" size="sm"><User className="h-4 w-4" /> פרופיל</Button>
          </Link>
        }
      />
      <CardBody className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {result.user.created ? <Badge variant="accent">משתמש חדש</Badge> : <Badge>עודכן</Badge>}
          {created === 0 ? <Badge variant="success">הותאם לעץ</Badge> : <Badge variant="warning">{created} יחידות חדשות</Badge>}
          {result.orgHistoryCreated && <Badge variant="accent">מעבר ארגוני</Badge>}
          {result.ai.needsReview && <Badge variant="warning">{result.reviewIds.length} לביקורת</Badge>}
        </div>

        {warnings.map((w) => (
          <Callout key={w} tone="warning">{w}</Callout>
        ))}

        {result.user.loginCount != null && (
          <p className="text-[14px] font-semibold text-slate-500">התחברות #{result.user.loginCount}</p>
        )}

        <ParsedPathInfo parsed={result.parsed} />

        {(result.treeGrowth?.length ?? 0) > 0 && (
          <TreeGrowth items={result.treeGrowth!} />
        )}

        <div className="rounded-xl bg-surface-2 px-4 py-3">
          <p className="text-xs font-medium text-subtle">נתיב סופי</p>
          <p className="mt-1 font-mono text-[13px] leading-relaxed text-foreground">{result.pathText || '—'}</p>
        </div>

        <div>
          <p className="mb-3 text-xs font-medium text-subtle">ציר החלטות AI</p>
          <DecisionTimeline decisions={result.decisions} />
        </div>

        {enrichment.length > 0 && (
          <Callout tone="success" title={`העשרת פרופיל · ${enrichment.length} שינויים`}>
            <ul className="space-y-1.5 text-[14px]">
              {enrichment.slice(0, 6).map((c, i) => (
                <li key={i}>{c.action === 'added' ? '+ ' : '↻ '}{c.field}{c.value != null ? `: ${String(c.value)}` : ''}</li>
              ))}
            </ul>
          </Callout>
        )}

        {result.reviewIds.length > 0 && (
          <Link to="/reviews">
            <Button variant="secondary" className="w-full">פתח מרכז ביקורת</Button>
          </Link>
        )}

        {leafId && (
          <Link to={`/org-tree?unit=${leafId}`}>
            <Button variant="secondary" className="w-full">
              <Network className="h-4 w-4" />
              הצג בעץ הארגוני
            </Button>
          </Link>
        )}
      </CardBody>
    </Card>
  );
}

export function IngestPage() {
  const [tab, setTab] = useState('demo');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sharePointJson, setSharePointJson] = useState('');
  const [manual, setManual] = useState({
    personalNumber: 'EXT-001',
    firstName: 'דוגמה',
    lastName: 'משתמש',
    rawOrgPath: `${ROOT_PATH}/אגף התקשוב/ענף צפון/מדור תומר/צוות א׳/דוגמה משתמש`,
    source: 'manual',
    rank: 'סמל',
    role: 'מפתח',
    email: '',
    phone: '',
  });
  const qc = useQueryClient();

  const { data: users, isLoading } = useQuery({ queryKey: ['demoUsers'], queryFn: api.demoUsers });

  const login = useMutation({
    mutationFn: (id: string) => api.demoLogin(id),
    onSuccess: (_, id) => {
      setActiveId(id);
      qc.invalidateQueries({ queryKey: ['orgTree'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const manualIngest = useMutation({
    mutationFn: () => {
      const sharePointProfile = parseSharePointProfileJson(sharePointJson);
      return api.ingestLogin(
        sharePointProfile
          ? { sharePointProfile, source: manual.source, sourceSystem: manual.source }
          : manual
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orgTree'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const filtered = useMemo(() => {
    if (!users) return [];
    let list = filter === 'all' ? users : users.filter((u) => u.category === filter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.firstName.toLowerCase().includes(s) ||
          u.lastName.toLowerCase().includes(s) ||
          u.personalNumber.toLowerCase().includes(s) ||
          u.description.toLowerCase().includes(s)
      );
    }
    return list;
  }, [users, filter, search]);

  const bulkLogin = useMutation({
    mutationFn: (ids: string[]) => api.demoBulkLogin(ids),
    onSuccess: () => {
      setActiveId(null);
      qc.invalidateQueries({ queryKey: ['orgTree'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const categoryCounts = useMemo(() => {
    const c: Record<string, number> = { all: users?.length ?? 0 };
    users?.forEach((u) => { if (u.category) c[u.category] = (c[u.category] ?? 0) + 1; });
    return c;
  }, [users]);

  if (isLoading) return <Spinner label="טוען תרחישים..." />;

  const result = login.data && activeId ? login.data : manualIngest.data ?? null;

  return (
    <Page
      wide
      title="התחברות"
      description="פירוק נתיב, התאמה חכמה לעץ, העשרת פרופיל ויצירת יחידות חדשות — בכל ingest."
    >
      <div className="mb-6">
        <Tabs
          items={[
            { id: 'demo', label: 'תרחישי דמו', count: users?.length },
            { id: 'manual', label: 'ידני' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'manual' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="טופס ingest" description="שליחת משתמש ונתיב מלאים לעיבוד חכם." />
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="מספר אישי" value={manual.personalNumber} onChange={(v) => setManual((m) => ({ ...m, personalNumber: v }))} />
                <Field label="מקור" value={manual.source} onChange={(v) => setManual((m) => ({ ...m, source: v }))} />
                <Field label="שם פרטי" value={manual.firstName} onChange={(v) => setManual((m) => ({ ...m, firstName: v }))} />
                <Field label="שם משפחה" value={manual.lastName} onChange={(v) => setManual((m) => ({ ...m, lastName: v }))} />
                <Field label="דרגה" value={manual.rank} onChange={(v) => setManual((m) => ({ ...m, rank: v }))} />
                <Field label="תפקיד" value={manual.role} onChange={(v) => setManual((m) => ({ ...m, role: v }))} />
                <Field label="אימייל" value={manual.email} onChange={(v) => setManual((m) => ({ ...m, email: v }))} />
                <Field label="טלפון" value={manual.phone} onChange={(v) => setManual((m) => ({ ...m, phone: v }))} />
              </div>
              <div>
                <label className="mb-2 block text-[13px] font-medium text-muted">נתיב ארגוני גולמי</label>
                <Textarea value={manual.rawOrgPath} onChange={(e) => setManual((m) => ({ ...m, rawOrgPath: e.target.value }))} rows={3} />
                <div className="mt-3 border border-dashed border-border bg-elevated px-4 py-3">
                  <p className="label-caps mb-2">תצוגה מקדימה</p>
                  <PathPreview rawPath={manual.rawOrgPath} />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-[13px] font-medium text-muted">אובייקט SharePoint מלא</label>
                <Textarea
                  value={sharePointJson}
                  onChange={(e) => setSharePointJson(e.target.value)}
                  rows={9}
                  dir="ltr"
                  className="font-mono text-[12px]"
                  placeholder='{"AccountName":"idf\\\\c9214482","FirstName":"...","LastName":"...","Department":"...","PictureURL":"/profiles/c9214482.jpg"}'
                />
              </div>
              {manualIngest.isError && <Alert>{(manualIngest.error as Error).message}</Alert>}
              {manualIngest.isSuccess && !manualIngest.isPending && (
                <Callout tone="success">ה-ingest הושלם בהצלחה</Callout>
              )}
              <Button className="w-full" disabled={manualIngest.isPending} onClick={() => manualIngest.mutate()}>
                {manualIngest.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                שלח לעיבוד
              </Button>
            </CardBody>
          </Card>
          {result ? <ResultPanel result={result} /> : (
            <Card><Empty title="ממתין לשליחה" description="מלא את הטופס והרץ ingest" /></Card>
          )}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader
              title="תרחישי בדיקה"
              description={`${filtered.length} מתוך ${users?.length}`}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={bulkLogin.isPending || login.isPending || filtered.length === 0}
                  onClick={() => bulkLogin.mutate(filtered.map((u) => u.id))}
                >
                  {bulkLogin.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                  הכנס את המוצגים
                </Button>
              }
            />
            <div className="space-y-4 border-b border-border px-5 py-4">
              <div className="relative">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <Input className="pr-9" placeholder="חיפוש..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Tabs
                items={[
                  { id: 'all', label: 'הכל', count: categoryCounts.all },
                  ...DEMO_CATEGORIES
                    .filter((c) => c.id !== 'all')
                    .map((c) => ({ id: c.id, label: CATEGORY_HE[c.id] ?? c.label, count: categoryCounts[c.id] })),
                ]}
                value={filter}
                onChange={setFilter}
              />
              {bulkLogin.isSuccess && (
                <Callout
                  tone={bulkLogin.data.failed > 0 ? 'warning' : 'success'}
                  title={`הכנסה מרוכזת · ${bulkLogin.data.succeeded}/${bulkLogin.data.requested}`}
                >
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>{bulkLogin.data.newOrgUnits} יחידות חדשות</span>
                    <span>{bulkLogin.data.reviews} לביקורת</span>
                    {bulkLogin.data.failed > 0 && <span>{bulkLogin.data.failed} נכשלו</span>}
                    <Link to="/users" className="font-semibold underline">פתח משתמשים</Link>
                  </div>
                </Callout>
              )}
              {bulkLogin.isError && (
                <Callout tone="danger">{(bulkLogin.error as Error).message}</Callout>
              )}
            </div>
            <ul className="grid max-h-[680px] gap-3 overflow-y-auto p-4 xl:grid-cols-2">
              {filtered.length === 0 ? (
                <li className="xl:col-span-2">
                  <Empty title="אין תוצאות" />
                </li>
              ) : (
                filtered.map((u) => {
                  const active = activeId === u.id;
                  const loading = login.isPending && activeId === u.id;
                  const pathPreview = u.rawOrgPath
                    .split('/')
                    .map((part) => part.trim())
                    .filter(Boolean)
                    .slice(-3)
                    .join(' / ');
                  return (
                    <li
                      key={u.id}
                      className={cn(
                        'card card-hover rounded-2xl p-5 transition-all',
                        active && 'ring-2 ring-brand/30'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-sm font-semibold text-brand-text">
                          {u.firstName[0]}{u.lastName[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[14px] font-medium">{u.firstName} {u.lastName}</span>
                            {u.category && (
                              <Badge variant={CATEGORY_BADGE[u.category] === 'warning' ? 'warning' : 'default'}>
                                {CATEGORY_HE[u.category]}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 font-mono text-[11px] text-subtle">{u.personalNumber}</p>
                        </div>
                      </div>

                      <p className="mt-3 min-h-[40px] text-[13px] leading-relaxed text-muted">{u.description}</p>

                      <div className="mt-3 rounded-xl bg-surface-2 p-3 text-xs text-muted">
                        <p className="truncate">{[u.rank, u.role].filter(Boolean).join(' · ') || 'ללא דרגה/תפקיד'}</p>
                        <p className="truncate">{[u.email, u.phone].filter(Boolean).join(' · ') || 'ללא קשר'}</p>
                        <p className="truncate">
                          {[u.sourceSystem, u.attributes?.profession, u.attributes?.clearance].filter(Boolean).join(' · ')}
                        </p>
                      </div>

                      <div className="mt-3 flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" />
                        <p className="min-w-0 truncate text-[12px] text-muted">{pathPreview}</p>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="truncate text-[12px] text-subtle">
                          {u.accessRole === 'admin' ? 'מנהל דמו' : u.accessRole === 'regular' ? 'משתמש רגיל' : 'פרופיל מלא'}
                        </span>
                        <Button
                          variant={active ? 'secondary' : 'primary'}
                          size="sm"
                          disabled={login.isPending || bulkLogin.isPending}
                          onClick={() => { setActiveId(u.id); login.mutate(u.id); }}
                        >
                          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                          הרץ
                        </Button>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </Card>
          <div className="lg:col-span-2 lg:sticky lg:top-6 lg:self-start">
            {login.isError && <div className="mb-4"><Alert>{(login.error as Error).message}</Alert></div>}
            {result ? <ResultPanel result={result} /> : (
              <Card className="h-full min-h-[280px] flex items-center justify-center">
                <Empty title="בחר תרחיש" description="לחץ הרץ כדי להפעיל את מנוע ההתאמה" />
              </Card>
            )}
          </div>
        </div>
      )}
    </Page>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-2 block text-[15px] font-bold text-slate-600">{label}</label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
