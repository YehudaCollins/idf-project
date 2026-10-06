import { useEffect, useMemo, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BrainCircuit,
  CalendarClock,
  Clock3,
  Contact,
  Database,
  Fingerprint,
  History,
  Loader2,
  Mail,
  Network,
  Phone,
  RefreshCw,
  Route,
  Save,
  Search,
  ShieldCheck,
  Tags,
  UserRoundCog,
  X,
} from 'lucide-react';
import { api, type AccessRole, type UserRecord } from '../api/client';
import { useDemoAuth } from '../auth/DemoAuth';
import {
  Page,
  Spinner,
  Card,
  Input,
  Button,
  Badge,
  Table,
  Th,
  Td,
  Tr,
  Textarea,
  Empty,
  Callout,
} from '../ui/primitives';
import { Avatar } from '../components/ui/avatar';
import { actionLabel } from '../lib/labels';
import { formatProfileValue } from '../lib/sharePointProfile';
import { cn, formatDate } from '../lib/utils';

type ProfileDraft = Pick<UserRecord, 'firstName' | 'lastName' | 'rank' | 'role' | 'email' | 'phone' | 'profileImageUrl'>;
type RoleFilter = 'all' | AccessRole;

const DEFAULT_VISIBLE_USERS = 20;

const ACCESS_ROLE_LABEL: Record<AccessRole, string> = {
  admin: 'מנהל',
  regular: 'רגיל',
};

const ACCESS_ROLE_DESCRIPTION: Record<AccessRole, string> = {
  admin: 'רואה את כל המשתמשים ומנהל הרשאות',
  regular: 'רואה עץ, פרופיל אישי ועריכת מבנה בפיקודו',
};

function draftFromUser(user: UserRecord): ProfileDraft {
  return {
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    rank: user.rank ?? '',
    role: user.role ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
    profileImageUrl: user.profileImageUrl ?? '',
  };
}

function pathSegments(path?: string) {
  return (path ?? '').split('/').map((part) => part.trim()).filter(Boolean);
}

function lastPathSegment(path?: string) {
  const parts = pathSegments(path);
  return parts.at(-1) ?? 'לא משויך';
}

function optionalDate(value?: string) {
  return value ? formatDate(value) : 'לא ידוע';
}

function sourceSystemsForUser(user: UserRecord) {
  return user.sourceSystems?.length ? user.sourceSystems : user.sourceSystem ? [user.sourceSystem] : [];
}

export function UsersPage() {
  const { actor, isAdmin } = useDemoAuth();
  const personalNumber = actor?.personalNumber ?? '';
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(isAdmin ? params.get('pn') ?? '' : personalNumber);
  const [selected, setSelected] = useState<string | null>(isAdmin ? params.get('pn') : personalNumber);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [visibleUsers, setVisibleUsers] = useState(DEFAULT_VISIBLE_USERS);
  const qc = useQueryClient();
  const activePn = isAdmin ? selected : personalNumber;

  useEffect(() => {
    const pn = params.get('pn');
    if (!isAdmin) {
      if (!personalNumber) return;
      setSelected(personalNumber);
      setQ(personalNumber);
      if (pn !== personalNumber) setParams({ pn: personalNumber }, { replace: true });
      return;
    }
    if (pn) {
      setSelected(pn);
      setQ(pn);
    }
  }, [personalNumber, isAdmin, params, setParams]);

  const { data: list, isFetching } = useQuery({
    queryKey: ['users', q],
    queryFn: () => api.users(q || undefined),
    enabled: isAdmin && !activePn,
  });

  const filteredUsers = useMemo(() => {
    const users = list ?? [];
    if (roleFilter === 'all') return users;
    return users.filter((u) => (u.accessRole ?? 'regular') === roleFilter);
  }, [list, roleFilter]);

  const roleCounts = useMemo(() => {
    const users = list ?? [];
    return {
      all: users.length,
      admin: users.filter((u) => (u.accessRole ?? 'regular') === 'admin').length,
      regular: users.filter((u) => (u.accessRole ?? 'regular') === 'regular').length,
    };
  }, [list]);

  const hasSearch = q.trim().length > 0;
  const visibleList = hasSearch ? filteredUsers : filteredUsers.slice(0, visibleUsers);
  const hiddenCount = Math.max(filteredUsers.length - visibleList.length, 0);

  useEffect(() => {
    setVisibleUsers(DEFAULT_VISIBLE_USERS);
  }, [q, roleFilter]);

  const { data: detail, isLoading, error: detailError } = useQuery({
    queryKey: ['user', activePn],
    queryFn: () => api.user(activePn!),
    enabled: !!activePn,
  });

  const reingest = useMutation({
    mutationFn: (rawOrgPath?: string) => api.reingestUser(activePn!, rawOrgPath),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', activePn] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['orgTree'] });
    },
  });

  const profileUpdate = useMutation({
    mutationFn: (body: ProfileDraft) => api.updateUserProfile(activePn!, body),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['user', updated.personalNumber] });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['orgTree'] });
    },
  });

  const accessUpdate = useMutation({
    mutationFn: ({ personalNumber, accessRole }: { personalNumber: string; accessRole: AccessRole }) =>
      api.updateUserAccessRole(personalNumber, accessRole),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['user', updated.personalNumber] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const pageTitle = isAdmin ? 'משתמשים' : 'הפרופיל שלי';
  const pageDescription = isAdmin
    ? 'חיפוש, צפייה בפרופיל, היסטוריית מעבר, החלטות AI וניהול הרשאות.'
    : 'פרטי המשתמש שלך, שיוך יחידה ועדכון פרטים אישיים.';
  const clearSearch = () => {
    setQ('');
    setSelected(null);
    setParams({});
  };
  const backToUserList = () => {
    if (activePn && q.trim() === activePn) setQ('');
    setSelected(null);
    setParams({});
  };

  return (
    <Page title={pageTitle} description={pageDescription} wide>
      {isAdmin && (
        <section className="mb-6 surface p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <Input
                className="pl-10 pr-9"
                placeholder="מספר אישי, שם, דרגה, תפקיד, אימייל או נתיב..."
                value={q}
                onChange={(e) => { setQ(e.target.value); setSelected(null); setParams({}); }}
              />
              {q && (
                <button
                  type="button"
                  aria-label="נקה חיפוש"
                  onClick={clearSearch}
                  className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-subtle transition-colors hover:bg-elevated hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1 border border-border bg-elevated p-1">
              {([
                ['all', 'כולם'],
                ['admin', 'מנהלים'],
                ['regular', 'רגילים'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRoleFilter(value)}
                  className={cn(
                    'h-9 px-3 text-[13px] font-semibold transition-colors',
                    roleFilter === value
                      ? 'bg-chrome text-chrome-active'
                      : 'text-muted hover:bg-surface hover:text-foreground'
                  )}
                >
                  {label}
                  <span className="mr-1 font-mono text-[12px] opacity-70">{roleCounts[value]}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {isAdmin && !selected && (
        <Card>
          <div className="border-b border-border bg-elevated px-5 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-semibold">{hasSearch ? 'תוצאות חיפוש' : 'כל המשתמשים'}</h2>
                <p className="mt-0.5 text-[13px] text-muted">
                  {filteredUsers.length} משתמשים
                  {!hasSearch && filteredUsers.length > 0 && ` · מוצגים ${visibleList.length} ראשונים`}
                </p>
              </div>
              {roleFilter !== 'all' && (
                <Badge variant={roleFilter === 'admin' ? 'success' : 'default'}>
                  {ACCESS_ROLE_LABEL[roleFilter]}
                </Badge>
              )}
            </div>
          </div>
          {isFetching ? <Spinner /> : (
            <div className="divide-y divide-border">
              {filteredUsers.length === 0 ? (
                <Empty
                  title={hasSearch ? 'לא נמצאו תוצאות' : 'אין משתמשים להצגה'}
                  description={hasSearch ? 'נסה חיפוש רחב יותר או סינון הרשאות אחר.' : undefined}
                />
              ) : (
                <>
                  {visibleList.map((u) => (
                    <button
                      key={u.personalNumber}
                      type="button"
                      onClick={() => { setSelected(u.personalNumber); setParams({ pn: u.personalNumber }); }}
                      className="grid w-full gap-3 px-5 py-3 text-right transition-colors hover:bg-elevated md:grid-cols-[minmax(0,1fr)_110px_140px_minmax(0,1fr)] md:items-center"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Avatar name={u.fullName} imageUrl={u.profileImageUrl} size="sm" className="rounded-xl" />
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-medium">{u.fullName}</span>
                          <span className="mt-0.5 block text-[12px] text-muted">{[u.rank, u.role].filter(Boolean).join(' · ') || 'ללא דרגה/תפקיד'}</span>
                        </span>
                      </span>
                      <Badge variant={u.accessRole === 'admin' ? 'success' : 'default'}>{ACCESS_ROLE_LABEL[u.accessRole ?? 'regular']}</Badge>
                      <span className="font-mono text-[12px] text-muted">{u.personalNumber}</span>
                      <span className="truncate text-[13px] text-muted">{u.currentOrgPathText}</span>
                    </button>
                  ))}
                  {!hasSearch && hiddenCount > 0 && (
                    <div className="bg-elevated/50 px-5 py-4">
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => setVisibleUsers((count) => count + DEFAULT_VISIBLE_USERS)}
                      >
                        הצג עוד {Math.min(DEFAULT_VISIBLE_USERS, hiddenCount)}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </Card>
      )}

      {activePn && (
        <>
          {isAdmin && (
            <Button variant="ghost" size="sm" className="mb-5" onClick={backToUserList}>
              <ArrowRight className="h-4 w-4 rotate-180" />
              חזרה לחיפוש
            </Button>
          )}

          {detailError && <Callout tone="danger">{(detailError as Error).message}</Callout>}

          {isLoading ? <Spinner /> : detail && (
            <div className="space-y-6 pb-28">
              <UserProfileHero
                user={detail.user}
                isAdminView={isAdmin}
                reingestBusy={reingest.isPending}
                onReingest={() => reingest.mutate(undefined)}
              />

              {reingest.isSuccess && (
                <Callout tone="success">ingest הושלם · {reingest.data?.newOrgUnits ?? 0} יחידות חדשות</Callout>
              )}
              {reingest.isError && (
                <Callout tone="danger">{(reingest.error as Error).message}</Callout>
              )}

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="space-y-6">
                  <CurrentPathEditor
                    user={detail.user}
                    canEdit={isAdmin}
                    busy={reingest.isPending}
                    onSave={(rawOrgPath) => reingest.mutate(rawOrgPath)}
                  />

                  <ProfileEditor
                    key={detail.user.personalNumber}
                    user={detail.user}
                    busy={profileUpdate.isPending}
                    success={profileUpdate.isSuccess}
                    error={profileUpdate.isError ? (profileUpdate.error as Error).message : undefined}
                    onSave={(draft) => profileUpdate.mutate(draft)}
                  />
                </div>

                <aside className="space-y-6">
                  {isAdmin && (
                    <AccessRoleEditor
                      user={detail.user}
                      busy={accessUpdate.isPending}
                      error={accessUpdate.isError ? (accessUpdate.error as Error).message : undefined}
                      onChange={(accessRole) => accessUpdate.mutate({ personalNumber: detail.user.personalNumber, accessRole })}
                    />
                  )}
                  <ProfileMetaPanel user={detail.user} />
                </aside>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {(detail.user.knownNames?.length ?? 0) > 0 && (
                  <InfoCard icon={Tags} title="שמות ידועים">
                    <div className="flex flex-wrap gap-2">
                      {detail.user.knownNames!.map((n) => <Badge key={n}>{n}</Badge>)}
                    </div>
                  </InfoCard>
                )}

                {(detail.user.sources?.length ?? 0) > 0 && (
                  <InfoCard icon={Database} title="מקורות ingest">
                    <div className="flex flex-wrap gap-2">
                      {detail.user.sources!.map((s) => <Badge key={s} variant="accent">{s}</Badge>)}
                    </div>
                  </InfoCard>
                )}

                {sourceSystemsForUser(detail.user).length > 0 && (
                  <InfoCard icon={Contact} title="מערכות מקור">
                    <div className="flex flex-wrap gap-2">
                      {sourceSystemsForUser(detail.user).map((s) => <Badge key={s} variant="accent">{s}</Badge>)}
                    </div>
                  </InfoCard>
                )}

                {isAdmin && (detail.user.rawPaths?.length ?? 0) > 0 && (
                  <InfoCard icon={Network} title="נתיבים גולמיים" wide>
                    <div className="space-y-3">
                      {detail.user.rawPaths!.map((p, i) => (
                        <p key={i} className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-[14px] font-semibold leading-relaxed text-slate-700">{p}</p>
                      ))}
                    </div>
                  </InfoCard>
                )}

                {isAdmin && detail.user.attributes && Object.keys(detail.user.attributes).length > 0 && (
                  <InfoCard icon={Database} title="מאפיינים" wide>
                    <Table>
                      <thead><tr><Th>שדה</Th><Th>ערך</Th></tr></thead>
                      <tbody>
                        {Object.entries(detail.user.attributes).map(([k, v]) => (
                          <Tr key={k}>
                            <Td className="font-bold text-slate-700">{k}</Td>
                            <Td className="max-w-[520px] whitespace-pre-wrap break-words font-mono text-[13px]">{formatProfileValue(v)}</Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </InfoCard>
                )}
              </div>

              {isAdmin && detail.history.length > 0 && (
                <InfoCard icon={History} title="היסטוריית מעבר" wide>
                  <Table>
                    <thead><tr><Th>מ</Th><Th>אל</Th><Th>תאריך</Th></tr></thead>
                    <tbody>
                      {detail.history.map((h, i) => (
                        <Tr key={i}>
                          <Td className="text-[15px] font-semibold text-slate-500">{h.fromPathText}</Td>
                          <Td className="text-[15px] font-bold">{h.toPathText}</Td>
                          <Td className="font-mono text-[14px] text-slate-500">{formatDate(h.changedAt)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </InfoCard>
              )}

              {isAdmin && detail.decisions && detail.decisions.length > 0 && (
                <InfoCard icon={BrainCircuit} title="החלטות AI" wide>
                  <Table>
                    <thead><tr><Th>ערך</Th><Th>פעולה</Th><Th>ביטחון</Th></tr></thead>
                    <tbody>
                      {detail.decisions.map((d) => (
                        <Tr key={d._id}>
                          <Td className="font-bold">{d.rawValue}</Td>
                          <Td className="text-slate-500">{actionLabel(d.action)}</Td>
                          <Td><Badge>{Math.round(d.confidence * 100)}%</Badge></Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </InfoCard>
              )}
            </div>
          )}
        </>
      )}
    </Page>
  );
}

function UserProfileHero({
  user,
  isAdminView,
  reingestBusy,
  onReingest,
}: {
  user: UserRecord;
  isAdminView: boolean;
  reingestBusy: boolean;
  onReingest: () => void;
}) {
  const orgUnitId = user.currentOrgUnitId ?? user.currentOrgPathIds?.slice(-1)[0] ?? '';
  const accessRole = user.accessRole ?? 'regular';
  const registeredVia = user.registeredVia ?? user.registeredSourceSystem ?? user.sourceSystem;

  return (
    <section className="surface overflow-hidden border border-border/80">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex min-w-0 items-start gap-5">
              <Avatar
                name={user.fullName}
                imageUrl={user.profileImageUrl}
                size="lg"
                className="h-20 w-20 rounded-2xl border border-border bg-[#111827] text-2xl text-white shadow-sm ring-0"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={accessRole === 'admin' ? 'success' : 'default'}>
                    <ShieldCheck className="ml-1 inline h-4 w-4" />
                    {ACCESS_ROLE_LABEL[accessRole]}
                  </Badge>
                  {user.rank && <Badge variant="accent">{user.rank}</Badge>}
                </div>
                <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-normal text-foreground md:text-4xl">
                  {user.fullName}
                </h2>
                <p className="mt-2 max-w-2xl text-[17px] font-medium leading-relaxed text-muted">
                  {user.role || 'לא הוגדר תפקיד'} · {lastPathSegment(user.currentOrgPathText)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-7 grid gap-3 md:grid-cols-3">
            <ProfileStat icon={Fingerprint} label="מספר אישי" value={user.personalNumber} mono />
            <ProfileStat icon={Clock3} label="נראה לאחרונה" value={optionalDate(user.lastSeenAt)} />
            <ProfileStat icon={Network} label="יחידה נוכחית" value={lastPathSegment(user.currentOrgPathText)} />
          </div>
        </div>

        <div className="border-t border-border bg-elevated/70 p-5 lg:border-r lg:border-t-0">
          <div className="flex items-center gap-2">
            <UserRoundCog className="h-5 w-5 text-muted" />
            <h3 className="text-[15px] font-semibold">פעולות מהירות</h3>
          </div>

          <div className="mt-4 grid gap-2">
            {orgUnitId && (
              <Link to={`/org-tree?unit=${orgUnitId}`}>
                <Button variant="secondary" className="w-full justify-start">
                  <Network className="h-4 w-4" />
                  הצג בעץ הארגוני
                </Button>
              </Link>
            )}
            {isAdminView && (user.rawPaths?.length ?? 0) > 0 && (
              <Button variant="secondary" disabled={reingestBusy} className="w-full justify-start" onClick={onReingest}>
                {reingestBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                הרץ ingest מחדש
              </Button>
            )}
          </div>

          <div className="mt-6 space-y-3">
            <CompactFact icon={Mail} label="אימייל" value={user.email || 'לא הוגדר'} />
            <CompactFact icon={Phone} label="טלפון" value={user.phone || 'לא הוגדר'} />
            <CompactFact icon={Contact} label="נרשם דרך" value={registeredVia || 'לא ידוע'} />
            <CompactFact icon={Database} label="עדכון אחרון דרך" value={user.sourceSystem || 'לא ידוע'} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfileStat({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-surface-2 px-4 py-3">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-muted">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className={cn('mt-1 truncate text-[15px] font-semibold text-foreground', mono && 'font-mono')}>
        {value}
      </p>
    </div>
  );
}

function CompactFact({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-subtle" />
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-subtle">{label}</p>
        <p className="truncate text-[14px] font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function ProfileMetaPanel({ user }: { user: UserRecord }) {
  return (
    <section className="surface overflow-hidden border border-border/80">
      <div className="border-b border-border bg-elevated/70 px-5 py-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-muted" />
          <h3 className="text-[15px] font-semibold">מידע מערכת</h3>
        </div>
      </div>
      <div className="divide-y divide-border">
        <MetaRow label="התחברות ראשונה" value={optionalDate(user.firstSeenAt)} />
        <MetaRow label="עדכון אחרון" value={optionalDate(user.lastSeenAt)} />
        <MetaRow label="מספר התחברויות" value={String(user.loginCount ?? 0)} />
        <MetaRow label="מערכות מקור" value={String(sourceSystemsForUser(user).length)} />
        <MetaRow label="שמות שמורים" value={String(user.knownNames?.length ?? 0)} />
        <MetaRow label="נתיבים גולמיים" value={String(user.rawPaths?.length ?? 0)} />
        <MetaRow label="תמונת פרופיל" value={user.profileImageUrl ? 'קיימת' : 'חסרה'} />
      </div>
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      <span className="min-w-0 truncate text-left text-[14px] font-medium text-foreground">{value}</span>
    </div>
  );
}

function ProfileEditor({
  user,
  busy,
  success,
  error,
  onSave,
}: {
  user: UserRecord;
  busy: boolean;
  success: boolean;
  error?: string;
  onSave: (draft: ProfileDraft) => void;
}) {
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromUser(user));
  const original = useMemo(() => draftFromUser(user), [user]);
  const dirty = Object.entries(draft).some(([key, value]) => value !== original[key as keyof ProfileDraft]);

  return (
    <section className="surface overflow-hidden border border-border/80">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-elevated/70 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Contact className="h-5 w-5 text-muted" />
            <h3 className="text-[17px] font-semibold">פרטים אישיים</h3>
          </div>
          <p className="mt-1 text-[14px] text-muted">שם, דרגה, תפקיד ופרטי קשר שיופיעו בפרופיל ובעץ.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={!dirty || busy} onClick={() => setDraft(original)}>
            בטל
          </Button>
          <Button disabled={!dirty || busy} onClick={() => onSave(draft)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            שמור פרטים
          </Button>
        </div>
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
        <Field label="שם פרטי" value={draft.firstName ?? ''} onChange={(firstName) => setDraft((d) => ({ ...d, firstName }))} />
        <Field label="שם משפחה" value={draft.lastName ?? ''} onChange={(lastName) => setDraft((d) => ({ ...d, lastName }))} />
        <Field label="דרגה" value={draft.rank ?? ''} onChange={(rank) => setDraft((d) => ({ ...d, rank }))} />
        <Field label="תפקיד" value={draft.role ?? ''} onChange={(role) => setDraft((d) => ({ ...d, role }))} />
        <Field label="אימייל" value={draft.email ?? ''} onChange={(email) => setDraft((d) => ({ ...d, email }))} />
        <Field label="טלפון" value={draft.phone ?? ''} onChange={(phone) => setDraft((d) => ({ ...d, phone }))} />
        <Field label="תמונת פרופיל" value={draft.profileImageUrl ?? ''} onChange={(profileImageUrl) => setDraft((d) => ({ ...d, profileImageUrl }))} />
      </div>

      {(success || error) && (
        <div className="px-5 pb-5">
          {success && <Callout tone="success">הפרטים נשמרו.</Callout>}
          {error && <Callout tone="danger">{error}</Callout>}
        </div>
      )}
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-muted">{label}</span>
      <Input className="h-11 text-[16px]" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function ProfileSectionHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-elevated/70 px-5 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted" />
          <h3 className="text-[17px] font-semibold">{title}</h3>
        </div>
        {description && <p className="mt-1 text-[14px] leading-relaxed text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function PathSegments({ segments }: { segments: string[] }) {
  if (!segments.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-elevated px-4 py-5 text-center text-[14px] font-medium text-muted">
        אין שיוך ארגוני
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {segments.map((segment, index) => (
        <span
          key={`${segment}-${index}`}
          className={cn(
            'inline-flex min-h-9 items-center rounded-xl border px-3 py-1.5 text-[13px] font-semibold',
            index === segments.length - 1
              ? 'border-brand/30 bg-brand-soft text-brand-text'
              : 'border-border bg-surface-2 text-muted'
          )}
        >
          {segment}
        </span>
      ))}
    </div>
  );
}

function CurrentPathEditor({
  user,
  canEdit,
  busy,
  onSave,
}: {
  user: UserRecord;
  canEdit: boolean;
  busy: boolean;
  onSave: (rawOrgPath: string) => void;
}) {
  const currentPath = user.currentOrgPathText || '';
  const [draft, setDraft] = useState(currentPath);
  const segments = pathSegments(currentPath);

  useEffect(() => {
    setDraft(currentPath);
  }, [currentPath, user.personalNumber]);

  const dirty = draft.trim() !== currentPath.trim();

  if (!canEdit) {
    return (
      <section className="surface overflow-hidden border border-border/80">
        <ProfileSectionHeader icon={Route} title="שיוך ארגוני" description="היחידה שבה המשתמש נמצא כרגע." />
        <div className="p-5">
          <PathSegments segments={segments} />
          <p className="mt-4 rounded-xl border border-border bg-elevated px-4 py-3 font-mono text-[14px] leading-relaxed text-foreground">
            {currentPath || 'לא משויך'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="surface overflow-hidden border border-border/80">
      <ProfileSectionHeader
        icon={Route}
        title="שיוך ארגוני"
        description="עדכון הנתיב יישלח לבדיקת AI לפני שינוי העץ."
        action={dirty ? <Badge variant="warning">שינוי ממתין</Badge> : undefined}
      />
      <div className="space-y-4 p-5">
        <PathSegments segments={segments} />
        <label className="block">
          <span className="mb-2 block text-[13px] font-semibold text-muted">נתיב נוכחי</span>
          <Textarea
            className="min-h-[112px] font-mono text-[14px] leading-relaxed"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="נתיב יחידה מלא..."
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!draft.trim() || !dirty || busy}
            onClick={() => onSave(draft.trim())}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            שלח נתיב ל-AI
          </Button>
          <Button
            variant="secondary"
            disabled={!dirty || busy}
            onClick={() => setDraft(currentPath)}
          >
            בטל שינוי
          </Button>
        </div>
      </div>
    </section>
  );
}

function AccessRoleEditor({
  user,
  busy,
  error,
  onChange,
}: {
  user: UserRecord;
  busy: boolean;
  error?: string;
  onChange: (accessRole: AccessRole) => void;
}) {
  const currentRole = user.accessRole ?? 'regular';
  const roles: AccessRole[] = ['admin', 'regular'];

  return (
    <section className="surface overflow-hidden border border-border/80">
      <ProfileSectionHeader
        icon={ShieldCheck}
        title="הרשאות"
        description="בחירת מצב הגישה של המשתמש במערכת."
      />

      <div className="grid gap-3 p-5">
        {roles.map((role) => {
          const active = currentRole === role;
          return (
            <button
              key={role}
              type="button"
              disabled={busy || active}
              onClick={() => onChange(role)}
              className={cn(
                'min-h-[88px] rounded-xl border px-4 py-3 text-right transition-all disabled:cursor-default',
                active
                  ? 'border-[#111827] bg-[#111827] text-white shadow-sm'
                  : 'border-border bg-surface text-foreground hover:border-brand/40 hover:bg-surface-2'
              )}
            >
              <span className="flex items-center justify-between gap-2 text-[15px] font-semibold">
                {ACCESS_ROLE_LABEL[role]}
                {active && <span className="text-[12px] text-white/70">פעיל</span>}
              </span>
              <span className={cn('mt-2 block text-[13px] leading-relaxed', active ? 'text-white/75' : 'text-muted')}>
                {ACCESS_ROLE_DESCRIPTION[role]}
              </span>
            </button>
          );
        })}
      </div>

      {(busy || error) && (
        <div className="px-5 pb-5">
          {busy && <Callout tone="info"><Loader2 className="ml-2 inline h-4 w-4 animate-spin" />מעדכן הרשאה...</Callout>}
          {error && <Callout tone="danger">{error}</Callout>}
        </div>
      )}
    </section>
  );
}

function InfoCard({
  icon: Icon,
  title,
  children,
  wide,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={cn('surface overflow-hidden border border-border/80', wide && 'lg:col-span-2')}>
      <div className="flex items-center gap-2 border-b border-border bg-elevated/70 px-5 py-4">
        <Icon className="h-5 w-5 text-muted" />
        <h3 className="text-[16px] font-semibold">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
