import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  RefreshCw,
  Maximize2,
  Minimize2,
  Search,
  ChevronLeft,
  PanelLeft,
  ZoomIn,
  ZoomOut,
  Focus,
  X,
  Network,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { api, type OrgTreeNode } from '../api/client';
import { OrgChart } from '../components/org-chart/OrgChart';
import { OrgChartViewport } from '../components/org-chart/OrgChartViewport';
import {
  collectAllIds,
  getVisibleNodeIds,
  findMatchingNodes,
  getNodePath,
  getAncestorIds,
} from '../components/org-chart/orgChartUtils';
import { UnitDetailPanel, UnitDetailEmpty } from '../components/UnitDetailPanel';
import { LoadingScreen, ErrorBanner } from '../components/ui/page-shell';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.4;
const ZOOM_STEP = 0.1;

export function OrgTree() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(0.85);
  const [panelOpen, setPanelOpen] = useState(true);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['orgTree'],
    queryFn: api.orgTree,
  });

  const { data: detail } = useQuery({
    queryKey: ['orgUnit', selectedId],
    queryFn: () => api.orgUnit(selectedId!),
    enabled: !!selectedId,
  });

  const visibleIds = useMemo(
    () => (data?.tree ? getVisibleNodeIds(data.tree, search) : null),
    [data?.tree, search]
  );

  const searchHits = useMemo(
    () => (data?.tree && search.trim() ? findMatchingNodes(data.tree, search) : []),
    [data?.tree, search]
  );

  const selectedPath = useMemo(
    () => (data?.tree && selectedId ? getNodePath(data.tree, selectedId) : []),
    [data?.tree, selectedId]
  );

  const treeSummary = useMemo(
    () => summarizeTree(data?.tree ?? []),
    [data?.tree]
  );

  const jumpToNode = useCallback(
    (id: string, clearUrl = false) => {
      if (!data?.tree) return;
      const ancestors = getAncestorIds(data.tree, id);
      setCollapsed((prev) => {
        const next = new Set(prev);
        ancestors.forEach((aid) => next.delete(aid));
        return next;
      });
      setSelectedId(id);
      setShowSearchResults(false);
      if (clearUrl && params.get('unit')) {
        setParams({}, { replace: true });
      }
      if (!panelOpen) setPanelOpen(true);
    },
    [data?.tree, panelOpen, params, setParams]
  );

  useEffect(() => {
    const unitId = params.get('unit');
    if (unitId && data?.tree) {
      jumpToNode(unitId);
    }
  }, [params, data?.tree, jumpToNode]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingScreen message="טוען תרשים..." />
      </div>
    );
  }
  if (error) return <ErrorBanner message={(error as Error).message} />;

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-100">
      <div className="shrink-0 border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent ring-1 ring-teal-100">
              <Network className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[18px] font-semibold text-slate-950">עץ ארגוני</h1>
              <p className="truncate text-[12px] font-semibold text-slate-500">
                {data?.total ?? 0} יחידות · {treeSummary.users} חיילים ישירים · {treeSummary.commanders} מפקדים מזוהים
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <TreePill icon={Users} label="חיילים" value={treeSummary.users} />
            {treeSummary.reviews > 0 && (
              <TreePill icon={AlertTriangle} label="ביקורות" value={treeSummary.reviews} tone="warning" />
            )}
            {treeSummary.suspicious > 0 && (
              <TreePill icon={AlertTriangle} label="חשודות" value={treeSummary.suspicious} tone="danger" />
            )}
            <Button
              variant={panelOpen ? 'secondary' : 'outline'}
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => setPanelOpen((o) => !o)}
            >
              <PanelLeft className="h-3.5 w-3.5" />
              פרטים
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-8 pr-8 text-[12px]"
              placeholder="חיפוש יחידה..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              onBlur={() => window.setTimeout(() => setShowSearchResults(false), 200)}
            />
            {showSearchResults && search.trim() && searchHits.length > 0 && (
              <ul className="absolute right-0 top-full z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {searchHits.map((n) => (
                  <li key={n._id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-right text-[12px] hover:bg-accent-soft"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        jumpToNode(n._id);
                      }}
                    >
                      <span className="block font-bold text-slate-800">{n.canonicalName}</span>
                      <span className="block truncate text-[10px] text-slate-400">{n.pathText}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {search && visibleIds && (
            <Badge variant="brand" className="shrink-0 text-[10px]">
              {visibleIds.size} תוצאות
            </Badge>
          )}

          <div className="hidden h-5 w-px shrink-0 bg-slate-200 sm:block" />

          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            <Button variant="ghost" size="iconSm" title="הרחב" onClick={() => setCollapsed(new Set())}>
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="iconSm"
              title="כווץ"
              onClick={() => data?.tree && setCollapsed(collectAllIds(data.tree))}
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="iconSm" title="רענון" disabled={isFetching} onClick={() => refetch()}>
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            </Button>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            <Button
              variant="ghost"
              size="iconSm"
              title="הקטן"
              disabled={zoom <= ZOOM_MIN}
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="w-9 shrink-0 text-center font-mono text-[10px] font-bold text-slate-500">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="iconSm"
              title="הגדל"
              disabled={zoom >= ZOOM_MAX}
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="iconSm" title="מרכז" onClick={() => setSelectedId(null)}>
              <Focus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {selectedPath.length > 0 && (
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-1 text-[11px]">
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100"
            onClick={() => setSelectedId(null)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {selectedPath.map((node, i) => (
            <span key={node._id} className="flex shrink-0 items-center gap-0.5">
              {i > 0 && <ChevronLeft className="h-3 w-3 rotate-180 text-slate-300" />}
              <button
                type="button"
                onClick={() => jumpToNode(node._id)}
                className={cn(
                  'max-w-[140px] truncate rounded px-1.5 py-0.5 font-semibold',
                  i === selectedPath.length - 1
                    ? 'bg-accent-soft text-accent'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
                title={node.canonicalName}
              >
                {node.canonicalName}
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        {/* תרשים — תופס את כל השטח */}
        <div className="min-h-0 min-w-0 flex-1">
          <OrgChartViewport zoom={zoom} focusNodeId={selectedId} ready={!!data?.tree?.length}>
            <OrgChart
              roots={data?.tree ?? []}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setPanelOpen(true);
              }}
              collapsed={collapsed}
              onToggleCollapse={(id) =>
                setCollapsed((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              visibleIds={visibleIds}
            />
          </OrgChartViewport>
        </div>

        {/* פאנל — צד שמאל (ליד הסיידבר הימני) */}
        {panelOpen && (
          <>
            <button
              type="button"
              className="absolute inset-0 z-20 bg-black/20 lg:hidden"
              aria-label="סגור פאנל"
              onClick={() => setPanelOpen(false)}
            />
            <aside className="relative z-30 flex w-[min(100%,340px)] shrink-0 flex-col border-s border-slate-200 bg-white shadow-lg lg:shadow-none">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-3 py-2">
                <span className="text-[12px] font-bold text-slate-700">פרטי יחידה</span>
                <Button variant="ghost" size="iconSm" onClick={() => setPanelOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                {selectedId && detail ? (
                  <UnitDetailPanel detail={detail} onSelectUnit={jumpToNode} compact />
                ) : (
                  <UnitDetailEmpty compact />
                )}
              </div>
            </aside>
          </>
        )}
      </div>
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
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: 'default' | 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'warning'
      ? 'bg-amber-50 text-amber-800 ring-amber-200'
      : tone === 'danger'
        ? 'bg-red-50 text-red-800 ring-red-200'
        : 'bg-slate-50 text-slate-700 ring-slate-200';

  return (
    <span className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold ring-1 ${toneClass}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span className="font-mono">{value}</span>
    </span>
  );
}
