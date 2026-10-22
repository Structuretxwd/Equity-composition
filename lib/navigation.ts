// 导航配置：服务端据此计算可见菜单，客户端仅负责渲染
import {
  PERMISSIONS,
  hasAnyPermission,
  type PermissionKey,
  type SessionUser,
} from './rbac';

export type NavItem = {
  path: string;
  label: string;
  permissions: PermissionKey[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    path: '/cap-table',
    label: '股东名册',
    permissions: [PERMISSIONS.CAP_TABLE_READ, PERMISSIONS.CAP_TABLE_READ_OWN],
  },
  { path: '/rounds', label: '融资轮次', permissions: [PERMISSIONS.ROUNDS_READ] },
  {
    path: '/charts',
    label: '股权结构',
    permissions: [PERMISSIONS.CHARTS_READ, PERMISSIONS.CHARTS_READ_OWN],
  },
  {
    path: '/audit',
    label: '变更日志',
    permissions: [PERMISSIONS.AUDIT_READ, PERMISSIONS.AUDIT_READ_OWN],
  },
  { path: '/simulator', label: '稀释模拟器', permissions: [PERMISSIONS.SIMULATOR_RUN] },
];

export function getAllowedNavPaths(user: SessionUser): string[] {
  return NAV_ITEMS.filter((item) => hasAnyPermission(user, item.permissions)).map(
    (item) => item.path,
  );
}
