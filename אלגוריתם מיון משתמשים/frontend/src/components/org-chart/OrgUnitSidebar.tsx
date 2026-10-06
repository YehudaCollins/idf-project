import { useEffect, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  ChevronLeft,
  GitBranch,
  Loader2,
  Plus,
  Save,
  Shield,
  ShieldUser,
  BrainCircuit,
  Users,
  X,
} from 'lucide-react';
import type { CommanderSummary, OrgTreeNode, OrgUnitDetail, UserRecord } from '../../api/client';
import { api } from '../../api/client';
import { Badge, Button, Callout, Empty, Input } from '../../ui/primitives';
import { actionLabel, confidenceVariant } from '../../lib/labels';
import { ConfidenceBar } from '../ui/confidence-bar';
import { Avatar } from '../ui/avatar';
import { cn } from '../../lib/utils';

type Tab = 'overview' | 'edit' | 'users' | 'aliases' | 'ai';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'סקירה' },
  { id: 'users', label: 'חיילים' },
  { id: 'aliases', label: 'כינויים' },
  { id: 'ai', label: 'AI' },
];

export function OrgUnitSidebar({
  detail,
  onSelectUnit,
  onClose,
  editMode = false,
}: {
  detail: OrgUnitDetail;
  onSelectUnit: (id: string) => void;
  onClose?: () => void;
  editMode?: boolean;
}) {
  const { unit, parent, children, users, commander, decisions, reviews, permissions } = detail;
  const [tab, setTab] = useState<Tab>('overview');
  const [aliasInput, setAliasInput] = useState('');
  const [unitDraft, setUnitDraft] = useState({ canonicalName: unit.canonicalName, type: unit.type ?? '' });
  const [childDraft, setChildDraft] = useState({ canonicalName: '', type: '' });
  const [structureNotice, setStructureNotice] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);
  const qc = useQueryClient();
  const canViewUsers = permissions?.canViewUsers ?? true;
  const canEditStructure = permissions?.canEditStructure ?? false;
  const showManagementData = permissions?.actorRole !== 'regular';
  const pendingAliasReviews = reviews.filter((review) => review.changeType === 'alias_proposal' && review.status === 'needs_review');
  const visibleTabs = [
    TABS[0],
    ...(editMode ? [{ id: 'edit' as const, label: 'עריכה' }] : []),
    ...(permissions?.actorRole === 'regular'
      ? []
      : canViewUsers
        ? TABS.filter((item) => item.id !== 'overview' && item.id !== 'edit')
        : TABS.filter((item) => item.id !== 'overview' && item.id !== 'edit' && item.id !== 'users')),
  ];

  useEffect(() => {
    setUnitDraft({ canonicalName: unit.canonicalName, type: unit.type ?? '' });
    setChildDraft({ canonicalName: '', type: '' });
    setStructureNotice(null);
  }, [unit._id, unit.canonicalName, unit.type]);

  useEffect(() => {
    if (!visibleTabs.some((item) => item.id === tab)) setTab('overview');
  }, [tab, visibleTabs]);

  useEffect(() => {
    if (editMode) setTab('edit');
    if (!editMode && tab === 'edit') setTab('overview');
  }, [editMode, tab, unit._id]);

  const proposeAlias = useMutation({
    mutationFn: (value: string) => api.proposeAlias(unit._id, value),
    onSuccess: () => {
      setAliasInput('');
      qc.invalidateQueries({ queryKey: ['orgUnit', unit._id] });
      qc.invalidateQueries({ queryKey: ['reviews'] });
    },
  });

  const updateStructure = useMutation({
    mutationFn: () => api.updateOrgUnit(unit._id, unitDraft),
    onSuccess: (result) => {
      setStructureNotice({
        tone: result.status === 'needs_review' ? 'warning' : 'success',
        text: result.status === 'needs_review'
          ? `השינוי נשלח לבדיקת AI: ${result.reasons?.join(' · ') || 'ממתין לאישור לפני עדכון העץ'}`
          : 'פרטי היחידה עודכנו.',
      });
      qc.invalidateQueries({ queryKey: ['orgTree'] });
      qc.invalidateQueries({ queryKey: ['orgUnit', unit._id] });
      qc.invalidateQueries({ queryKey: ['reviews'] });
    },
  });

  const createChild = useMutation({
    mutationFn: () => api.createOrgChildUnit(unit._id, childDraft),
    onSuccess: (result) => {
      setStructureNotice({
        tone: result.status === 'needs_review' ? 'warning' : 'success',
        text: result.status === 'needs_review'
          ? `התת-יחידה נשלחה לבדיקת AI: ${result.reasons?.join(' · ') || 'ממתינה לאישור לפני כניסה לעץ'}`
          : 'התת-יחידה נוספה לעץ.',
      });
      setChildDraft({ canonicalName: '', type: '' });
      qc.invalidateQueries({ queryKey: ['orgTree'] });
      qc.invalidateQueries({ queryKey: ['orgUnit', unit._id] });
      qc.invalidateQueries({ queryKey: ['reviews'] });
    },
  });

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <header className="shrink-0 border-b border-border bg-white">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-brand-soft text-brand-text">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-brand-text">פרטי יחידה</p>
                <h2 className="text-[21px] font-semibold leading-snug text-slate-950">{unit.canonicalName}</h2>
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:bg-surface-2 hover:text-foreground"
                aria-label="סגור פרטים"
              >
                <X className="h-6 w-6" />
              </button>
            )}
          </div>

          <p className="mt-4 max-h-24 overflow-y-auto rounded-lg border border-border bg-slate-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-muted">
            {unit.pathText}
          </p>

          <div className={cn('mt-5 grid gap-3', canViewUsers ? 'grid-cols-3' : showManagementData ? 'grid-cols-2' : 'grid-cols-1')}>
            <HeaderStat icon={GitBranch} label="תת" value={children.length} />
            {canViewUsers && <HeaderStat icon={Users} label="חיילים" value={users.length} />}
            {showManagementData && <HeaderStat icon={BrainCircuit} label="AI" value={decisions.length} />}
          </div>
        </div>

        {reviews.length > 0 && (
          <Link
            to="/reviews"
            className="flex items-center gap-2 border-t border-amber-300/50 bg-amber-50/40 px-4 py-3 text-[13px] font-medium text-amber-950 hover:bg-amber-50/70"
          >
            <AlertCircle className="h-5 w-5" />
            {reviews.length} ביקורות פתוחות
            <ChevronLeft className="mr-auto h-5 w-5" />
          </Link>
        )}
      </header>

      {visibleTabs.length > 1 && (
      <div className="shrink-0 border-b border-border bg-white p-3.5">
        <div className="grid grid-flow-col auto-cols-fr gap-1 rounded-lg bg-slate-100 p-1">
          {visibleTabs.map((item) => {
            const count =
              item.id === 'users' ? users.length
              : item.id === 'aliases' ? unit.aliases?.length ?? 0
              : item.id === 'ai' ? decisions.length : undefined;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  'relative rounded-md px-2.5 py-2.5 text-[13px] font-semibold transition-colors',
                  active
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted hover:bg-white/70 hover:text-foreground'
                )}
              >
                {item.label}{count != null ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>
      </div>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto p-5">
        {tab === 'overview' && (
          <div className="space-y-5">
            {commander ? (
              <CommanderCard commander={commander} canOpenProfile={canViewUsers} />
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <SectionTitle icon={ShieldUser} title="מפקד היחידה" />
                <p className="mt-3 text-[15px] font-semibold text-slate-500">לא זוהה מפקד ליחידה הזו.</p>
              </div>
            )}

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle icon={BadgeCheck} title="סטטוס ומבנה" />
              <div className="mt-4 grid gap-3">
                <InfoRow label="יחידת אב">
                  {parent ? (
                    <button
                      type="button"
                      onClick={() => onSelectUnit(parent._id)}
                      className="text-right text-[14px] font-medium text-brand-text hover:underline"
                    >
                      {parent.canonicalName}
                    </button>
                  ) : (
                    <Badge variant="accent">שורש</Badge>
                  )}
                </InfoRow>
                <InfoRow label="סוג"><Badge>{unit.type ?? 'לא סווג'}</Badge></InfoRow>
                <InfoRow label="אימות">
                  {unit.isVerified ? (
                    <Badge variant="success"><Shield className="ml-1 inline h-4 w-4" /> מאומת</Badge>
                  ) : (
                    <Badge variant="warning">לא מאומת</Badge>
                  )}
                </InfoRow>
                {unit.dataQuality?.suspicious && (
                  <InfoRow label="איכות נתונים">
                    <Badge variant="danger">
                      <AlertCircle className="ml-1 inline h-4 w-4" />
                      {unit.dataQuality.reasons.join(' · ')}
                    </Badge>
                  </InfoRow>
                )}
              </div>
            </div>

            <PreviewSection title="תת-יחידות" icon={GitBranch} count={children.length} empty="אין תת-יחידות">
              <UnitList units={children} onSelectUnit={onSelectUnit} showUserCounts={canViewUsers} />
            </PreviewSection>

            {canViewUsers && (
              <PreviewSection
                title="חיילים ישירים ביחידה"
                icon={Users}
                count={users.length}
                empty="אין חיילים פיזית ביחידה הזו"
                actionLabel="הצג חיילים"
                onAction={() => setTab('users')}
              >
                <UserList users={users.slice(0, 4)} commander={commander} compact />
              </PreviewSection>
            )}
          </div>
        )}

        {tab === 'edit' && (
          <StructureEditor
            canEdit={canEditStructure}
            reason={permissions?.reason}
            unitDraft={unitDraft}
            childDraft={childDraft}
            onUnitDraftChange={setUnitDraft}
            onChildDraftChange={setChildDraft}
            onUpdate={() => updateStructure.mutate()}
            onCreate={() => createChild.mutate()}
            updateBusy={updateStructure.isPending}
            createBusy={createChild.isPending}
            updateError={updateStructure.isError ? (updateStructure.error as Error).message : undefined}
            createError={createChild.isError ? (createChild.error as Error).message : undefined}
            notice={structureNotice}
          />
        )}

        {tab === 'users' && (
          users.length === 0 ? (
            <Empty title="אין חיילים ביחידה זו" description="חיילים מוצגים רק ביחידה שבה הם משובצים פיזית. בדוק תת-יחידות." />
          ) : (
            <div className="space-y-4">
              <Callout tone="info">מוצגים כאן רק חיילים שמשויכים פיזית ליחידה הזו.</Callout>
              <UserList users={users} commander={commander} />
            </div>
          )
        )}

        {tab === 'aliases' && (
          <div className="space-y-5">
            <div className="rounded-lg border border-brand/20 bg-brand-soft p-4 shadow-sm">
              <SectionTitle icon={Plus} title="הצע כינוי חדש" />
              <div className="mt-4 flex gap-3">
                <Input
                  placeholder="ערך כינוי..."
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  className="text-[16px]"
                />
                <Button disabled={!aliasInput.trim() || proposeAlias.isPending} onClick={() => proposeAlias.mutate(aliasInput.trim())}>
                  {proposeAlias.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                </Button>
              </div>
              {proposeAlias.isSuccess && (
                <Callout tone="success" className="mt-4">נשלח לביקורת</Callout>
              )}
            </div>

            {!unit.aliases?.length ? (
              <Empty title="אין כינויים" />
            ) : (
              <ul className="space-y-3">
                {unit.aliases.map((a, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
                    <span className="text-[16px] font-semibold text-slate-900">{a.value}</span>
                    <Badge variant={a.status === 'active' ? 'success' : 'default'}>{a.status}</Badge>
                  </li>
                ))}
              </ul>
            )}

            {pendingAliasReviews.length > 0 && (
              <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 p-4 shadow-sm">
                <SectionTitle icon={AlertCircle} title="כינויים ממתינים לביקורת" />
                <ul className="mt-3 space-y-2">
                  {pendingAliasReviews.map((review) => (
                    <li key={review._id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white px-3 py-2">
                      <span className="min-w-0 truncate text-[14px] font-semibold text-amber-950">
                        {review.proposedAlias || review.rawValue || 'כינוי'}
                      </span>
                      <Badge variant="warning">ממתין</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === 'ai' && (
          decisions.length === 0 ? (
            <Empty title="אין החלטות" description="AI טרם החליט על יחידה זו" />
          ) : (
            <ul className="space-y-4">
              {decisions.slice(0, 12).map((d) => (
                <li key={d._id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[17px] font-semibold text-foreground">{d.rawValue}</p>
                      <p className="mt-1 text-[14px] font-semibold text-slate-500">{actionLabel(d.action)}</p>
                    </div>
                    <Badge variant={confidenceVariant(d.confidence)}>{Math.round(d.confidence * 100)}%</Badge>
                  </div>
                  <ConfidenceBar value={d.confidence} className="mt-4" />
                  {d.reason && <p className="mt-3 text-[14px] font-semibold leading-relaxed text-slate-600">{d.reason}</p>}
                </li>
              ))}
            </ul>
          )
        )}
      </main>
    </div>
  );
}

function HeaderStat({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-slate-50 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
        <Icon className="h-4 w-4" />{label}
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function CommanderCard({ commander, canOpenProfile }: { commander: CommanderSummary; canOpenProfile: boolean }) {
  const content = (
    <>
      <SectionTitle icon={ShieldUser} title="מפקד היחידה" />
      <div className="mt-4 flex items-center gap-4">
        <Avatar name={commander.fullName} imageUrl={commander.profileImageUrl} size="md" className="rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold">{commander.fullName}</p>
          <p className="mt-1 text-[14px] text-muted">
            {[commander.rank, commander.role].filter(Boolean).join(' · ') || 'ללא דרגה/תפקיד'}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-subtle">{commander.personalNumber}</p>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-border bg-surface-2 px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-3 text-[13px] text-muted">
          <span>{commander.reason}</span>
          <span className="font-mono text-brand-text">{Math.round(commander.confidence * 100)}%</span>
        </div>
      </div>
    </>
  );

  if (!canOpenProfile) {
    return <div className="rounded-lg border border-brand/20 bg-surface p-4 shadow-sm">{content}</div>;
  }

  return (
    <Link
      to={`/users?pn=${commander.personalNumber}`}
      className="block rounded-lg border border-brand/20 bg-surface p-4 shadow-sm transition-colors hover:border-brand/30 hover:bg-brand-soft/40"
    >
      {content}
    </Link>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2 text-muted">
        <Icon className="h-4 w-4" />
      </span>
      <h3 className="text-[15px] font-semibold">{title}</h3>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3.5">
      <span className="text-[13px] font-medium text-muted">{label}</span>
      <div className="min-w-0 text-[15px] font-semibold">{children}</div>
    </div>
  );
}

function StructureEditor({
  canEdit,
  reason,
  unitDraft,
  childDraft,
  onUnitDraftChange,
  onChildDraftChange,
  onUpdate,
  onCreate,
  updateBusy,
  createBusy,
  updateError,
  createError,
  notice,
}: {
  canEdit: boolean;
  reason?: string;
  unitDraft: { canonicalName: string; type: string };
  childDraft: { canonicalName: string; type: string };
  onUnitDraftChange: (draft: { canonicalName: string; type: string }) => void;
  onChildDraftChange: (draft: { canonicalName: string; type: string }) => void;
  onUpdate: () => void;
  onCreate: () => void;
  updateBusy: boolean;
  createBusy: boolean;
  updateError?: string;
  createError?: string;
  notice: { tone: 'success' | 'warning'; text: string } | null;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <SectionTitle icon={GitBranch} title="עריכת מבנה" />
      <div className="mt-4 space-y-4">
        {!canEdit ? (
          <Callout tone="info">
            מצב עריכה פתוח רק למנהל או למפקד בתחום הפיקוד שלו. {reason ? `סיבה: ${reason}` : ''}
          </Callout>
        ) : (
          <>
            <Callout tone="info">
              כל שינוי נשלח קודם לבדיקת AI. העץ יתעדכן רק אחרי אישור הביקורת, ואז גם נתיבי הצאצאים והמשתמשים יתיישרו בהתאם.
            </Callout>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <p className="text-[18px] font-semibold text-foreground">פרטי היחידה</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px]">
                <Input
                  value={unitDraft.canonicalName}
                  onChange={(e) => onUnitDraftChange({ ...unitDraft, canonicalName: e.target.value })}
                  placeholder="שם יחידה"
                />
                <Input
                  value={unitDraft.type}
                  onChange={(e) => onUnitDraftChange({ ...unitDraft, type: e.target.value })}
                  placeholder="סוג"
                />
              </div>
              <Button
                className="mt-3 w-full"
                variant="secondary"
                disabled={!unitDraft.canonicalName.trim() || updateBusy}
                onClick={onUpdate}
              >
                {updateBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                שלח עדכון ל-AI
              </Button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <p className="text-[18px] font-semibold text-foreground">תת-יחידה חדשה</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px]">
                <Input
                  value={childDraft.canonicalName}
                  onChange={(e) => onChildDraftChange({ ...childDraft, canonicalName: e.target.value })}
                  placeholder="שם תת-יחידה"
                />
                <Input
                  value={childDraft.type}
                  onChange={(e) => onChildDraftChange({ ...childDraft, type: e.target.value })}
                  placeholder="סוג"
                />
              </div>
              <Button
                className="mt-3 w-full"
                disabled={!childDraft.canonicalName.trim() || createBusy}
                onClick={onCreate}
              >
                {createBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                שלח תת-יחידה ל-AI
              </Button>
            </div>
          </>
        )}

        {notice && <Callout tone={notice.tone}>{notice.text}</Callout>}
        {updateError && <Callout tone="danger">{updateError}</Callout>}
        {createError && <Callout tone="danger">{createError}</Callout>}
      </div>
    </section>
  );
}

function PreviewSection({
  title,
  icon,
  count,
  empty,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  count: number;
  empty: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  const Icon = icon;

  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <SectionTitle icon={Icon} title={title} />
        <div className="flex items-center gap-2">
          <Badge>{count}</Badge>
          {count > 0 && actionLabel && onAction && (
            <button type="button" onClick={onAction} className="text-[16px] font-semibold text-brand-text hover:underline">
              {actionLabel}
            </button>
          )}
        </div>
      </div>
      <div className="mt-4">
        {count === 0 ? <p className="text-[17px] font-semibold text-slate-500">{empty}</p> : children}
      </div>
    </section>
  );
}

function UnitList({
  units,
  onSelectUnit,
  showUserCounts,
}: {
  units: OrgTreeNode[];
  onSelectUnit: (id: string) => void;
  showUserCounts: boolean;
}) {
  if (!units.length) return null;

  return (
    <ul className="space-y-3">
      {units.map((unit) => (
        <li key={unit._id}>
          <button
            type="button"
            onClick={() => onSelectUnit(unit._id)}
            className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3.5 text-right shadow-sm transition-colors hover:border-border-focus hover:bg-surface-2"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-muted">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{unit.canonicalName}</p>
              <p className="mt-1 text-[13px] text-muted">
                {showUserCounts
                  ? `${unit.stats?.userCount ?? 0} חיילים · ${unit.children?.length ?? 0} תתי-יחידות`
                  : `${unit.children?.length ?? 0} תתי-יחידות`}
              </p>
            </div>
            <ChevronLeft className="h-6 w-6 shrink-0 text-slate-400" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function UserList({
  users,
  commander,
  compact,
}: {
  users: UserRecord[];
  commander?: CommanderSummary | null;
  compact?: boolean;
}) {
  if (!users.length) return null;

  return (
    <ul className="space-y-3">
      {users.map((user) => {
        const isCommander = commander?.personalNumber === user.personalNumber;
        return (
          <li key={user.personalNumber}>
            <Link
              to={`/users?pn=${user.personalNumber}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3.5 shadow-sm transition-colors hover:border-border-focus hover:bg-surface-2"
            >
              <Avatar name={user.fullName} imageUrl={user.profileImageUrl} size="sm" className="rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[15px] font-semibold">{user.fullName}</p>
                  {isCommander && <Badge variant="success">מפקד</Badge>}
                </div>
                <p className="mt-1 text-[13px] text-muted">
                  {[user.rank, user.role].filter(Boolean).join(' · ') || 'ללא דרגה/תפקיד'}
                </p>
                {!compact && <p className="mt-0.5 font-mono text-[11px] text-subtle">{user.personalNumber}</p>}
              </div>
              <ChevronLeft className="h-4 w-4 text-subtle" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function OrgUnitSidebarEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-surface-2 px-8 text-center">
      <Building2 className="mb-4 h-8 w-8 text-subtle" />
      <p className="text-[15px] font-medium">בחר יחידה בתרשים</p>
      <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-muted">
        הפרטים ייפתחו כאן עם מפקד, חיילים ישירים, תת-יחידות והחלטות AI.
      </p>
    </div>
  );
}
