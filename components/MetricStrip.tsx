// 指标条：把一组关键指标收进一条带分隔线的面板，替代四宫格卡片。
export type MetricItem = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  /** 名称类等长文本使用较小字号，避免撑破单元格 */
  compact?: boolean;
};

export function MetricStrip({ items }: { items: MetricItem[] }) {
  return (
    <div className="metric-strip" data-count={items.length}>
      {items.map((item) => (
        <div className="metric" key={item.label}>
          <span className="metric-label">{item.label}</span>
          <span className={`metric-value${item.compact ? ' is-compact' : ''}`}>
            {item.value}
          </span>
          {item.hint && <span className="metric-hint">{item.hint}</span>}
        </div>
      ))}
    </div>
  );
}
