// 根路径：根据当前会话角色跳转到其默认可访问页面。
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spin } from '@arco-design/web-react';
import { getLandingPath } from '@/lib/rbac';
import { readSession } from '@/lib/session';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const session = readSession();
    router.replace(session ? getLandingPath(session.role) : '/login');
  }, [router]);

  return (
    <div className="fullscreen-state">
      <Spin size={36} />
      <p className="muted">正在进入股权管理系统…</p>
    </div>
  );
}
