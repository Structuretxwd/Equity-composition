// 变更日志页：服务端按权限裁剪日志范围后再交给表格展示
import { redirect } from 'next/navigation';
import { requirePageUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS, hasPermission } from '@/lib/rbac';
import { AuditView } from '@/components/AuditView';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const user = await requirePageUser();

  const canReadAll = hasPermission(user, PERMISSIONS.AUDIT_READ);
  const canReadOwn = hasPermission(user, PERMISSIONS.AUDIT_READ_OWN);
  if (!canReadAll && !canReadOwn) redirect('/forbidden');

  const logs = await prisma.auditLog.findMany({
    where: canReadAll ? {} : { shareholderId: user.shareholderId ?? '__none__' },
    orderBy: { timestamp: 'desc' },
    take: 200,
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  return (
    <AuditView
      logs={logs.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        shareholderId: log.shareholderId,
        beforeJson: log.beforeJson,
        afterJson: log.afterJson,
        ip: log.ip,
        timestamp: log.timestamp.toISOString(),
        user: log.user,
      }))}
      scoped={!canReadAll}
    />
  );
}
