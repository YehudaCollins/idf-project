import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { api } from '../api/client';
import {
  PageShell,
  LoadingScreen,
  ErrorBanner,
  EmptyPlaceholder,
} from '../components/ui/page-shell';
import { Card } from '../components/ui/card';
import { FilterPills } from '../components/ui/filter-pills';
import { AiStatusBar } from '../components/ai/AiStatusBar';
import { ReviewCard } from '../components/ai/ReviewCard';

const TABS = [
  { id: 'needs_review', label: 'ממתינים' },
  { id: 'approved', label: 'אושרו' },
  { id: 'rejected', label: 'נדחו' },
];

export function ReviewCenter() {
  const [tab, setTab] = useState('needs_review');
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['reviews', tab],
    queryFn: () => api.reviews(tab),
  });

  const approve = useMutation({
    mutationFn: ({ id, selectedUnitId, note }: { id: string; selectedUnitId?: string; note?: string }) =>
      api.approveReview(id, { selectedUnitId, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['orgTree'] });
      qc.invalidateQueries({ queryKey: ['aiDecisions'] });
      qc.invalidateQueries({ queryKey: ['aiStats'] });
    },
  });

  const reject = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => api.rejectReview(id, { note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] });
      qc.invalidateQueries({ queryKey: ['aiDecisions'] });
      qc.invalidateQueries({ queryKey: ['aiStats'] });
    },
  });

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorBanner message={(error as Error).message} />;

  const pending = tab === 'needs_review';

  return (
    <PageShell
      title="מרכז ביקורת"
      description="Human-in-the-loop — אישור כינויים, פתרון קונפליקטים, למידה למנוע AI."
      badge={pending && data?.length ? `${data.length} ממתינים` : undefined}
    >
      <div className="mb-6 space-y-4">
        <AiStatusBar />
        <FilterPills
          options={TABS.map((t) => ({ ...t, count: undefined }))}
          value={tab}
          onChange={setTab}
        />
      </div>

      {!data?.length ? (
        <Card className="surface-card border-dashed shadow-none">
          <EmptyPlaceholder
            icon={Inbox}
            title={pending ? 'התור ריק' : 'אין רשומות'}
            description={
              pending
                ? 'הרץ תרחישי fuzzy / conflict בדמו — ביקורות יופיעו כאן'
                : 'פריטים יופיעו כאן אחרי אישור או דחייה'
            }
          />
          {pending && (
            <div className="flex justify-center pb-10">
              <Link to="/demo-login" className="text-[13px] font-bold text-accent hover:underline">
                ← התחברות דמו
              </Link>
            </div>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {data.map((r) => (
            <ReviewCard
              key={r._id}
              review={r}
              busy={approve.isPending || reject.isPending}
              onApprove={(id, selectedUnitId, note) =>
                approve.mutate({ id, selectedUnitId, note })
              }
              onReject={(id, note) => reject.mutate({ id, note })}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
