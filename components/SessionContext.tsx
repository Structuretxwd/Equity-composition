// 已认证会话上下文：只在 RouteGuard 校验通过后向下提供。
'use client';

import { createContext, useContext } from 'react';
import type { SessionUser } from '@/lib/types';

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: SessionUser;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionUser {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error('useSession 必须在 RouteGuard 内部使用');
  }
  return session;
}
