import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, AlertTriangle, GitBranch, Clock } from 'lucide-react';
import type { ReviewItem } from '../../api/client';
import { Card, CardBody } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ConfidenceBar } from '../ui/confidence-bar';
import { formatPercent, cn } from '../../lib/utils';

const TYPE_LABELS: Record<string, string> = {
  conflict_match: 'קונפליקט התאמה',
  medium_confidence: 'ביטחון בינוני',
  alias_proposal: 'הצעת כינוי',
};

const TYPE_ACCENT: Record<string, string> = {
  conflict_match: 'bg-red-500',
  medium_confidence: 'bg-amber-500',
  alias_proposal: 'bg-accent',
};

export function ReviewCard({
  review,
  onApprove,
  onReject,
  busy,
}: {
  review: ReviewItem;
  onApprove: (id: string, selectedUnitId?: string, note?: string) => void;
  onReject: (id: string, note?: string) => void;
  busy: boolean;
}) {
  const isConflict = review.changeType === 'conflict_match' && review.conflict?.candidates?.length;
  const [selectedUnitId, setSelectedUnitId] = useState(
    review.conflict?.candidates?.[0]?.unitId ?? review.targetUnitId ?? ''
  );
  const [note, setNote] = useState('');
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null);

  const accent = TYPE_ACCENT[review.changeType] ?? 'bg-slate-500';

  if (done) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardBody className="py-8 text-center">
          <p className="font-bold text-emerald-800">
            {done === 'approved' ? '✓ אושר בהצלחה' : 'נדחה'}
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden transition-all hover:shadow-lg">
      <div className={cn('h-1', accent)} />
      <CardBody className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <GitBranch className="h-5 w-5 text-slate-700" />
          </div>
          <div>
            <p className="font-bold text-slate-900">{TYPE_LABELS[review.changeType] ?? review.changeType}</p>
            <Badge variant="warning" className="mt-1">
              ממתין
            </Badge>
          </div>
        </div>

        <p className="text-[13px] leading-relaxed text-slate-600">{review.reason}</p>

        {review.rawValue && (
          <div className="rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ערך גולמי</p>
            <p className="mt-1 font-bold text-slate-900">{review.rawValue}</p>
          </div>
        )}

        {review.proposedAlias && !isConflict && (
          <div className="rounded-lg bg-accent-soft px-4 py-3 ring-1 ring-teal-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-accent">כינוי מוצע</p>
            <p className="mt-1 font-bold text-slate-900">{review.proposedAlias}</p>
            {review.targetCanonicalName && (
              <p className="mt-1 text-[12px] text-accent">→ {review.targetCanonicalName}</p>
            )}
          </div>
        )}

        {review.confidence != null && <ConfidenceBar value={review.confidence} className="w-full" />}

        {review.affectedUsersCount != null && review.affectedUsersCount > 0 && (
          <p className="text-[11px] font-semibold text-slate-500">
            משתמשים מושפעים: {review.affectedUsersCount}
          </p>
        )}

        {isConflict && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-[12px] font-bold text-red-800">
              <AlertTriangle className="h-4 w-4" />
              בחר יחידה נכונה
            </p>
            {review.conflict!.candidates.map((c) => (
              <label
                key={c.unitId}
                className={cn(
                  'flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition-all',
                  selectedUnitId === c.unitId
                    ? 'border-accent bg-accent-soft ring-2 ring-accent/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`candidate-${review._id}`}
                    checked={selectedUnitId === c.unitId}
                    onChange={() => setSelectedUnitId(c.unitId)}
                    className="accent-accent"
                  />
                  <span className="font-semibold text-slate-900">{c.canonicalName}</span>
                </span>
                <Badge variant="danger" className="font-mono">
                  {formatPercent(c.confidence)}
                </Badge>
              </label>
            ))}
          </div>
        )}

        <textarea
          placeholder="הערה (אופציונלי)..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          rows={2}
        />

        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <Clock className="h-3 w-3" />
          {new Date(review.createdAt).toLocaleString('he-IL')}
          {review.proposedBy && (
            <span className="mr-2 font-mono">· {review.proposedBy}</span>
          )}
        </div>

        <div className="flex gap-2 border-t border-slate-100 pt-4">
          <Button
            variant="success"
            size="sm"
            className="flex-1"
            disabled={busy || !!(isConflict && !selectedUnitId)}
            onClick={() => {
              onApprove(review._id, selectedUnitId || undefined, note || undefined);
              setDone('approved');
            }}
          >
            <Check className="h-4 w-4" />
            אישור
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="flex-1"
            disabled={busy}
            onClick={() => {
              onReject(review._id, note || undefined);
              setDone('rejected');
            }}
          >
            <X className="h-4 w-4" />
            דחייה
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export function ReviewHistoryLink() {
  return (
    <Link to="/reviews" className="text-[12px] font-bold text-accent hover:underline">
      מרכז ביקורת
    </Link>
  );
}
