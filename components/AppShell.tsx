// 应用外壳：侧边导航、顶栏、主题切换与退出登录。
// 导航项完全由 lib/rbac.ts 的角色权限决定，不在组件内散写角色判断。
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Avatar,
  Button,
  Drawer,
  Dropdown,
  Layout,
  Menu,
  Tag,
  Tooltip,
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

/**
 * 侧边导航：选中项背后的浮动色块会随路由滑动，
 * 收起时用 Tooltip 保留可读性，避免只剩图标造成识别困难。
 */
function SidebarNav({
  items,
  activePath,
  compact,
  onNavigate,
}: {
  items: NavItem[];
  activePath?: string;
  compact: boolean;
  onNavigate: (path: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ top: 0, height: 36, ready: false });
  const [pillAnimated, setPillAnimated] = useState(false);

  // 首次定位不做过渡：避免打开页面时色块从顶部滑下来，只有后续切换才滑动。
  useEffect(() => {
    if (!pill.ready || pillAnimated) return;
    const timer = window.setTimeout(() => setPillAnimated(true), 120);
    return () => window.clearTimeout(timer);
  }, [pill.ready, pillAnimated]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    let frame = 0;
    const measure = () => {
      const selected = wrap.querySelector<HTMLElement>(
        '.arco-menu-item.arco-menu-selected',
      );
      if (!selected) {
        setPill((current) => (current.ready ? { ...current, ready: false } : current));
        return;
      }
      const wrapRect = wrap.getBoundingClientRect();
      const itemRect = selected.getBoundingClientRect();
      setPill({
        top: itemRect.top - wrapRect.top,
        height: itemRect.height,
        ready: true,
      });
    };

    measure();
    frame = window.requestAnimationFrame(measure);

    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(wrap);
    window.addEventListener('resize', measure);
    wrap.addEventListener('scroll', measure, true);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      wrap.removeEventListener('scroll', measure, true);
    };
  }, [activePath, compact, items.length]);

  return (
    <div className="app-nav-wrap" ref={wrapRef} data-compact={compact}>
      <span
        className="nav-pill"
        aria-hidden="true"
        data-ready={pill.ready}
        data-animate={pillAnimated}
        style={{ transform: `translateY(${pill.top}px)`, height: pill.height }}
      />
      <Menu
        className="app-nav"
        selectedKeys={activePath ? [activePath] : []}
        onClickMenuItem={(key) => onNavigate(key)}
      >
        {items.map((item) => (
          <Menu.Item key={item.path}>
            <Tooltip
              content={item.label}
              position="right"
              mini
              disabled={!compact}
            >
              <span className="nav-icon">{NAV_ICONS[item.icon]}</span>
            </Tooltip>
            {!compact && <span className="nav-label">{item.label}</span>}
          </Menu.Item>
        ))}
      </Menu>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [hasNavigated, setHasNavigated] = useState(false);

  const items = useMemo(() => getVisibleNavItems(session.role), [session.role]);
  const activePath =
    items.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))?.path ??
    items[0]?.path;
  // 点击后立即高亮目标项（路由仍在加载），让切换有即时反馈。
  const displayPath = pendingPath ?? activePath;
  const pageTitle =
    items.find((item) => item.path === displayPath)?.label ?? '股权管理';

  useEffect(() => {
    document.title = `${pageTitle} · 股权管理系统`;
  }, [pageTitle]);

  // 静态导出下每个页面是独立分块，提前预取可消除第一次切换的白等。
  useEffect(() => {
    const paths = items.map((item) => item.path);
    if (paths.length === 0) return;

    if (typeof window.requestIdleCallback !== 'function') {
      const timer = window.setTimeout(() => paths.forEach((path) => router.prefetch(path)), 500);
      return () => window.clearTimeout(timer);
    }

    const idle = window.requestIdleCallback(
      () => paths.forEach((path) => router.prefetch(path)),
      { timeout: 800 },
    );
    return () => window.cancelIdleCallback(idle);
  }, [items, router]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    setDrawerVisible(false);
    setPendingPath(null);
    const content = document.getElementById('main-content');
    if (content) content.scrollTop = 0;
  }, [pathname]);

  // 路由异常时兜底清除等待态，避免进度条一直挂着。
  useEffect(() => {
    if (!pendingPath) return;
    const timer = window.setTimeout(() => setPendingPath(null), 5000);
    return () => window.clearTimeout(timer);
  }, [pendingPath]);

  function navigate(path: string) {
    if (path === activePath) {
      setDrawerVisible(false);
      return;
    }
    setHasNavigated(true);
    setPendingPath(path);
    router.prefetch(path);
    router.push(path);
    setDrawerVisible(false);
  }

  function logout() {
    clearSession();
    router.replace('/login');
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

          <SidebarNav
            items={items}
            activePath={displayPath}
            compact={collapsed}
            onNavigate={navigate}
          />

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
        <SidebarNav
          items={items}
          activePath={displayPath}
          compact={false}
          onNavigate={navigate}
        />
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

          <span className="app-header-title">{pageTitle}</span>

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

          {pendingPath && <span className="app-progress" aria-hidden="true" />}
        </Layout.Header>

        <Layout.Content
          className="app-content"
          id="main-content"
          aria-busy={pendingPath ? true : undefined}
        >
          <div
            className={hasNavigated ? 'page-transition is-animating' : 'page-transition'}
            key={pathname}
          >
            {children}
          </div>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
