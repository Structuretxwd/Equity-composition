// 403 页面：页面级权限不足时的兜底展示
import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <div className="panel" style={{ textAlign: 'center', padding: '80px 24px' }}>
      <h1 className="page-title">403 · 无权访问</h1>
      <p className="page-subtitle" style={{ marginBottom: 24 }}>
        当前账号没有访问该页面的权限，请联系管理员调整角色权限。
      </p>
      <Link
        href="/"
        style={{
          display: 'inline-block',
          padding: '10px 20px',
          borderRadius: 6,
          background: 'rgb(var(--primary-6))',
          color: '#fff',
          fontSize: 14,
        }}
      >
        返回首页
      </Link>
    </div>
  );
}
