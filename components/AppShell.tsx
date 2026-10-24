// 应用外壳：侧边导航、顶栏、主题切换与退出登录。
// 导航项完全由 lib/rbac.ts 的角色权限决定，不在组件内散写角色判断。
'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Avatar,
  Button,
  Drawer,
  Dropdown,
  Layout,
  Menu,
  Tag,
} from '@arco-design/web-react';
import {
  IconCalendar,
  IconExperiment,
  IconHistory,
  IconMenu,
  IconMenuFold,
  IconMenuUnfold,
  IconMindMapping,
  IconPoweroff,
  IconSettings,
  IconStorage,
  IconUser,
  IconUserGroup,
} from '@arco-design/web-react/icon';
import { getVisibleNavItems, ROLE_LABEL, type NavItem } from '@/lib/rbac';
import { clearSession } from '@/lib/session';
import { useSession } from './SessionContext';
import { ThemeToggle } from './ThemeToggle';

const NAV_ICONS: Record<NavItem['icon'], React.ReactNode> = {
  users: <IconUserGroup />,
  calendar: <IconCalendar />,
  chart: <IconMindMapping />,
  history: <IconHistory />,
  experiment: <IconExperiment />,
  storage: <IconStorage />,
  console: <IconSettings />,
};

const ROLE_TAG_COLOR: Record<string, string> = {
  ADMIN: 'red',
  PARTNER: 'purple',
  INVESTOR: 'green',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const items = useMemo(() => getVisibleNavItems(session.role), [session.role]);
  const activePath =
    items.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))?.path ??
    items[0]?.path;
  const pageTitle =
    items.find((item) => item.path === activePath)?.label ?? '股权管理';

  useEffect(() => {
    document.title = `${pageTitle} · 股权管理系统`;
  }, [pageTitle]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    setDrawerVisible(false);
  }, [pathname]);

  function navigate(path: string) {
    router.push(path);
    setDrawerVisible(false);
  }

  function logout() {
    clearSession();
    router.replace('/login');
  }

  function renderMenu(mode: 'sider' | 'drawer') {
    const compact = mode === 'sider' && collapsed;
    return (
      <Menu
        className="app-nav"
        selectedKeys={activePath ? [activePath] : []}
        onClickMenuItem={(key) => navigate(key)}
      >
        {items.map((item) => (
          <Menu.Item key={item.path}>
            <span className="nav-icon">{NAV_ICONS[item.icon]}</span>
            {!compact && <span>{item.label}</span>}
          </Menu.Item>
        ))}
      </Menu>
    );
  }

  const userMenu = (
    <Menu onClickMenuItem={(key) => key === 'logout' && logout()}>
      <Menu.Item key="logout">
        <IconPoweroff style={{ marginRight: 8 }} />
        退出登录
      </Menu.Item>
    </Menu>
  );

  return (
    <Layout className="app-shell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>

      {!isMobile && (
        <Layout.Sider
          width={232}
          collapsedWidth={68}
          collapsed={collapsed}
          trigger={null}
          className="app-sider"
        >
          <div className="app-logo">
            <span className="app-logo-badge">股</span>
            {!collapsed && (
              <span className="app-logo-text">
                股权管理
                <small>Cap Table</small>
              </span>
            )}
          </div>

          {renderMenu('sider')}

          <div className="app-sider-footer">
            {!collapsed ? (
              <>
                <span className="status-dot" />
                <span>本地 SQLite 已连接</span>
              </>
            ) : (
              <span className="status-dot" title="本地 SQLite 已连接" />
            )}
          </div>
        </Layout.Sider>
      )}

      <Drawer
        width={248}
        visible={drawerVisible}
        footer={null}
        closable={false}
        onCancel={() => setDrawerVisible(false)}
        title={<span className="drawer-title">股权管理系统</span>}
      >
        {renderMenu('drawer')}
      </Drawer>

      <Layout>
        <Layout.Header className="app-header">
          <Button
            type="text"
            onClick={() =>
              isMobile ? setDrawerVisible(true) : setCollapsed((value) => !value)
            }
            icon={
              isMobile ? (
                <IconMenu />
              ) : collapsed ? (
                <IconMenuUnfold />
              ) : (
                <IconMenuFold />
              )
            }
            aria-label={isMobile ? '打开导航' : collapsed ? '展开侧边栏' : '收起侧边栏'}
          />

          <div style={{ flex: 1 }} />
          <ThemeToggle />
          <span className="header-divider" aria-hidden="true" />

          <Dropdown droplist={userMenu} position="br" trigger="click">
            <Button type="text" className="user-button">
              <Avatar size={30} className="user-avatar">
                {session.name.slice(0, 1)}
              </Avatar>
              <span className="user-meta">
                <span className="user-name">{session.name}</span>
                <span className="user-role">
                  <Tag size="small" color={ROLE_TAG_COLOR[session.role]}>
                    {ROLE_LABEL[session.role]}
                  </Tag>
                  {session.shareholderName && session.role === 'INVESTOR' && (
                    <span className="muted"> · 仅本人数据</span>
                  )}
                </span>
              </span>
            </Button>
          </Dropdown>
        </Layout.Header>

        <Layout.Content className="app-content" id="main-content">
          {children}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
