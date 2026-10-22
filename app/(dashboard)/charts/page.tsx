// 股权可视化页：服务端准备已脱敏的数据，客户端渲染饼图与 G6 结构树
import { redirect } from 'next/navigation';
import { requirePageUser } from '@/lib/auth';
import { getCapTable, getOwnershipTree } from '@/lib/equity';
import { PERMISSIONS, hasPermission } from '@/lib/rbac';
import { EquityPieChart, type EquityPieDatum } from '@/components/EquityPieChart';
import { OwnershipTree } from '@/components/OwnershipTree';

export const dynamic = 'force-dynamic';

export default async function ChartsPage() {
  const user = await requirePageUser();

  const canReadAll = hasPermission(user, PERMISSIONS.CHARTS_READ);
  const canReadOwn = hasPermission(user, PERMISSIONS.CHARTS_READ_OWN);
  if (!canReadAll && !canReadOwn) redirect('/forbidden');

  if (!canReadAll && !user.shareholderId) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: 48 }}>
        当前账号尚未绑定股东记录，无法查看股权图表，请联系管理员。
      </div>
    );
  }

  const scopeShareholderId = canReadAll
    ? undefined
    : user.shareholderId ?? undefined;

  const [rows, tree] = await Promise.all([
    getCapTable(undefined, scopeShareholderId),
    getOwnershipTree(scopeShareholderId),
  ]);

  const pieData: EquityPieDatum[] = rows.map((row) => ({
    name: row.shareholderName,
    value: row.percent,
    type: row.shareholderType,
  }));

  if (!canReadAll) {
    const ownTotal = rows.reduce((sum, row) => sum + row.percent, 0);
    const othersTotal = Math.round((100 - ownTotal) * 1_000_000) / 1_000_000;
    if (othersTotal > 0.0001) {
      pieData.push({
        name: '其他股东',
        value: othersTotal,
        type: 'INVESTOR',
      });
    }
  }

  const currentRoundName = rows[0]?.roundName ?? '暂无融资轮次';

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">股权结构</h1>
          <p className="page-subtitle">
            当前轮次：{currentRoundName}
            {!canReadAll ? ' · 投资人视角，其他股东已聚合脱敏' : ''}
          </p>
        </div>
      </div>

      <div className="chart-grid">
        <div className="panel">
          <h2 className="chart-panel-title">当前股权分布</h2>
          <EquityPieChart data={pieData} />
        </div>

        <div className="panel">
          <h2 className="chart-panel-title">股权层级与历史变更</h2>
          <OwnershipTree data={tree} />
        </div>
      </div>
    </>
  );
}
