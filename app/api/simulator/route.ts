// 稀释模拟 API：ADMIN 专用，服务端重新读取最新持股并计算，前端无法绕过权限
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError, requireApiUser } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { getCapTable, simulateDilution } from '@/lib/equity';
import { PERMISSIONS } from '@/lib/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const simulatorSchema = z.object({
  newInvestorPercent: z.number().gt(0, '融资比例必须大于 0').lt(100, '融资比例必须小于 100%'),
  investorProtection: z.boolean(),
});

export async function POST(request: Request) {
  try {
    await requireApiUser(PERMISSIONS.SIMULATOR_RUN);
    const payload = simulatorSchema.parse(await request.json());
    const rows = await getCapTable();

    try {
      const result = simulateDilution(
        rows,
        payload.newInvestorPercent,
        payload.investorProtection,
      );
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof Error) {
        throw new ApiError(422, error.message, 'SIMULATION_INVALID');
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
