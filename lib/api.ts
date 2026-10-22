// API 权限入口：所有 Route Handler 必须先通过这里的登录与权限校验
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiError } from './errors';
import { getSessionUser } from './auth';
import {
  hasAnyPermission,
  type PermissionKey,
  type SessionUser,
} from './rbac';

export async function requireApiUser(
  required?: PermissionKey | PermissionKey[],
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new ApiError(401, '登录状态已失效，请重新登录', 'UNAUTHORIZED');
  }

  if (required) {
    const keys = Array.isArray(required) ? required : [required];
    if (!hasAnyPermission(user, keys)) {
      throw new ApiError(403, '当前账号没有访问该资源的权限', 'FORBIDDEN');
    }
  }

  return user;
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: '请求参数校验失败', code: 'VALIDATION_ERROR', details: error.flatten() },
      { status: 400 },
    );
  }

  console.error('[api:unhandled]', error);
  return NextResponse.json(
    { error: '服务器内部错误', code: 'INTERNAL_ERROR' },
    { status: 500 },
  );
}
