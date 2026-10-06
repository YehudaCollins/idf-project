import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LogIn, RefreshCw, Users } from 'lucide-react';
import { api } from '../api/client';
import { PageShell, LoadingScreen, EmptyPlaceholder } from '../components/ui/page-shell';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { SearchBar } from '../components/ui/search-bar';
import { FilterPills } from '../components/ui/filter-pills';
import { Avatar } from '../components/ui/avatar';
import { AiStatusBar } from '../components/ai/AiStatusBar';
import { IngestFlowBanner } from '../components/demo/IngestFlowBanner';
import { LoginResultPanel, LoginResultEmpty } from '../components/demo/LoginResultPanel';
import { ManualIngestForm } from '../components/demo/ManualIngestForm';
import { cn } from '../lib/utils';
import {
  DEMO_CATEGORIES,
  CATEGORY_BADGE,
  CATEGORY_HE,
} from '../lib/demoCategories';

export function DemoLogin() {
  const [mode, setMode] = useState<'demo' | 'manual'>('demo');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ['demoUsers'],
    queryFn: api.demoUsers,
  });

  const categoryCounts = useMemo(() => {
    if (!users) return {};
    const counts: Record<string, number> = { all: users.length };
    for (const u of users) {
      if (u.category) counts[u.category] = (counts[u.category] ?? 0) + 1;
    }
    return counts;
  }, [users]);

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
          u.description.toLowerCase().includes(s) ||
          u.rawOrgPath.toLowerCase().includes(s)
      );
    }
    return list;
  }, [users, filter, search]);

  const login = useMutation({
    mutationFn: (id: string) => api.demoLogin(id),
    onSuccess: (_data, id) => {
      setActiveId(id);
      void qc.invalidateQueries({ queryKey: ['orgTree'] });
      void qc.invalidateQueries({ queryKey: ['orgUnit'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['aiDecisions'] });
      void qc.invalidateQueries({ queryKey: ['reviews'] });
      void qc.invalidateQueries({ queryKey: ['users'] });
      void qc.refetchQueries({ queryKey: ['orgTree'] });
    },
  });

  const activeResult = login.data && activeId ? login.data : null;
  const filterOptions = DEMO_CATEGORIES.map((c) => ({ ...c, count: categoryCounts[c.id] }));

  if (isLoading) return <LoadingScreen message="טוען משתמשי דמו..." />;

  return (
    <PageShell
      title="התחברות דמו"
      description="סימולציית ingest אמיתי — פירוק נתיב, התאמה לעץ, שמירת משתמש ועדכון מבנה ארגוני."
      badge={`${users?.length ?? 0} תרחישים`}
    >
      <AiStatusBar compact />
      <IngestFlowBanner />

      <div className="mb-6 segmented">
        <button
          type="button"
          onClick={() => setMode('demo')}
          className={cn('segmented-item', mode === 'demo' && 'segmented-item-active')}
        >
          תרחישי דמו
        </button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={cn('segmented-item', mode === 'manual' && 'segmented-item-active')}
        >
          Ingest ידני
        </button>
      </div>

      {mode === 'manual' ? (
        <ManualIngestForm />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <div className="panel-header space-y-3">
              <SearchBar
                placeholder="חיפוש שם, מספר אישי, נתיב..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <FilterPills options={filterOptions} value={filter} onChange={setFilter} />
            </div>

            <div className="max-h-[min(560px,calc(100vh-340px))] overflow-y-auto">
              {filtered.length === 0 ? (
                <EmptyPlaceholder
                  icon={Users}
                  title="אין תוצאות"
                  description="נסה סינון או חיפוש אחר"
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {filtered.map((u) => {
                    const isActive = activeId === u.id;
                    const isLoadingRow = login.isPending && activeId === u.id;

                    return (
                      <li
                        key={u.id}
                        className={cn(
                          'flex items-center gap-4 px-5 py-4 transition-colors',
                          isActive ? 'bg-accent-soft/70' : 'hover:bg-slate-50'
                        )}
                      >
                        <Avatar name={`${u.firstName} ${u.lastName}`} imageUrl={u.profileImageUrl} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900">
                              {u.firstName} {u.lastName}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500">
                              {u.personalNumber}
                            </span>
                            {u.category && (
                              <Badge variant={CATEGORY_BADGE[u.category] ?? 'default'}>
                                {CATEGORY_HE[u.category] ?? u.category}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-[12px] text-slate-500">{u.description}</p>
                        </div>
                        <Button
                          variant={isActive ? 'secondary' : 'primary'}
                          size="sm"
                          disabled={login.isPending}
                          onClick={() => {
                            setActiveId(u.id);
                            login.mutate(u.id);
                          }}
                        >
                          {isLoadingRow ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <LogIn className="h-4 w-4" />
                          )}
                          התחבר
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="border-t border-slate-100 px-5 py-2 text-center text-[11px] text-slate-400">
              {filtered.length} מתוך {users?.length}
            </div>
          </Card>

          <div className="lg:col-span-2">
            <div className="sticky top-20">
              {login.isError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {(login.error as Error).message}
                </div>
              )}
              {activeResult ? <LoginResultPanel result={activeResult} /> : <LoginResultEmpty />}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
