import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  RefreshCw,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Focus,
  PanelRight,
  PencilLine,
  Wrench,
  AlertTriangle,
  ChevronLeft,
  X,
  Network,
} from 'lucide-react';
import { api, type OrgTreeNode } from '../api/client';
import { useDemoAuth } from '../auth/DemoAuth';
import { OrgChart } from '../components/org-chart/OrgChart';
import { OrgChartViewport } from '../components/org-chart/OrgChartViewport';
import { OrgSearchDropdown } from '../components/org-chart/OrgSearch';
import {
  collectAllIds,
  getVisibleNodeIds,
  findMatchingNodes,
  getNodePath,
  getAncestorIds,
} from '../components/org-chart/orgChartUtils';
import { Spinner, Button } from '../ui/primitives';
import { OrgUnitSidebar, OrgUnitSidebarEmpty } from '../components/org-chart/OrgUnitSidebar';
import { cn } from '../lib/utils';

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.4;

export function OrgTreePage() {
  const { isAdmin } = useDemoAuth();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(0.92);
  const [panel, setPanel] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [centerRequest, setCenterRequest] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['orgTree'],
    queryFn: api.orgTree,
  });

  const qc = useQueryClient();
  const repair = useMutation({
    mutationFn: api.repairOrphanRoots,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orgTree'] });
      refetch();
    },
  });

  const { data: detail } = useQuery({
    queryKey: ['orgUnit', selectedId],
    queryFn: () => api.orgUnit(selectedId!),
    enabled: !!selectedId,
  });

  const visibleIds = useMemo(() => (data?.tree ? getVisibleNodeIds(data.tree, search) : null), [data?.tree, search]);
  const searchHits = useMemo(() => (data?.tree && search.trim() ? findMatchingNodes(data.tree, search) : []), [data?.tree, search]);
  const scopeUnitIds = useMemo(() => data?.viewScope?.scopeUnitIds ? new Set(data.viewScope.scopeUnitIds) : null, [data?.viewScope?.scopeUnitIds]);
  const editableUnitIds = !isAdmin && editMode ? scopeUnitIds ?? new Set<string>() : null;
  const selectedPath = useMemo(() => (data?.tree && selectedId ? getNodePath(data.tree, selectedId) : []), [data?.tree, selectedId]);
  const treeSummary = useMemo(() => summarizeTree(data?.tree ?? []), [data?.tree]);
  const selectedUnit = selectedPath[selectedPath.length - 1] ?? null;
  const parentSelectedUnit = selectedPath.length > 1 ? selectedPath[selectedPath.length - 2] : null;

  const jumpToNode = useCallback(
    (id: string) => {
      if (!data?.tree) return;
      setCollapsed((prev) => {
        const next = new Set(prev);
        getAncestorIds(data.tree, id).forEach((aid) => next.delete(aid));
        return next;
      });
      setSelectedId(id);
      setPanel(true);
    },
    [data?.tree]
  );

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    setSearch('');
  }, []);

  const backToParent = useCallback(() => {
    if (parentSelectedUnit) {
      jumpToNode(parentSelectedUnit._id);
    } else {
      clearSelection();
    }
  }, [clearSelection, jumpToNode, parentSelectedUnit]);

  const centerTree = useCallback(() => {
    setSelectedId(null);
    setPanel(false);
    setCenterRequest((value) => value + 1);
  }, []);

  useEffect(() => {
    const unitId = params.get('unit');
    if (unitId && data?.tree) jumpToNode(unitId);
  }, [params, data?.tree, jumpToNode]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
        return;
      }

      if (e.key === 'Escape') {
        if (searchOpen) {
          setSearchOpen(false);
        } else if (search) {
          setSearch('');
        } else if (panel && selectedId) {
          setPanel(false);
        } else if (selectedId) {
          setSelectedId(null);
        }
      }

      if (typing) return;

      if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(ZOOM_MAX, z + 0.1));
      } else if (e.key === '-') {
        setZoom((z) => Math.max(ZOOM_MIN, z - 0.1));
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [panel, search, searchOpen, selectedId]);

  if (isLoading) return <div className="flex h-full items-center justify-center"><Spinner /></div>;
  if (error) return <div className="p-6 text-red-600">{(error as Error).message}</div>;

  return (
    <div className="flex h-full min-h-0 bg-background">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="org-tree-topbar relative z-40 shrink-0 overflow-visible px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex min-w-[220px] items-center gap-3">
              <span className="org-tree-titlemark">
                <Network className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight">עץ ארגוני</h1>
                <p className="truncate text-sm text-muted">
                  {data?.total ?? 0} יחידות{isAdmin && ` · ${treeSummary.users} חיילים ישירים`}
                </p>
              </div>
            </div>

            <div className="org-tree-search-shell relative min-w-48 flex-1 max-w-sm" ref={searchRef}>
              <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input
                ref={searchInputRef}
                className="input-field w-full pr-10"
                placeholder="חיפוש יחידה..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
              />
              {searchOpen && (
                <OrgSearchDropdown hits={searchHits} query={search} onSelect={jumpToNode} onClose={() => setSearchOpen(false)} />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {search.trim() && <TreePill icon={Search} label="תוצאות" value={searchHits.length} tone={searchHits.length ? 'default' : 'danger'} />}
              {isAdmin && treeSummary.reviews > 0 && <TreePill icon={AlertTriangle} label="ביקורת" value={treeSummary.reviews} tone="warning" />}
              {!isAdmin && editMode && <TreePill icon={PencilLine} label="ניתן לערוך" value={scopeUnitIds?.size ?? 0} />}
              <div className="org-tree-commandbar">
                <Button
                  variant={editMode ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    setEditMode((value) => !value);
                    setPanel(true);
                  }}
                >
                  <PencilLine className="h-4 w-4" />
                  {editMode ? 'סגור עריכה' : isAdmin ? 'עריכת כל העץ' : 'ערוך יחידות תחתיי'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setPanel((p) => !p)}>
                  <PanelRight className="h-4 w-4" /> פרטים
                </Button>
              </div>
              {isAdmin && (data?.orphanRootCount ?? 0) > 0 && (
                <Button variant="secondary" size="sm" disabled={repair.isPending} onClick={() => repair.mutate()}>
                  <Wrench className={cn('h-4 w-4', repair.isPending && 'animate-spin')} />
                  חבר {data!.orphanRootCount}
                </Button>
              )}
            </div>
          </div>
          {selectedPath.length > 0 && (
            <div className="org-tree-pathbar mt-3 flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={clearSelection}
                className="org-tree-path-action flex h-8 w-8 shrink-0 items-center justify-center border border-border text-subtle transition-colors hover:bg-elevated hover:text-foreground"
                aria-label="אפס בחירה"
                title="אפס בחירה"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={backToParent}
                className="org-tree-path-action inline-flex h-8 shrink-0 items-center gap-1 border border-border px-3 text-[12px] font-semibold text-muted transition-colors hover:bg-elevated hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4 rotate-180" />
                חזרה
              </button>
              <div className="min-w-0 flex-1 overflow-x-auto">
                <div className="flex min-w-max items-center gap-1 font-mono text-[12px]">
                  {selectedPath.map((node, index) => {
                    const active = index === selectedPath.length - 1;
                    return (
                      <span key={node._id} className="flex shrink-0 items-center gap-1">
                        {index > 0 && <ChevronLeft className="h-3.5 w-3.5 rotate-180 text-subtle" />}
                        <button
                          type="button"
                          onClick={() => jumpToNode(node._id)}
                          className={cn(
                            'max-w-[180px] truncate px-2 py-1 text-right transition-colors',
                            active
                              ? 'rounded-md bg-brand-soft text-brand-text'
                              : 'rounded-md text-muted hover:bg-white hover:text-foreground'
                          )}
                          title={node.canonicalName}
                        >
                          {node.canonicalName}
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="relative z-0 min-h-0 flex-1">
          <div className="absolute left-5 top-5 z-20 flex flex-wrap items-center gap-2" dir="rtl">
            <div className="org-tree-toolbar flex items-center gap-1 p-1.5">
              <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set())}><Maximize2 className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => data?.tree && setCollapsed(collectAllIds(data.tree))}><Minimize2 className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" disabled={isFetching} onClick={() => refetch()}><RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} /></Button>
              <Button variant="ghost" size="sm" onClick={centerTree} title="חזרה למרכז העץ" aria-label="חזרה למרכז העץ"><Focus className="h-4 w-4" /></Button>
              <span className="mx-1 h-5 w-px bg-border" />
              <Button variant="ghost" size="sm" disabled={zoom <= ZOOM_MIN} onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - 0.1))}><ZoomOut className="h-4 w-4" /></Button>
              <span className="w-10 text-center font-mono text-xs text-muted">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="sm" disabled={zoom >= ZOOM_MAX} onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + 0.1))}><ZoomIn className="h-4 w-4" /></Button>
            </div>
          </div>

          {selectedUnit && !panel && (
            <button
              type="button"
              onClick={() => setPanel(true)}
              className="absolute bottom-6 right-6 z-20 rounded-lg border border-border bg-surface px-5 py-3.5 text-right shadow-[var(--shadow-card-hover)] transition-shadow hover:shadow-lg"
            >
              <span className="block text-[14px] font-semibold text-foreground">{selectedUnit.canonicalName}</span>
              <span className="mt-0.5 block text-[12px] text-muted">פתח פרטים</span>
            </button>
          )}

          <OrgChartViewport zoom={zoom} focusNodeId={selectedId} ready={!!data?.tree?.length} centerRequest={centerRequest}>
            <OrgChart
              roots={data?.tree ?? []}
              selectedId={selectedId}
              onSelect={(id) => { setSelectedId(id); setPanel(true); }}
              collapsed={collapsed}
              onToggleCollapse={(id) =>
                setCollapsed((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id); else next.add(id);
                  return next;
                })
              }
              visibleIds={visibleIds}
              scopeUnitIds={editableUnitIds}
              scopePathIds={null}
              showManagementData={isAdmin}
            />
          </OrgChartViewport>

          {detail && panel && (
            <>
              <button
                type="button"
                aria-label="סגור פרטי יחידה"
                className="fixed inset-0 z-40 bg-black/40 xl:hidden"
                onClick={() => setPanel(false)}
              />
              <aside className="fixed bottom-0 left-0 top-0 z-50 w-[94vw] max-w-[500px] overflow-hidden border-r border-border bg-surface xl:hidden">
                <OrgUnitSidebar detail={detail} onSelectUnit={jumpToNode} onClose={() => setPanel(false)} editMode={editMode} />
              </aside>
            </>
          )}
        </div>
      </section>

      {panel && (
        <aside className="hidden w-[500px] shrink-0 overflow-hidden border-s border-border bg-surface xl:block">
          {detail ? (
            <OrgUnitSidebar detail={detail} onSelectUnit={jumpToNode} onClose={() => setPanel(false)} editMode={editMode} />
          ) : (
            <OrgUnitSidebarEmpty />
          )}
        </aside>
      )}
    </div>
  );
}

function summarizeTree(nodes: OrgTreeNode[]) {
  return nodes.reduce(
    (acc, node) => {
      acc.users += node.stats?.userCount ?? 0;
      acc.reviews += node.pendingReviews ?? 0;
      if (node.commander) acc.commanders += 1;
      if (node.dataQuality?.suspicious) acc.suspicious += 1;
      const childSummary = summarizeTree(node.children ?? []);
      acc.users += childSummary.users;
      acc.reviews += childSummary.reviews;
      acc.commanders += childSummary.commanders;
      acc.suspicious += childSummary.suspicious;
      return acc;
    },
    { users: 0, reviews: 0, commanders: 0, suspicious: 0 }
  );
}

function TreePill({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: 'default' | 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'warning'
      ? 'bg-warning-soft text-warning-text'
      : tone === 'danger'
        ? 'bg-danger-soft text-danger-text'
        : 'bg-surface-2 text-muted';

  return (
    <span className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold', toneClass)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span className="font-semibold text-foreground">{value}</span>
    </span>
  );
}
