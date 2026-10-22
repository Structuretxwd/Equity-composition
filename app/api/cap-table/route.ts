// 股东名册 API：GET 按权限收敛数据范围；PATCH 仅 ADMIN 可编辑并强制写审计日志
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/audit';
import { requireApiUser, handleApiError } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { getCapTable } from '@/lib/equity';
import { PERMISSIONS, canViewAllCapTable } from '@/lib/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  roundId: z.string().min(1, '缺少轮次 ID'),
  shareholderId: z.string().min(1, '缺少股东 ID'),
  postRoundPercent: z.number().min(0, '持股比例不能为负数').max(100, '持股比例不能超过 100%'),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser([
      PERMISSIONS.CAP_TABLE_READ,
      PERMISSIONS.CAP_TABLE_READ_OWN,
    ]);
    const roundId = request.nextUrl.searchParams.get('roundId') ?? undefined;
    const canReadAll = canViewAllCapTable(user);

    // 关键：投资人没有绑定股东记录时返回空集，绝不退化为全量查询
    if (!canReadAll && !user.shareholderId) {
      return NextResponse.json({ rows: [], scoped: true });
    }

    const rows = await getCapTable(roundId, canReadAll ? undefined : user.shareholderId ?? undefined);
    return NextResponse.json({ rows, scoped: !canReadAll });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireApiUser(PERMISSIONS.CAP_TABLE_WRITE);
    const payload = patchSchema.parse(await request.json());

    const snapshot = await prisma.capTableSnapshot.findUnique({
      where: {
        roundId_shareholderId: {
          roundId: payload.roundId,
          shareholderId: payload.shareholderId,
        },
      },
      include: { shareholder: true, round: true },
    });

    if (!snapshot) {
      throw new ApiError(404, '该轮次下不存在该股东的持股记录', 'NOT_FOUND');
    }

    const aggregate = await prisma.capTableSnapshot.aggregate({
      where: { roundId: payload.roundId },
      _sum: { postRoundPercent: true },
    });
    const currentTotal = Number(aggregate._sum.postRoundPercent ?? 0);
    const nextTotal =
      currentTotal - Number(snapshot.postRoundPercent) + payload.postRoundPercent;

    if (nextTotal > 100.000001) {
      throw new ApiError(
        422,
        `修改后总持股比例为 ${nextTotal.toFixed(4)}%，超过 100%`,
        'PERCENT_OVERFLOW',
      );
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip');

    const updated = await prisma.$transaction(async (tx) => {
      const nextSnapshot = await tx.capTableSnapshot.update({
        where: { id: snapshot.id },
        data: { postRoundPercent: payload.postRoundPercent },
      });

      await tx.shareHolding.updateMany({
        where: {
          shareholderId: payload.shareholderId,
          fundingRoundId: payload.roundId,
        },
        data: { sharesPercent: payload.postRoundPercent },
      });

      await writeAuditLog(
        {
          userId: user.id,
          action: 'CAP_TABLE_EDIT',
          entity: 'CapTableSnapshot',
          entityId: snapshot.id,
          shareholderId: payload.shareholderId,
          before: {
            shareholder: snapshot.shareholder.name,
            round: snapshot.round.name,
            postRoundPercent: Number(snapshot.postRoundPercent),
          },
          after: {
            shareholder: snapshot.shareholder.name,
            round: snapshot.round.name,
            postRoundPercent: payload.postRoundPercent,
          },
          ip,
        },
        tx,
      );

      return nextSnapshot;
    });

    const latestRound = await prisma.fundingRound.findFirst({
      orderBy: { date: 'desc' },
      select: { id: true },
    });

    return NextResponse.json({
      snapshot: {
        ...updated,
        postRoundPercent: Number(updated.postRoundPercent),
      },
      totalPercent: nextTotal,
      warning:
        snapshot.roundId !== latestRound?.id
          ? '当前编辑的是历史轮次，后续轮次快照不会自动重算，请确认业务规则。'
          : undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
