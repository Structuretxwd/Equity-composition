// 登录 API：校验密码、签发 HttpOnly 会话 Cookie，并按权限返回落地页
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate } from '@/lib/auth';
import { ApiError } from '@/lib/errors';
import { handleApiError } from '@/lib/api';
import { getLandingPath } from '@/lib/rbac';
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
} from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().trim().email('邮箱格式不正确'),
  password: z.string().min(8, '密码至少 8 位'),
});

export async function POST(request: Request) {
  try {
    const payload = loginSchema.parse(await request.json());
    const user = await authenticate(payload.email, payload.password);

    if (!user) {
      throw new ApiError(401, '邮箱或密码错误', 'INVALID_CREDENTIALS');
    }

    const token = await signSession(user.id);
    const response = NextResponse.json({
      ok: true,
      redirectTo: getLandingPath(user),
    });

    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
