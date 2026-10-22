// 审计日志写入：可与业务事务共享 Prisma TransactionClient
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

type AuditInput = {
  userId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  shareholderId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
};

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function writeAuditLog(
  input: AuditInput,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      shareholderId: input.shareholderId ?? null,
      beforeJson: toJson(input.before),
      afterJson: toJson(input.after),
      ip: input.ip ?? null,
    },
  });
}
