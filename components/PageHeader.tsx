// 页面标题区：统一标题、描述与右侧操作区布局。
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  extra,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {extra && <div className="page-header-extra">{extra}</div>}
    </div>
  );
}
