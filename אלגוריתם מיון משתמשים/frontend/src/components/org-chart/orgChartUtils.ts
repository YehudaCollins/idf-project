import type { OrgTreeNode } from '../../api/client';

function normalizeSearchText(value: string): string {
  return value
    .replace(/[\u2018\u2019\u201A\u2032\u2035`´']/g, '׳')
    .replace(/[\u201C\u201D\u201E\u2033\u2036"]/g, '״')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
    .replace(/[־_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function queryTokens(search: string): string[] {
  return normalizeSearchText(search).split(/\s+/).filter(Boolean);
}

function nodeOwnSearchText(node: OrgTreeNode): string {
  return normalizeSearchText([
    node.canonicalName,
    ...(node.aliases ?? []).map((alias) => alias.value),
    node.commander?.fullName,
    node.commander?.rank,
    node.commander?.role,
  ].filter(Boolean).join(' '));
}

function nodeFullSearchText(node: OrgTreeNode): string {
  return normalizeSearchText([
    node.canonicalName,
    node.pathText,
    ...(node.aliases ?? []).map((alias) => alias.value),
    node.commander?.fullName,
    node.commander?.rank,
    node.commander?.role,
  ].filter(Boolean).join(' '));
}

function nodeMatchesSearch(node: OrgTreeNode, search: string, includePath = false): boolean {
  const tokens = queryTokens(search);
  if (!tokens.length) return false;
  const text = includePath ? nodeFullSearchText(node) : nodeOwnSearchText(node);
  return tokens.every((token) => text.includes(token));
}

function collectMatchingNodes(nodes: OrgTreeNode[], search: string, includePath = false): OrgTreeNode[] {
  const out: OrgTreeNode[] = [];
  const walk = (n: OrgTreeNode) => {
    if (nodeMatchesSearch(n, search, includePath)) out.push(n);
    n.children?.forEach(walk);
  };
  nodes.forEach(walk);
  return out;
}

/** IDs of nodes matching search + all ancestors (stay visible in chart). */
export function getVisibleNodeIds(nodes: OrgTreeNode[], search: string): Set<string> | null {
  if (!search.trim()) return null;

  const visible = new Set<string>();
  const directMatches = new Set(collectMatchingNodes(nodes, search).map((node) => node._id));
  const pathMatches = directMatches.size > 0
    ? directMatches
    : new Set(collectMatchingNodes(nodes, search, true).map((node) => node._id));

  function walk(node: OrgTreeNode, ancestors: string[]): boolean {
    const selfMatch = pathMatches.has(node._id);
    let childVisible = false;
    for (const child of node.children ?? []) {
      if (walk(child, [...ancestors, node._id])) childVisible = true;
    }
    if (selfMatch || childVisible) {
      ancestors.forEach((id) => visible.add(id));
      visible.add(node._id);
      return true;
    }
    return false;
  }

  for (const root of nodes) walk(root, []);
  return visible;
}

/** All nodes whose name matches query (for jump-to list). */
export function findMatchingNodes(nodes: OrgTreeNode[], search: string): OrgTreeNode[] {
  if (!search.trim()) return [];
  const direct = collectMatchingNodes(nodes, search);
  return (direct.length ? direct : collectMatchingNodes(nodes, search, true)).slice(0, 12);
}

export function findNodeById(nodes: OrgTreeNode[], id: string): OrgTreeNode | null {
  for (const root of nodes) {
    const found = walk(root, id);
    if (found) return found;
  }
  return null;

  function walk(node: OrgTreeNode, target: string): OrgTreeNode | null {
    if (node._id === target) return node;
    for (const child of node.children ?? []) {
      const r = walk(child, target);
      if (r) return r;
    }
    return null;
  }
}

/** Path from root to node (inclusive). */
export function getNodePath(nodes: OrgTreeNode[], id: string): OrgTreeNode[] {
  for (const root of nodes) {
    const path = walk(root, id, []);
    if (path) return path;
  }
  return [];

  function walk(node: OrgTreeNode, target: string, acc: OrgTreeNode[]): OrgTreeNode[] | null {
    const next = [...acc, node];
    if (node._id === target) return next;
    for (const child of node.children ?? []) {
      const r = walk(child, target, next);
      if (r) return r;
    }
    return null;
  }
}

/** Ancestor IDs to expand so a node becomes visible. */
export function getAncestorIds(nodes: OrgTreeNode[], id: string): string[] {
  const path = getNodePath(nodes, id);
  return path.slice(0, -1).map((n) => n._id);
}

export function collectAllIds(nodes: OrgTreeNode[]): Set<string> {
  const ids = new Set<string>();
  const walk = (n: OrgTreeNode) => {
    ids.add(n._id);
    n.children?.forEach(walk);
  };
  nodes.forEach(walk);
  return ids;
}

export function getDepthLabel(level: number): string {
  const labels = [
    'מפקדה',
    'אגף',
    'ענף',
    'מדור',
    'מחלקה',
    'צוות / פלוגה',
    'תת-צוות / תא',
    'תא משנה',
  ];
  return labels[level] ?? `רמה ${level}`;
}
