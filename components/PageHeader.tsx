// 页面标题区：标题自己承担层级，不再额外加英文眉标。
export function PageHeader({
  title,
  subtitle,
  extra,
}: {
  title: string;
  subtitle?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div style={{ minWidth: 0 }}>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {extra && <div className="page-header-extra">{extra}</div>}
    </div>
  );
}
