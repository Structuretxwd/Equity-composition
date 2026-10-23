// 当前股权分布环形图：颜色使用 CSS 变量，自动适配 Arco 深浅色主题。
'use client';

import { Empty } from '@arco-design/web-react';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

export type EquityPieDatum = {
  name: string;
  value: number;
  type?: string;
};

const PIE_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
];

export function EquityPieChart({
  data,
  height = 340,
}: {
  data: EquityPieDatum[];
  height?: number;
}) {
  const visible = data.filter((item) => item.value > 0);
  const total = visible.reduce((sum, item) => sum + item.value, 0);

  if (visible.length === 0 || total <= 0) {
    return (
      <div className="empty-box" style={{ height }}>
        <Empty description="暂无股权数据" />
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={visible}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="46%"
          innerRadius="54%"
          outerRadius="78%"
          paddingAngle={2}
          stroke="var(--color-bg-2)"
          strokeWidth={1}
        >
          {visible.map((entry, index) => (
            <Cell
              key={`${entry.name}-${index}`}
              fill={PIE_COLORS[index % PIE_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => `${Number(value).toFixed(2)}%`}
          contentStyle={{
            background: 'var(--color-bg-2)',
            border: '1px solid var(--color-border-2)',
            borderRadius: 8,
            color: 'var(--color-text-1)',
          }}
          itemStyle={{ color: 'var(--color-text-1)' }}
        />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value) => (
            <span style={{ color: 'var(--color-text-2)', fontSize: 12 }}>{String(value)}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
