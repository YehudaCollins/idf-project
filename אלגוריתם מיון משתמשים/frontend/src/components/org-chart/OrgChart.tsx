import { Building2, ChevronDown, ChevronUp, Users, AlertCircle, Unlink, ShieldUser } from 'lucide-react';
import type { OrgTreeNode } from '../../api/client';
import { cn } from '../../lib/utils';
import '../../styles/org-chart.css';

interface OrgChartProps {
  roots: OrgTreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  visibleIds: Set<string> | null;
  scopeUnitIds?: Set<string> | null;
  scopePathIds?: Set<string> | null;
  showManagementData?: boolean;
}

type ChartNode = OrgTreeNode & { detachedRoot?: boolean };

function ChartNode({
  node,
  selectedId,
  onSelect,
  collapsed,
  onToggleCollapse,
  visibleIds,
  scopeUnitIds,
  scopePathIds,
  showManagementData = true,
}: {
  node: ChartNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  visibleIds: Set<string> | null;
  scopeUnitIds?: Set<string> | null;
  scopePathIds?: Set<string> | null;
  showManagementData?: boolean;
}) {
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const isCollapsed = collapsed.has(node._id);
  const isSelected = selectedId === node._id;
  const isSearchDimmed = visibleIds !== null && !visibleIds.has(node._id);
  const showScope = scopeUnitIds !== null && scopeUnitIds !== undefined;
  const isInScope = !showScope || scopeUnitIds?.has(node._id) || scopePathIds?.has(node._id);
  const isOutOfScope = showScope && !isInScope;
  const userCount = node.stats?.userCount ?? 0;
  const reviewCount = node.pendingReviews ?? 0;
  const isDetached = !!node.detachedRoot;
  const isSuspicious = !!node.dataQuality?.suspicious;
  const aliasCount = node.stats?.aliasCount ?? 0;

  return (
    <li>
      <div className="relative inline-block">
        {hasChildren && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(node._id); }}
            className="org-node-toggle"
            aria-label={isCollapsed ? 'הרחב' : 'כווץ'}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        )}

        <button
          type="button"
          data-org-node-id={node._id}
          dir="rtl"
          onClick={() => onSelect(node._id)}
          className={cn(
            'org-node-btn',
            isSelected && 'is-selected org-node-selected',
            !node.isVerified && 'is-unverified',
            isDetached && 'is-detached-root',
            isSuspicious && 'is-suspicious-unit',
            isOutOfScope && 'is-out-of-scope',
            isSearchDimmed && 'is-search-dimmed',
            reviewCount > 0 && !isSelected && !isDetached && 'border-amber-300'
          )}
        >
          <div className="flex items-start gap-3 text-right">
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ring-1 ring-inset',
              isDetached ? 'bg-danger-soft text-danger-text' : 'bg-brand-soft text-brand-text'
            )}>
              {isDetached ? <Unlink className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-slate-950">{node.canonicalName}</p>
              {(hasChildren || aliasCount > 0) && (
                <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] font-medium text-slate-500">
                  {hasChildren && <span>{children.length} תת-יחידות</span>}
                  {aliasCount > 0 && <span>{aliasCount} כינויים</span>}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {isDetached && (
                  <span className="rounded-sm border border-red-300/50 px-1.5 py-px text-[10px] font-semibold text-red-800">שורש נפרד</span>
                )}
                {isSuspicious && (
                  <span className="inline-flex items-center gap-1 rounded-sm border border-red-300/50 px-1.5 py-px text-[10px] font-semibold text-red-800">
                    <AlertCircle className="h-3 w-3" />
                    חשוד
                  </span>
                )}
                {!node.isVerified && !isSuspicious && (
                  <span className="rounded-sm border border-amber-300/50 bg-amber-50 px-1.5 py-px text-[10px] font-semibold text-amber-900">לא מאומת</span>
                )}
              </div>
            </div>
          </div>
          {node.commander && (
            <div className="org-node-commander" title={`${node.commander.reason} · ${Math.round(node.commander.confidence * 100)}%`}>
              <ShieldUser className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate font-semibold text-slate-700">{node.commander.fullName}</span>
              {node.commander.rank && <span className="shrink-0 text-slate-500">· {node.commander.rank}</span>}
            </div>
          )}
          {showManagementData && (
            <div className="mt-2 flex items-center justify-end gap-1.5 font-mono text-[10px] text-muted">
              {userCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-slate-50 px-1.5 py-px" title="חיילים שמשויכים פיזית ליחידה זו">
                  <Users className="h-3 w-3" />{userCount}
                </span>
              )}
              {reviewCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-sm border border-amber-300/50 bg-amber-50 px-1.5 py-px text-amber-900">
                  <AlertCircle className="h-3 w-3" />{reviewCount}
                </span>
              )}
            </div>
          )}
        </button>
      </div>

      {hasChildren && !isCollapsed && (
        <ul>
          {children.map((child) => (
            <ChartNode
              key={child._id}
              node={child as ChartNode}
              selectedId={selectedId}
              onSelect={onSelect}
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
              visibleIds={visibleIds}
              scopeUnitIds={scopeUnitIds}
              scopePathIds={scopePathIds}
              showManagementData={showManagementData}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function OrgChart({
  roots,
  selectedId,
  onSelect,
  collapsed,
  onToggleCollapse,
  visibleIds,
  scopeUnitIds,
  scopePathIds,
  showManagementData = true,
}: OrgChartProps) {
  if (!roots.length) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <p className="text-[14px] font-medium text-muted">התרשים ריק</p>
        <p className="mt-1 text-[13px] text-subtle">הרץ seed או התחברות</p>
      </div>
    );
  }

  return (
    <div className="org-chart-forest">
      {roots.map((root) => (
        <div key={root._id} className="org-chart-root">
          <ul>
            <ChartNode
              node={root}
              selectedId={selectedId}
              onSelect={onSelect}
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
              visibleIds={visibleIds}
              scopeUnitIds={scopeUnitIds}
              scopePathIds={scopePathIds}
              showManagementData={showManagementData}
            />
          </ul>
        </div>
      ))}
    </div>
  );
}
