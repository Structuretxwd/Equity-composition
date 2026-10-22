// 融资轮次 API：返回按时间倒序的轮次及每轮快照
import { NextResponse } from 'next/server';
import { handleApiError, requireApiUser } from '@/lib/api';
import { getRounds } from '@/lib/equity';
import { PERMISSIONS } from '@/lib/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireApiUser(PERMISSIONS.ROUNDS_READ);
    const rounds = await getRounds();
    return NextResponse.json({ rounds: rounds.slice().reverse() });
  } catch (error) {
    return handleApiError(error);
  }
}
