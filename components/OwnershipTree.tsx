// 股权层级树：G6 动态加载，节点/连线颜色随 arco-theme 重绘
'use client';

import { useEffect, useRef, useState } from 'react';
import { Empty } from '@arco-design/web-react';
import type { OwnershipTreeNode } from '@/lib/equity';
import { useArcoTheme } from './useArcoTheme';

type Palette = {
  company: string;
  founder: string;
  investor: string;
  newShareholder: string;
  round: string;
  stroke: string;
  edge: string;
  roundText: string;
};

type G6NodeData = {
  id: string;
  label: string;
  nodeType: string;
  percent: number | null;
  style: { fill: string; stroke: string };
  labelCfg: { style: { fill: string; fontSize: number } };
  children?: G6NodeData[];
};

const LIGHT_PALETTE: Palette = {
  company: '#165DFF',
  founder: '#4080FF',
  investor: '#722ED1',
  newShareholder: '#00B42A',
  round: '#F2F3F5',
  stroke: '#E5E6EB',
  edge: '#C9CDD4',
  roundText: '#4E5969',
};

const DARK_PALETTE: Palette = {
  company: '#2E5BFF',
  founder: '#3C7EFF',
  investor: '#8D4EDA',
  newShareholder: '#23C343',
  round: '#2A2A2A',
  stroke: '#4E5969',
  edge: '#6B7785',
  roundText: '#E5E6EB',
};

function buildGraphData(node: OwnershipTreeNode, palette: Palette): G6NodeData {
  const isCompany = node.kind === 'company';
  const isRound = node.kind === 'round';

  let fill = palette.founder;
  if (isCompany) fill = palette.company;
  else if (isRound) fill = palette.round;
  else if (node.shareholderType === 'INVESTOR') fill = palette.investor;
  else if (node.shareholderType === 'NEW_SHAREHOLDER') fill = palette.newShareholder;

  return {
    id: node.id,
    label: node.label,
    nodeType: node.kind,
    percent: node.percent,
    style: { fill, stroke: palette.stroke },
    labelCfg: {
      style: {
        fill: isRound ? palette.roundText : '#FFFFFF',
        fontSize: 12,
      },
    },
    children: node.children?.map((child) => buildGraphData(child, palette)),
  };
}

export function OwnershipTree({
  data,
  height = 440,
}: {
  data: OwnershipTreeNode;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useArcoTheme();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !data.children?.length) return;

    let disposed = false;
    let graph: any = null;
    let resizeObserver: ResizeObserver | null = null;

    async function renderGraph() {
      if (!containerRef.current) return;

      try {
        const G6Module = await import('@antv/g6');
        const G6 = G6Module.default ?? G6Module;

        if (disposed || !containerRef.current) return;

        const palette = theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
        const width = containerRef.current.clientWidth || 800;

        graph = new G6.TreeGraph({
          container: containerRef.current,
          width,
          height,
          fitView: true,
          fitViewPadding: 24,
          animate: true,
          modes: { default: ['drag-canvas', 'zoom-canvas'] },
          defaultNode: {
            type: 'rect',
            size: [210, 38],
            style: { radius: 8, lineWidth: 0 },
          },
          defaultEdge: {
            type: 'cubic-horizontal',
            style: {
              stroke: palette.edge,
              lineWidth: 1.4,
              endArrow: true,
            },
          },
          layout: {
            type: 'compactBox',
            direction: 'LR',
            getId: (datum: any) => String(datum.id),
            getHeight: () => 24,
            getWidth: () => 215,
            getVGap: () => 16,
            getHGap: () => 56,
          },
        });

        graph.data(buildGraphData(data, palette));
        graph.render();
        graph.fitView();

        resizeObserver = new ResizeObserver(() => {
          if (!containerRef.current || !graph) return;
          const nextWidth = containerRef.current.clientWidth;
          if (nextWidth > 0) graph.changeSize(nextWidth, height);
        });
        resizeObserver.observe(containerRef.current);
        setError(null);
      } catch (renderError) {
        console.error('[OwnershipTree] 渲染失败', renderError);
        setError('股权结构图加载失败，请刷新页面重试');
      }
    }

    void renderGraph();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      graph?.destroy();
      graph = null;
    };
  }, [data, theme, height]);

  const isEmpty = !data.children?.length;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height }} />

      {(isEmpty || error) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-bg-2)',
          }}
        >
          <Empty description={error ?? '暂无股权结构数据'} />
        </div>
      )}
    </div>
  );
}
