import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Users,
  GitBranch,
  Shield,
  AlertCircle,
  History,
  ArrowUpLeft,
  MapPin,
  ChevronLeft,
  ExternalLink,
  Plus,
  Loader2,
} from 'lucide-react';
import type { OrgUnitDetail } from '../api/client';
import { api } from '../api/client';
import { Badge } from './ui/badge';
import { Card, CardBody } from './ui/card';
import { Avatar } from './ui/avatar';
import { ConfidenceBar } from './ui/confidence-bar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { actionLabel } from '../lib/labels';
import { cn } from '../lib/utils';

type Tab = 'overview' | 'users' | 'aliases' | 'decisions' | 'reviews';

export function UnitDetailPanel({
  detail,
  onSelectUnit,
  compact,
}: {
  detail: OrgUnitDetail;
  onSelectUnit?: (id: string) => void;
  compact?: boolean;
}) {
  const { unit, parent, children, users, commander, decisions, reviews } = detail;
  const [tab, setTab] = useState<Tab>('overview');
  const [aliasInput, setAliasInput] = useState('');
  const [aliasMsg, setAliasMsg] = useState<string | null>(null);
  const qc = useQueryClient();

  const proposeAlias = useMutation({
    mutationFn: (value: string) => api.proposeAlias(unit._id, value, 'admin'),
    onSuccess: () => {
      setAliasInput('');
      setAliasMsg('הצעת כינוי נשלחה לביקורת');
      qc.invalidateQueries({ queryKey: ['orgUnit', unit._id] });
      qc.invalidateQueries({ queryKey: ['reviews'] });
      qc.invalidateQueries({ queryKey: ['orgTree'] });
    },
    onError: (e: Error) => setAliasMsg(e.message),
  });

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'סקירה' },
    { id: 'users', label: 'חיילים ביחידה', count: users.length },
    { id: 'aliases', label: 'כינויים', count: unit.aliases?.length },
    { id: 'decisions', label: 'AI', count: decisions.length },
    { id: 'reviews', label: 'ביקורות', count: reviews.length },
  ];

  return (
    <Card className={cn('overflow-hidden shadow-lg', compact && 'shadow-none ring-1 ring-slate-200/80')}>
      <div
        className={cn(
          'relative overflow-hidden border-b border-border bg-white text-slate-900',
          compact ? 'px-4 py-4' : 'px-5 py-5'
        )}
      >
        <div className="relative">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-100">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[16px] font-semibold leading-snug">{unit.canonicalName}</h3>
              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-teal-700" />
                <span className="break-all">{unit.pathText}</span>
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <HeaderStat icon={GitBranch} label="תת-יחידות" value={children.length} />
            <HeaderStat icon={Users} label="חיילים ביחידה" value={users.length} />
          </div>
        </div>
      </div>

      {reviews.length > 0 && (
        <Link
          to="/reviews"
          className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-5 py-2.5 text-[12px] font-bold text-red-800 transition-colors hover:bg-red-100/80"
        >
          <AlertCircle className="h-4 w-4" />
          {reviews.length} ביקורות פתוחות — לטיפול
          <ChevronLeft className="mr-auto h-4 w-4" />
        </Link>
      )}

      <div className="flex gap-0.5 overflow-x-auto border-b border-slate-100 bg-slate-50/80 px-2 py-1.5 scroll-fade-x">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'shrink-0 rounded-md px-3 py-2 text-[12px] font-bold transition-all',
              tab === t.id
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            )}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="mr-1.5 font-mono text-[10px] text-teal-700">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      <CardBody className={cn('max-h-none overflow-visible p-4', compact && 'p-3')}>
        {tab === 'overview' && (
          <div className="space-y-5">
            <InfoRow label="יחידת אב">
              {parent ? (
                onSelectUnit ? (
                  <button
                    type="button"
                    onClick={() => onSelectUnit(parent._id)}
                    className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline"
                  >
                    {parent.canonicalName}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                ) : (
                  <span className="font-semibold text-slate-800">{parent.canonicalName}</span>
                )
              ) : (
                <Badge variant="info">שורש</Badge>
              )}
            </InfoRow>

            <InfoRow label="אימות">
              {unit.isVerified ? (
                <Badge variant="success" className="gap-1">
                  <Shield className="h-3 w-3" />
                  {unit.verificationStatus || 'מאומת'}
                </Badge>
              ) : (
                <Badge variant="warning" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {unit.verificationStatus || 'לא מאומת'}
                </Badge>
              )}
            </InfoRow>

            {unit.dataQuality?.suspicious && (
              <InfoRow label="איכות נתונים">
                <Badge variant="danger" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {unit.dataQuality.reasons.join(' · ')}
                </Badge>
              </InfoRow>
            )}

            {commander && (
              <InfoRow label="מפקד משוער">
                <Link
                  to={`/users?pn=${commander.personalNumber}`}
                  className="text-right font-semibold text-teal-700 hover:underline"
                >
                  <span>{commander.fullName}</span>
                  <span className="block text-[10px] font-medium text-slate-400">
                    {[commander.rank, commander.role, commander.reason].filter(Boolean).join(' · ')}
                  </span>
                </Link>
              </InfoRow>
            )}

            {children.length > 0 && (
              <section>
                <h4 className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  תת-יחידות
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {children.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => onSelectUnit?.(c._id)}
                      className="rounded-md bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200 transition-all hover:bg-teal-50 hover:text-teal-800 hover:ring-teal-200"
                    >
                      {c.canonicalName}
                      {(c.stats?.userCount ?? 0) > 0 && (
                        <span className="mr-1 text-slate-400">· {c.stats.userCount} חיילים</span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {tab === 'users' && (
          <>
            {users.length === 0 ? (
              <EmptyTab text="אין חיילים שמשויכים פיזית ליחידה זו" />
            ) : (
              <ul className="space-y-2">
                {users.map((u) => (
                  <li key={u.personalNumber}>
                    <Link
                      to={`/users?pn=${u.personalNumber}`}
                      className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 transition-all hover:border-teal-200 hover:bg-teal-50/40"
                    >
                      <Avatar name={u.fullName} imageUrl={u.profileImageUrl} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-bold text-slate-900">{u.fullName}</p>
                          {commander?.personalNumber === u.personalNumber && (
                            <Badge variant="success" className="px-1.5 py-0 text-[9px]">מפקד</Badge>
                          )}
                        </div>
                        <p className="text-[11px] font-semibold text-slate-500">
                          {[u.rank, u.role].filter(Boolean).join(' · ') || 'ללא דרגה/תפקיד'}
                        </p>
                        <p className="font-mono text-[10px] text-slate-300">{u.personalNumber}</p>
                      </div>
                      <ChevronLeft className="h-4 w-4 text-slate-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'aliases' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-teal-100 bg-teal-50/70 p-3">
              <p className="mb-2 text-[11px] font-bold text-teal-800">הצע כינוי חדש</p>
              <div className="flex gap-2">
                <Input
                  placeholder="ערך כינוי..."
                  value={aliasInput}
                  onChange={(e) => {
                    setAliasInput(e.target.value);
                    setAliasMsg(null);
                  }}
                  className="text-[12px]"
                />
                <Button
                  size="sm"
                  disabled={!aliasInput.trim() || proposeAlias.isPending}
                  onClick={() => proposeAlias.mutate(aliasInput.trim())}
                >
                  {proposeAlias.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  הצע
                </Button>
              </div>
              {aliasMsg && (
                <p className="mt-2 text-[11px] font-semibold text-teal-700">{aliasMsg}</p>
              )}
            </div>

            {!unit.aliases?.length ? (
              <EmptyTab text="אין כינויים רשומים" />
            ) : (
              <ul className="space-y-2">
                {unit.aliases.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-md bg-slate-50 px-4 py-3 ring-1 ring-slate-100"
                  >
                    <span className="font-semibold text-slate-800">{a.value}</span>
                    <Badge variant="default">{a.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'decisions' && (
          <>
            {decisions.length === 0 ? (
              <EmptyTab text="אין החלטות AI ליחידה" />
            ) : (
              <ul className="space-y-3">
                {decisions.slice(0, 8).map((d) => (
                  <li
                    key={d._id}
                    className="rounded-md border border-slate-100 bg-white p-3.5 shadow-sm"
                  >
                    <p className="font-bold text-slate-900">{d.rawValue}</p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                      <ArrowUpLeft className="h-3 w-3" />
                      {actionLabel(d.action)}
                    </p>
                    <ConfidenceBar value={d.confidence} className="mt-2.5" />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'reviews' && (
          <>
            {reviews.length === 0 ? (
              <EmptyTab text="אין ביקורות פתוחות ליחידה" />
            ) : (
              <ul className="space-y-2">
                {reviews.map((r) => (
                  <li
                    key={r._id}
                    className="rounded-md border border-amber-100 bg-amber-50/50 px-4 py-3"
                  >
                    <p className="text-[12px] font-bold text-slate-900">{r.reason}</p>
                    {r.proposedAlias && (
                      <p className="mt-1 text-[11px] text-teal-700">כינוי: {r.proposedAlias}</p>
                    )}
                    {r.rawValue && (
                      <p className="mt-1 text-[11px] text-slate-600">ערך: {r.rawValue}</p>
                    )}
                    <Link
                      to="/reviews"
                      className="mt-2 inline-block text-[11px] font-bold text-teal-700 hover:underline"
                    >
                      לטיפול במרכז ביקורת →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function HeaderStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="font-mono text-xl font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="font-medium text-slate-500">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function EmptyTab({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <History className="mb-3 h-8 w-8 text-slate-300" />
      <p className="text-[13px] text-slate-500">{text}</p>
    </div>
  );
}

export function UnitDetailEmpty({ compact }: { compact?: boolean }) {
  return (
    <Card
      className={cn(
        'border-dashed border-slate-200/80 bg-slate-50/50 shadow-none',
        compact && 'border-0 bg-transparent shadow-none'
      )}
    >
      <div className={cn('flex flex-col items-center text-center', compact ? 'px-3 py-10' : 'px-6 py-20')}>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200">
          <Building2 className="h-6 w-6 text-teal-700" />
        </div>
        <h3 className="text-[13px] font-bold text-slate-800">בחר יחידה בתרשים</h3>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
          לחץ על כרטיס · גרור לתזוזה · Ctrl+גלגלת לזום
        </p>
      </div>
    </Card>
  );
}
