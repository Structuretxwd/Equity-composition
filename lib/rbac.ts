// 数据库驱动 RBAC 的权限判定层：只判断权限 Key，绝不比较角色名称
import { ApiError } from './errors';

export const PERMISSIONS = {
  CAP_TABLE_READ: 'cap_table:read',
  CAP_TABLE_READ_OWN: 'cap_table:read_own',
  CAP_TABLE_WRITE: 'cap_table:write',
  ROUNDS_READ: 'rounds:read',
  CHARTS_READ: 'charts:read',
  CHARTS_READ_OWN: 'charts:read_own',
  AUDIT_READ: 'audit:read',
  AUDIT_READ_OWN: 'audit:read_own',
  SIMULATOR_RUN: 'simulator:run',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  shareholderId: string | null;
  shareholderName: string | null;
};

export function hasPermission(user: SessionUser, permission: PermissionKey): boolean {
  return user.permissions.includes(permission);
}

export function hasAnyPermission(user: SessionUser, permissions: PermissionKey[]): boolean {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function assertPermission(user: SessionUser, permission: PermissionKey): void {
  if (!hasPermission(user, permission)) {
    throw new ApiError(403, '当前账号没有执行该操作的权限', 'FORBIDDEN');
  }
}

export function canEditCapTable(user: SessionUser): boolean {
  return hasPermission(user, PERMISSIONS.CAP_TABLE_WRITE);
}

export function canViewAllCapTable(user: SessionUser): boolean {
  return hasPermission(user, PERMISSIONS.CAP_TABLE_READ);
}

export function canViewInvestorData(
  user: SessionUser,
  targetShareholderId: string,
): boolean {
  if (canViewAllCapTable(user)) return true;
  return Boolean(user.shareholderId) && user.shareholderId === targetShareholderId;
}

/** 根据权限集合决定登录后的默认落地页，避免硬编码角色分支 */
export function getLandingPath(user: SessionUser): string {
  if (canEditCapTable(user)) return '/cap-table';
  if (hasPermission(user, PERMISSIONS.ROUNDS_READ)) return '/rounds';
  if (hasAnyPermission(user, [PERMISSIONS.CHARTS_READ, PERMISSIONS.CHARTS_READ_OWN])) {
    return '/charts';
  }
  return '/cap-table';
}
