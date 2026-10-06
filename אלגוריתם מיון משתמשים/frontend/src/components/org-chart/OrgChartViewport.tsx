import { useRef, useEffect, useCallback, type CSSProperties, type ReactNode } from 'react';

interface OrgChartViewportProps {
  children: ReactNode;
  zoom: number;
  focusNodeId: string | null;
  ready?: boolean;
  centerRequest?: number;
}

export function OrgChartViewport({
  children,
  zoom,
  focusNodeId,
  ready,
  centerRequest = 0,
}: OrgChartViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const centeredRef = useRef(false);

  const centerView = useCallback((smooth = false) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const left = Math.max(0, (vp.scrollWidth - vp.clientWidth) / 2);
    const top = 32;
    vp.scrollTo({ left, top, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const scrollToNode = useCallback(
    (nodeId: string) => {
      const vp = viewportRef.current;
      const node = vp?.querySelector(`[data-org-node-id="${nodeId}"]`) as HTMLElement | null;
      if (!vp || !node) return;

      const vpRect = vp.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const targetLeft =
        vp.scrollLeft + (nodeRect.left - vpRect.left) - vpRect.width / 2 + nodeRect.width / 2;
      const targetTop =
        vp.scrollTop + (nodeRect.top - vpRect.top) - vpRect.height / 2 + nodeRect.height / 2;

      vp.scrollTo({
        left: Math.max(0, targetLeft),
        top: Math.max(0, targetTop),
        behavior: 'smooth',
      });
    },
    []
  );

  useEffect(() => {
    if (!ready || centeredRef.current) return;
    const t = requestAnimationFrame(() => {
      centerView(false);
      centeredRef.current = true;
    });
    return () => cancelAnimationFrame(t);
  }, [ready, centerView]);

  useEffect(() => {
    if (!focusNodeId) return;
    const t = window.setTimeout(() => scrollToNode(focusNodeId), 120);
    return () => window.clearTimeout(t);
  }, [focusNodeId, zoom, scrollToNode]);

  useEffect(() => {
    if (!ready || centerRequest === 0) return;
    const t = window.setTimeout(() => centerView(true), 80);
    return () => window.clearTimeout(t);
  }, [centerRequest, ready, centerView]);

  return (
    <div
      ref={viewportRef}
      className="org-chart-viewport org-chart-canvas h-full w-full overflow-auto"
      dir="ltr"
    >
      <div
        className="inline-block min-w-max px-16 py-12"
        style={{ zoom } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}
