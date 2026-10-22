// 应用外壳：侧边导航由服务端按权限计算，主题切换与登出在客户端完成
'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Avatar, Button, Dropdown, Layout, Menu } from '@arco-design/web-react';
import {
  IconCalendar,
  IconHistory,
  IconMenuFold,
  IconMenuUnfold,
  IconMindMapping,
  IconPoweroff,
  IconSettings,
  IconUser,
} from '@arco-design/web-react/icon';
import { NAV_ITEMS } from '@/lib/navigation';
import { ThemeToggle } from './ThemeToggle';

type AppShellProps = {
  user: {
    name: string;
    email: string;
    role: string;
    shareholderName: string | null;
  };
  allowedPaths: string[];
  children: React.ReactNode;
};

const NAV_ICONS: Record<string, React.ReactNode> = {
  '/cap-table': <IconUser />,
  '/rounds': <IconCalendar />,
  '/charts': <IconMindMapping />,
  '/audit': <IconHistory />,
  '/simulator': <IconSettings />,
};

export function AppShell({ user, allowedPaths, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const items = useMemo(
    () => NAV_ITEMS.filter((item) => allowedPaths.includes(item.path)),
    [allowedPaths],
  );
  const activePath = items.find((item) => pathname.startsWith(item.path))?.path;
  const pageTitle = items.find((item) => item.path === activePath)?.label ?? '股权管理';

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  const userMenu = (
    <Menu onClickMenuItem={(key) => key === 'logout' && void handleLogout()}>
      <Menu.Item key="logout">
        <IconPoweroff style={{ marginRight: 8 }} />
        退出登录
      </Menu.Item>
    </Menu>
  );

  return (
    <Layout className="app-shell">
      <Layout.Sider
        width={220}
        collapsedWidth={64}
        collapsed={collapsed}
        trigger={null}
        className="app-sider"
      >
        <div className="app-logo">
          <span className="app-logo-badge">股</span>
          {!collapsed && <span>股权管理系统</span>}
        </div>

        <Menu
          className="app-nav"
          selectedKeys={activePath ? [activePath] : []}
          onClickMenuItem={(key) => router.push(key)}
        >
          {items.map((item) => (
            <Menu.Item key={item.path}>
              {NAV_ICONS[item.path]}
              {!collapsed && item.label}
            </Menu.Item>
          ))}
        </Menu>

        <div style={{ padding: 16, borderTop: '1px solid var(--color-border-2)' }}>
          <div className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
            {collapsed ? 'v1.0' : 'Cap Table · v1.0'}
          </div>
        </div>
      </Layout.Sider>

      <Layout>
        <Layout.Header
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 20px',
            background: 'var(--color-bg-2)',
            borderBottom: '1px solid var(--color-border-2)',
          }}
        >
          <Button
            type="text"
            onClick={() => setCollapsed((value) => !value)}
            icon={collapsed ? <IconMenuUnfold /> : <IconMenuFold />}
            aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
          />
          <div style={{ fontSize: 15, fontWeight: 600 }}>{pageTitle}</div>
          <div style={{ flex: 1 }} />
          <ThemeToggle />
          <Dropdown droplist={userMenu} position="br" trigger="click">
            <Button type="text" style={{ height: 44 }}>
              <Avatar
                size={28}
                style={{ backgroundColor: 'rgb(var(--primary-6))', marginRight: 8 }}
              >
                {user.name.slice(0, 1)}
              </Avatar>
              <span
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  lineHeight: '16px',
                }}
              >
                <span style={{ fontSize: 13 }}>{user.name}</span>
                <span className="muted" style={{ fontSize: 11 }}>
                  {user.role}
                  {user.shareholderName ? ` · ${user.shareholderName}` : ''}
                </span>
              </span>
            </Button>
          </Dropdown>
        </Layout.Header>

        <Layout.Content className="app-content">{children}</Layout.Content>
      </Layout>
    </Layout>
  );
}
