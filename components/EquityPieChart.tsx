// 当前股权分布饼图：颜色通过 CSS 变量自动适配 Arco 深浅色主题
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
  height = 360,
}: {
  data: EquityPieDatum[];
  height?: number;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (data.length === 0 || total <= 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Empty description="暂无股权数据" />
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius="52%"
          outerRadius="78%"
          paddingAngle={2}
          stroke="var(--color-bg-2)"
          strokeWidth={1}
        >
          {data.map((entry, index) => (
            <Cell
              key={`${entry.name}-${index}`}
              fill={PIE_COLORS[index % PIE_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number | string | Array<number | string>) =>
            `${Number(value).toFixed(2)}%`
          }
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
          formatter={(value) => (
            <span style={{ color: 'var(--color-text-2)', fontSize: 12 }}>
              {String(value)}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
