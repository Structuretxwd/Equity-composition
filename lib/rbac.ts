// RBAC 单一事实来源：角色、权限、导航与路由访问规则全部集中在此。
// 页面与数据层只能调用这里导出的函数，禁止各自散写角色判断。
import type { Role, SessionUser } from './types';

export const ROLES: Role[] = ['ADMIN', 'PARTNER', 'INVESTOR'];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: '管理员',
  PARTNER: '合伙人',
  INVESTOR: '投资人',
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  ADMIN: '完全控制：编辑持股、运行模拟、导入导出与重置数据',
  PARTNER: '只读访问全部数据，可导出数据库备份，不可修改持股',
  INVESTOR: '仅查看自己的持股与结构占比，数据自动隔离',
};

export const PERMISSIONS = {
  CAP_TABLE_READ_ALL: 'cap_table:read_all',
  CAP_TABLE_READ_OWN: 'cap_table:read_own',
  CAP_TABLE_WRITE: 'cap_table:write',
  ROUNDS_READ: 'rounds:read',
  CHARTS_READ_ALL: 'charts:read_all',
  CHARTS_READ_OWN: 'charts:read_own',
  AUDIT_READ: 'audit:read',
  SIMULATOR_RUN: 'simulator:run',
  DATA_EXPORT: 'data:export',
  DATA_IMPORT: 'data:import',
  DATA_RESET: 'data:reset',
  CONSOLE_ACCESS: 'console:access',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  ADMIN: Object.values(PERMISSIONS),
  PARTNER: [
    PERMISSIONS.CAP_TABLE_READ_ALL,
    PERMISSIONS.ROUNDS_READ,
    PERMISSIONS.CHARTS_READ_ALL,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.DATA_EXPORT,
  ],
  INVESTOR: [
    PERMISSIONS.CAP_TABLE_READ_OWN,
    PERMISSIONS.CHARTS_READ_OWN,
  ],
};

export type NavItem = {
  path: string;
  label: string;
  icon: 'users' | 'calendar' | 'chart' | 'history' | 'experiment' | 'storage' | 'console';
  permission: PermissionKey;
};

export const NAV_ITEMS: NavItem[] = [
  {
    path: '/cap-table',
    label: '股东名册',
    icon: 'users',
    permission: PERMISSIONS.CAP_TABLE_READ_ALL,
  },
  {
    path: '/rounds',
    label: '融资轮次',
    icon: 'calendar',
    permission: PERMISSIONS.ROUNDS_READ,
  },
  {
    path: '/charts',
    label: '股权结构',
    icon: 'chart',
    permission: PERMISSIONS.CHARTS_READ_ALL,
  },
  {
    path: '/audit',
    label: '变更日志',
    icon: 'history',
    permission: PERMISSIONS.AUDIT_READ,
  },
  {
    path: '/simulator',
    label: '稀释模拟器',
    icon: 'experiment',
    permission: PERMISSIONS.SIMULATOR_RUN,
  },
  {
    path: '/data',
    label: '数据管理',
    icon: 'storage',
    permission: PERMISSIONS.DATA_EXPORT,
  },
  {
    path: '/console',
    label: '控制台',
    icon: 'console',
    permission: PERMISSIONS.CONSOLE_ACCESS,
  },
];

export function hasPermission(role: Role, permission: PermissionKey): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** 静态导出开启 trailingSlash 后，usePathname 可能返回 /cap-table/，统一去掉尾部斜杠再判断 */
export function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
}

export function canAccessRoute(role: Role, pathname: string): boolean {
  const path = normalizePath(pathname);

  if (path === '/cap-table') {
    return (
      hasPermission(role, PERMISSIONS.CAP_TABLE_READ_ALL) ||
      hasPermission(role, PERMISSIONS.CAP_TABLE_READ_OWN)
    );
  }
  if (path === '/charts') {
    return (
      hasPermission(role, PERMISSIONS.CHARTS_READ_ALL) ||
      hasPermission(role, PERMISSIONS.CHARTS_READ_OWN)
    );
  }

  const item = NAV_ITEMS.find((nav) => path === nav.path || path.startsWith(`${nav.path}/`));
  return Boolean(item && hasPermission(role, item.permission));
}

export function getVisibleNavItems(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => canAccessRoute(role, item.path));
}

export function getLandingPath(role: Role): string {
  return getVisibleNavItems(role)[0]?.path ?? '/cap-table';
}

/** 敏感写入前必须再次调用，不能只依赖按钮禁用 */
export function canEditCapTable(role: Role): boolean {
  return hasPermission(role, PERMISSIONS.CAP_TABLE_WRITE);
}

export function assertCanEditCapTable(role: Role): void {
  if (!canEditCapTable(role)) {
    throw new Error('当前角色没有修改持股比例的权限');
  }
}

export function canRunSimulator(role: Role): boolean {
  return hasPermission(role, PERMISSIONS.SIMULATOR_RUN);
}

export function canExportDatabase(role: Role): boolean {
  return hasPermission(role, PERMISSIONS.DATA_EXPORT);
}

export function canImportDatabase(role: Role): boolean {
  return hasPermission(role, PERMISSIONS.DATA_IMPORT);
}

export function canResetDatabase(role: Role): boolean {
  return hasPermission(role, PERMISSIONS.DATA_RESET);
}

export function canAccessConsole(role: Role): boolean {
  return hasPermission(role, PERMISSIONS.CONSOLE_ACCESS);
}

export function canViewAllCapTable(role: Role): boolean {
  return hasPermission(role, PERMISSIONS.CAP_TABLE_READ_ALL);
}

/** INVESTOR 的数据范围收敛：返回自身 shareholderId，其余角色返回 undefined 表示全量 */
export function getDataScope(session: SessionUser): string | undefined {
  if (canViewAllCapTable(session.role)) return undefined;
  return session.shareholderId ?? '__no_shareholder__';
}
