import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, Clock, Building2, Filter } from 'lucide-react';
import { api, type CommanderSnapshot, type ReviewItem } from '../api/client';
import {
  Page,
  Spinner,
  Card,
  Button,
  Badge,
  Tabs,
  Textarea,
  Empty,
  Callout,
  StatCard,
} from '../ui/primitives';
import { formatDate } from '../lib/utils';
import { ConfidenceBar } from '../components/ui/confidence-bar';
import { cn } from '../lib/utils';

const TYPE_LABELS: Record<string, string> = {
  conflict_match: 'קונפליקט התאמה',
  medium_confidence: 'ביטחון בינוני',
  alias_proposal: 'הצעת כינוי',
  structure_update: 'עדכון מבנה',
  structure_create: 'יחידה חדשה',
  commander_change: 'שינוי מפקד',
};

const TYPE_FILTER_ALL = 'all';
const CREATE_NEW_UNIT = '__create_new_unit__';
const USER_ROUTE_REVIEW_TYPES = new Set(['conflict_match', 'medium_confidence', 'alias_proposal']);

function ReviewCard({
  item,
  mode,
  busy,
  onApprove,
  onReject,
}: {
  item: ReviewItem;
  mode: 'needs_review' | 'approved' | 'rejected';
  busy: boolean;
  onApprove: (id: string, unitId?: string, note?: string, resolution?: 'existing' | 'create_new') => void;
  onReject: (id: string, note?: string) => void;
}) {
  const [unitId, setUnitId] = useState(item.conflict?.candidates?.[0]?.unitId ?? item.targetUnitId ?? '');
  const [note, setNote] = useState('');
  const readOnly = mode !== 'needs_review';
  const canCreateNew = USER_ROUTE_REVIEW_TYPES.has(item.changeType) && !!(item.rawValue || item.conflict?.rawValue || item.proposedAlias);
  const createNewLabel = item.rawValue || item.conflict?.rawValue || item.proposedAlias || 'יחידה חדשה';
  const createNewSelected = unitId === CREATE_NEW_UNIT;
  const approvesWithoutExistingUnit = item.changeType === 'structure_create' || item.changeType === 'structure_update' || item.changeType === 'commander_change';
  const canApprove = createNewSelected || !!unitId || approvesWithoutExistingUnit;

  const badgeVariant = mode === 'approved' ? 'success' : mode === 'rejected' ? 'danger' : 'warning';
  const badgeLabel = mode === 'approved' ? 'אושר' : mode === 'rejected' ? 'נדחה' : 'ממתין';
  const unitLinkId = item.selectedUnitId ?? item.targetUnitId ?? unitId;

  return (
    <article className="card overflow-hidden">
      <div className="px-6 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge variant={badgeVariant}>{badgeLabel}</Badge>
            <h3 className="mt-2 text-[14px] font-semibold">{TYPE_LABELS[item.changeType] ?? item.changeType}</h3>
            <p className="mt-1 text-[13px] text-muted">{item.reason}</p>
          </div>
          <span className="flex items-center gap-1 font-mono text-[12px] text-subtle">
            <Clock className="h-3.5 w-3.5" />
            {formatDate(item.createdAt)}
          </span>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {item.rawValue && (
          <div className="rounded-xl bg-surface-2 px-4 py-3">
            <p className="text-xs font-medium text-subtle">ערך גולמי</p>
            <p className="mt-1 text-[15px] font-medium">{item.rawValue}</p>
          </div>
        )}

        {item.proposedAlias && item.proposedAlias !== item.rawValue && (
          <div className="rounded-xl bg-surface-2 px-4 py-3">
            <p className="text-xs font-medium text-subtle">כינוי מוצע</p>
            <p className="mt-1 text-[15px] font-medium">{item.proposedAlias}</p>
          </div>
        )}

        {item.proposedType && (
          <div className="rounded-xl bg-surface-2 px-4 py-3">
            <p className="text-xs font-medium text-subtle">סוג מוצע</p>
            <p className="mt-1 text-[15px] font-medium">{item.proposedType}</p>
          </div>
        )}

        {item.targetCanonicalName && (
          <div className="flex flex-wrap items-center justify-between gap-3 border border-border px-4 py-3">
            <span className="text-[14px] text-muted">
              יחידת יעד: <strong className="text-foreground">{item.targetCanonicalName}</strong>
            </span>
            {unitLinkId && (
              <Link to={`/org-tree?unit=${unitLinkId}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline">
                <Building2 className="h-3.5 w-3.5" />
                בעץ
              </Link>
            )}
          </div>
        )}

        {item.commanderChange && (
          <div className="space-y-3 border border-border bg-surface px-4 py-4">
            <div>
              <p className="text-xs font-semibold text-subtle">שינוי מפקד מוצע</p>
              <p className="mt-1 text-[15px] font-semibold text-foreground">{item.commanderChange.unitName}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <CommanderSnapshotCard
                title="מפקד קודם"
                commander={item.commanderChange.previousCommander}
                empty="לא היה מפקד שמור"
              />
              <CommanderSnapshotCard
                title="מפקד מוצע"
                commander={item.commanderChange.proposedCommander}
                highlight
              />
            </div>
          </div>
        )}

        {item.confidence != null && <ConfidenceBar value={item.confidence} />}

        {item.affectedUsersCount != null && item.affectedUsersCount > 0 && (
          <p className="text-[13px] text-muted">{item.affectedUsersCount} משתמשים מושפעים</p>
        )}

        {readOnly && item.reviewedAt && (
          <div className="flex items-center gap-2 text-[13px] text-muted">
            <Clock className="h-3.5 w-3.5" />
            {formatDate(item.reviewedAt)}
            {item.reviewedBy && <span>· {item.reviewedBy}</span>}
          </div>
        )}

        {readOnly && item.reviewNote && (
          <p className="border border-border bg-elevated px-4 py-3 text-[14px] text-muted">{item.reviewNote}</p>
        )}

        {!readOnly && !!item.conflict?.candidates?.length && (
          <div className="space-y-2">
            <p className="text-[12px] font-semibold text-muted">בחר לאן להחיל את התיקון</p>
            {item.conflict.candidates.map((c) => {
              const aiChoice = c.unitId === item.targetUnitId || (!item.targetUnitId && item.conflict?.candidates?.[0]?.unitId === c.unitId);
              return (
                <label
                  key={c.unitId}
                  className="flex cursor-pointer items-center gap-3 border border-border bg-surface p-3 transition-colors hover:border-border-strong has-[:checked]:border-accent-line has-[:checked]:bg-accent-soft/40"
                >
                  <input type="radio" checked={unitId === c.unitId} onChange={() => setUnitId(c.unitId)} className="h-3.5 w-3.5 accent-accent-line" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{c.canonicalName}</span>
                    {aiChoice && <span className="mt-0.5 block text-[12px] text-muted">בחירת AI נוכחית</span>}
                  </span>
                  <Badge variant={aiChoice ? 'accent' : 'default'}>{Math.round(c.confidence * 100)}%</Badge>
                </label>
              );
            })}
          </div>
        )}

        {!readOnly && canCreateNew && (
          <label className="flex cursor-pointer items-center gap-3 border border-dashed border-accent-line bg-accent-soft/40 p-3 transition-colors hover:bg-accent-soft/70 has-[:checked]:border-accent-line has-[:checked]:bg-accent-soft">
            <input
              type="radio"
              checked={createNewSelected}
              onChange={() => setUnitId(CREATE_NEW_UNIT)}
              className="h-3.5 w-3.5 accent-accent-line"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-foreground">צור יחידה חדשה</span>
              <span className="mt-0.5 block truncate text-[12px] text-muted">{createNewLabel}</span>
            </span>
            <Badge variant="warning">חדש</Badge>
          </label>
        )}

        {!readOnly && (
          <>
            <Textarea placeholder="הערה (אופציונלי)..." value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                disabled={busy || !canApprove}
                onClick={() => onApprove(item._id, createNewSelected ? undefined : unitId, note, createNewSelected ? 'create_new' : 'existing')}
              >
                <Check className="h-4 w-4" />
                {createNewSelected || item.changeType === 'structure_create'
                  ? 'אישור + יצירה'
                  : item.changeType === 'structure_update'
                    ? 'אישור + עדכון'
                    : item.changeType === 'commander_change'
                      ? 'אישור מפקד'
                      : 'אישור + החלה'}
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => onReject(item._id, note)}>
                <X className="h-4 w-4" />
                דחייה
              </Button>
            </div>
          </>
        )}
      </div>
    </article>
  );
}

function CommanderSnapshotCard({
  title,
  commander,
  empty,
  highlight = false,
}: {
  title: string;
  commander?: CommanderSnapshot;
  empty?: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn('border px-3 py-3', highlight ? 'border-accent-line bg-accent-soft/40' : 'border-border bg-elevated')}>
      <p className="text-[12px] font-semibold text-subtle">{title}</p>
      {commander ? (
        <>
          <p className="mt-1 truncate text-[15px] font-semibold">{commander.fullName}</p>
          <p className="mt-0.5 truncate text-[12px] text-muted">
            {[commander.rank, commander.role].filter(Boolean).join(' · ') || 'ללא דרגה/תפקיד'}
          </p>
          <p className="mt-2 font-mono text-[11px] text-subtle">{commander.personalNumber}</p>
        </>
      ) : (
        <p className="mt-1 text-[13px] text-muted">{empty ?? 'לא ידוע'}</p>
      )}
    </div>
  );
}

export function ReviewsPage() {
  const [tab, setTab] = useState<'needs_review' | 'approved' | 'rejected'>('needs_review');
  const [typeFilter, setTypeFilter] = useState(TYPE_FILTER_ALL);
  const [flash, setFlash] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['reviews', tab],
    queryFn: () => api.reviews(tab),
  });

  const { data: pendingList } = useQuery({
    queryKey: ['reviews', 'needs_review'],
    queryFn: () => api.reviews('needs_review'),
  });

  const filtered = (data ?? []).filter((r) => typeFilter === TYPE_FILTER_ALL || r.changeType === typeFilter);

  const typeCounts = (data ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.changeType] = (acc[r.changeType] ?? 0) + 1;
    return acc;
  }, {});

  const approve = useMutation({
    mutationFn: ({ id, unitId, note, resolution }: { id: string; unitId?: string; note?: string; resolution?: 'existing' | 'create_new' }) =>
      api.approveReview(id, { selectedUnitId: unitId, note, resolution }),
    onSuccess: (updated) => {
      const userUpdated = updated.reingestedUser && !updated.reingestedUser.error && updated.reingestedUser.expectedUnitApplied !== false;
      const userUpdateWarning = updated.reingestedUser && !updated.reingestedUser.error && updated.reingestedUser.expectedUnitApplied === false
        ? updated.reingestedUser.forcedSelectedUnit?.reason || 'הבחירה נלמדה, אבל המשתמש לא עבר בפועל ליחידה שנבחרה'
        : null;
      const noteApplied = (updated.noteActions?.length ?? 0) > 0;
      const aliasText = updated.aliasValue ?? updated.rawValue ?? updated.proposedAlias ?? '';
      setFlash(
        userUpdateWarning
          ? `הביקורת אושרה — ${userUpdateWarning}`
          : updated.aliasAdded
          ? `הביקורת אושרה — הכינוי "${aliasText}" נוסף ליחידה${userUpdated ? ' והמשתמש עודכן בפועל' : ''}${noteApplied ? ' · ההערה הוחלה' : ''}`
          : updated.aliasAlreadyExisted
            ? `הביקורת אושרה — הכינוי "${aliasText}" כבר קיים ביחידה${userUpdated ? ' והמשתמש עודכן בפועל' : ''}${noteApplied ? ' · ההערה הוחלה' : ''}`
            : updated.createdNew
            ? `הביקורת אושרה — יחידה חדשה נוצרה${noteApplied ? ' לפי ההערה' : ''}`
            : updated.changeType === 'commander_change'
              ? `הביקורת אושרה — ${updated.commanderChange?.proposedCommander.fullName ?? 'המפקד החדש'} הוגדר כמפקד היחידה${noteApplied ? ' לפי ההערה' : ''}`
            : userUpdated
              ? `הביקורת אושרה — ${updated.reingestedUser?.fullName ?? 'המשתמש'} עודכן בפועל${noteApplied ? ' · ההערה הוחלה' : ''}`
              : `הביקורת אושרה — הבחירה נלמדה למנוע ההתאמה${noteApplied ? ' · ההערה הוחלה' : ''}`
      );
      setTimeout(() => setFlash(null), 4000);
      qc.invalidateQueries({ queryKey: ['reviews'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['orgTree'] });
      qc.invalidateQueries({ queryKey: ['orgUnit'] });
      qc.invalidateQueries({ queryKey: ['aiDecisions'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['user'] });
    },
  });

  const reject = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => api.rejectReview(id, { note }),
    onSuccess: () => {
      setFlash('הביקורת נדחתה');
      setTimeout(() => setFlash(null), 3000);
      qc.invalidateQueries({ queryKey: ['reviews'] });
    },
  });

  if (isLoading) return <Spinner />;

  return (
    <Page title="מרכז ביקורת" description="אישור ביקורת מחיל את הבחירה שלך בפועל, ואז מלמד את מנוע ההתאמה להמשך.">
      {flash && (
        <Callout tone="success" className="mb-5">
          {flash}
        </Callout>
      )}

      {tab === 'needs_review' && pendingList && (
        <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-5">
          <StatCard label="ממתינים" value={pendingList.length} />
          <StatCard label="קונפליקטים" value={pendingList.filter((r) => r.changeType === 'conflict_match').length} />
          <StatCard label="ביטחון בינוני" value={pendingList.filter((r) => r.changeType === 'medium_confidence').length} />
          <StatCard label="כינויים" value={pendingList.filter((r) => r.changeType === 'alias_proposal').length} />
          <StatCard label="מפקדים" value={pendingList.filter((r) => r.changeType === 'commander_change').length} />
        </div>
      )}

      <section className="mb-6 surface p-5">
        <Tabs
          items={[
            { id: 'needs_review', label: 'ממתינים', count: pendingList?.length },
            { id: 'approved', label: 'אושרו' },
            { id: 'rejected', label: 'נדחו' },
          ]}
          value={tab}
          onChange={(id) => { setTab(id as typeof tab); setTypeFilter(TYPE_FILTER_ALL); }}
        />

        {(data?.length ?? 0) > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Filter className="h-4 w-4 text-subtle" />
            <FilterButton active={typeFilter === TYPE_FILTER_ALL} onClick={() => setTypeFilter(TYPE_FILTER_ALL)}>
              הכל ({data!.length})
            </FilterButton>
            {Object.entries(TYPE_LABELS).map(([id, label]) =>
              typeCounts[id] ? (
                <FilterButton key={id} active={typeFilter === id} onClick={() => setTypeFilter(id)}>
                  {label} ({typeCounts[id]})
                </FilterButton>
              ) : null
            )}
          </div>
        )}
      </section>

      {!filtered.length ? (
        <Card>
          <Empty
            title={tab === 'needs_review' ? 'אין ביקורות פתוחות' : 'אין פריטים'}
            description={tab === 'needs_review' ? 'הרץ תרחישי fuzzy או conflict בדמו כדי לראות פריטים.' : undefined}
          />
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {filtered.map((r) => (
            <ReviewCard
              key={r._id}
              item={r}
              mode={tab}
              busy={approve.isPending || reject.isPending}
              onApprove={(id, unitId, note, resolution) => approve.mutate({ id, unitId, note, resolution })}
              onReject={(id, note) => reject.mutate({ id, note })}
            />
          ))}
        </div>
      )}
    </Page>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-brand-soft text-brand-text' : 'bg-surface-2 text-muted hover:bg-surface'
      )}
    >
      {children}
    </button>
  );
}
