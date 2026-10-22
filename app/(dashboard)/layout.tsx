// 业务页面布局：服务端读取会话后，将“可见菜单”下发给客户端外壳
import { requirePageUser } from '@/lib/auth';
import { getAllowedNavPaths } from '@/lib/navigation';
import { AppShell } from '@/components/AppShell';

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requirePageUser();

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
        shareholderName: user.shareholderName,
      }}
      allowedPaths={getAllowedNavPaths(user)}
    >
      {children}
    </AppShell>
  );
}
