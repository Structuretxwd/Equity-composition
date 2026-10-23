// 客户端路由守卫（静态导出环境的第一层权限拦截）。
// GitHub Pages 无服务端 Middleware 运行时，因此由该组件在渲染前完成会话与路由鉴权。
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Spin } from '@arco-design/web-react';
import { canAccessRoute, getLandingPath } from '@/lib/rbac';
import {
  readSession,
  SESSION_CHANGE_EVENT,
} from '@/lib/session';
import type { SessionUser } from '@/lib/types';
import { SessionProvider } from './SessionContext';

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    const sync = () => setSession(readSession());
    sync();

    window.addEventListener(SESSION_CHANGE_EVENT, sync);
    window.addEventListener('focus', sync);
    const timer = window.setInterval(sync, 60_000);

    return () => {
      window.removeEventListener(SESSION_CHANGE_EVENT, sync);
      window.removeEventListener('focus', sync);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (session === null) {
      router.replace('/login');
      return;
    }
    if (session && !canAccessRoute(session.role, pathname)) {
      router.replace(getLandingPath(session.role));
    }
  }, [session, pathname, router]);

  if (!session) {
    return (
      <div className="fullscreen-state">
        <Spin size={36} />
        <p className="muted">正在校验访问权限…</p>
      </div>
    );
  }

  if (!canAccessRoute(session.role, pathname)) {
    return (
      <div className="fullscreen-state">
        <Spin size={36} />
        <p className="muted">无权访问该页面，正在返回…</p>
      </div>
    );
  }

  return <SessionProvider session={session}>{children}</SessionProvider>;
}
