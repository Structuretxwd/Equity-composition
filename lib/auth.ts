// 认证服务：读取数据库角色/权限，供页面与 API 二次校验使用
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { SESSION_COOKIE, verifySession } from './session';
import type { SessionUser } from './rbac';

const userWithAccess = {
  role: {
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  },
  shareholder: { select: { id: true, name: true } },
} satisfies Prisma.UserInclude;

type UserWithAccess = Prisma.UserGetPayload<{ include: typeof userWithAccess }>;

function toSessionUser(user: UserWithAccess): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role.name,
    permissions: user.role.permissions.map((item) => item.permission.key),
    shareholderId: user.shareholderId,
    shareholderName: user.shareholder?.name ?? null,
  };
}

export async function authenticate(email: string, password: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: userWithAccess,
  });

  if (!user || !user.isActive) return null;

  const passwordMatched = await bcrypt.compare(password, user.passwordHash);
  return passwordMatched ? toSessionUser(user) : null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySession(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: userWithAccess,
  });

  if (!user?.isActive) return null;
  return toSessionUser(user);
}

export async function requirePageUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}
