// 审计日志 API：ADMIN/PARTNER 可见全量，INVESTOR 仅可见与自身股东记录相关的日志
import { NextResponse } from 'next/server';
import { handleApiError, requireApiUser } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS, hasPermission } from '@/lib/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireApiUser([
      PERMISSIONS.AUDIT_READ,
      PERMISSIONS.AUDIT_READ_OWN,
    ]);
    const canReadAll = hasPermission(user, PERMISSIONS.AUDIT_READ);

    const logs = await prisma.auditLog.findMany({
      where: canReadAll ? {} : { shareholderId: user.shareholderId ?? '__none__' },
      orderBy: { timestamp: 'desc' },
      take: 200,
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json({
      logs: logs.map((log) => ({
        ...log,
        timestamp: log.timestamp.toISOString(),
      })),
      scoped: !canReadAll,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
