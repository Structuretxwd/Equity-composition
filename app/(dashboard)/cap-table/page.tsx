// 股东名册页：服务端二次校验权限，并按投资人身份收敛查询范围
import { redirect } from 'next/navigation';
import { requirePageUser } from '@/lib/auth';
import { getCapTable, getRounds } from '@/lib/equity';
import { PERMISSIONS, hasPermission } from '@/lib/rbac';
import { CapTableView } from '@/components/CapTableView';

export const dynamic = 'force-dynamic';

export default async function CapTablePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePageUser();

  const canReadAll = hasPermission(user, PERMISSIONS.CAP_TABLE_READ);
  const canReadOwn = hasPermission(user, PERMISSIONS.CAP_TABLE_READ_OWN);
  if (!canReadAll && !canReadOwn) redirect('/forbidden');

  const rounds = (await getRounds())
    .slice()
    .reverse()
    .map((round) => ({ id: round.id, name: round.name }));

  const requestedRoundId =
    typeof searchParams.roundId === 'string' ? searchParams.roundId : undefined;
  const activeRound =
    rounds.find((round) => round.id === requestedRoundId) ?? rounds[0] ?? null;

  const scopedShareholderId = canReadAll
    ? undefined
    : user.shareholderId ?? undefined;

  const rows =
    activeRound && (canReadAll || scopedShareholderId)
      ? await getCapTable(activeRound.id, scopedShareholderId)
      : [];

  return (
    <CapTableView
      rows={rows}
      rounds={rounds}
      activeRoundId={activeRound?.id ?? null}
      activeRoundName={activeRound?.name ?? ''}
      editable={hasPermission(user, PERMISSIONS.CAP_TABLE_WRITE)}
      scoped={!canReadAll}
    />
  );
}
