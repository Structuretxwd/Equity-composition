// 工作台布局：客户端路由守卫 → 数据库初始化 → 应用外壳。
'use client';

import { AppShell } from '@/components/AppShell';
import { DbProvider } from '@/components/DbProvider';
import { RouteGuard } from '@/components/RouteGuard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <DbProvider>
        <AppShell>{children}</AppShell>
      </DbProvider>
    </RouteGuard>
  );
}
