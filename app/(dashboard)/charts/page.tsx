// 股权结构可视化：Recharts 环形图展示当前分布，G6 树状图展示历史轮次演化。
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Select, Space, Tag } from '@arco-design/web-react';
import {
  IconCalendar,
  IconSwap,
  IconUserGroup,
  IconUser,
} from '@arco-design/web-react/icon';
import { EquityPieChart, type EquityPieDatum } from '@/components/EquityPieChart';
import { OwnershipTree } from '@/components/OwnershipTree';
import { PageHeader } from '@/components/PageHeader';
import { useAppDb } from '@/components/DbProvider';
import { useSession } from '@/components/SessionContext';
import { buildOwnershipTree } from '@/lib/equity';
import { formatPercent, formatRoundDate, round6 } from '@/lib/format';
import { getCapTable, listRounds } from '@/lib/repo';
import { getDataScope } from '@/lib/rbac';

export default function ChartsPage() {
  const { db, version } = useAppDb();
  const session = useSession();
  const scope = getDataScope(session);

  const rounds = useMemo(() => listRounds(db), [db, version]);
  const [roundId, setRoundId] = useState('');

  useEffect(() => {
    if (rounds.length === 0) {
      setRoundId('');
      return;
    }
    setRoundId((current) =>
      rounds.some((round) => round.id === current) ? current : rounds[0].id,
    );
  }, [rounds]);

  const activeRound = rounds.find((round) => round.id === roundId) ?? rounds[0];
  const rows = useMemo(
    () => (activeRound ? getCapTable(db, activeRound.id, scope) : []),
    [db, version, activeRound?.id, scope],
  );

  const pieData = useMemo<EquityPieDatum[]>(() => {
    if (!activeRound) return [];
    if (scope) {
      const own = rows[0];
      if (!own) return [];
      return [
        { name: session.shareholderName ?? '我的持股', value: own.percent },
        { name: '其他股东（合并）', value: round6(Math.max(0, 100 - own.percent)) },
      ];
    }
    return rows.map((row) => ({
      name: row.shareholderName,
      value: row.percent,
      type: row.shareholderType,
    }));
  }, [activeRound, rows, scope, session.shareholderName]);

  const tree = useMemo(() => buildOwnershipTree(rounds, scope), [rounds, scope]);
  const investorCount =
    activeRound?.shareholders.filter((item) => item.type === 'INVESTOR').length ?? 0;
  const totalPercent = round6(rows.reduce((sum, row) => sum + row.percent, 0));

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="OWNERSHIP MAP"
        title="股权结构可视化"
        subtitle={
          activeRound
            ? `当前快照：${activeRound.name} · ${formatRoundDate(activeRound.date)}`
            : '暂无融资轮次数据'
        }
        extra={
          <Space wrap>
            <Select
              style={{ width: 210 }}
              value={activeRound?.id}
              onChange={(value) => setRoundId(String(value))}
              options={rounds.map((round) => ({ label: round.name, value: round.id }))}
              placeholder="选择融资轮次"
            />
            <Tag color={scope ? 'green' : 'blue'}>{scope ? '投资人视角' : '全量视角'}</Tag>
          </Space>
        }
      />

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <IconCalendar />
          </div>
          <div className="stat-body">
            <div className="stat-label">历史融资轮次</div>
            <div className="stat-value">{rounds.length}</div>
            <div className="stat-hint">从天使轮到最新一轮</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <IconUserGroup />
          </div>
          <div className="stat-body">
            <div className="stat-label">本轮股东数</div>
            <div className="stat-value">{activeRound?.shareholders.length ?? 0}</div>
            <div className="stat-hint">含创始人与机构投资人</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <IconUser />
          </div>
          <div className="stat-body">
            <div className="stat-label">投资人数量</div>
            <div className="stat-value">{investorCount}</div>
            <div className="stat-hint">
              {activeRound?.investorProtection ? '本轮享有不被稀释保护' : '本轮按比例稀释'}
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <IconSwap />
          </div>
          <div className="stat-body">
            <div className="stat-label">{scope ? '本人持股' : '比例合计'}</div>
            <div className="stat-value">
              {scope ? formatPercent(rows[0]?.percent ?? 0) : formatPercent(totalPercent)}
            </div>
            <div className="stat-hint">{scope ? '仅展示本人数据' : '所有股东合计应为 100%'}</div>
          </div>
        </div>
      </div>

      {scope && (
        <Alert
          type="info"
          showIcon
          content="投资人视角下，饼图仅展示本人持股与“其他股东”合并值，树状图也会隐藏其他股东的真实姓名，避免越权查看。"
        />
      )}

      <div className="chart-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">轮后股权分布</h2>
              <p className="panel-subtitle">
                {activeRound ? `${activeRound.name} 完成后的持股比例` : '暂无数据'}
              </p>
            </div>
            <Tag color="blue">{activeRound ? formatPercent(activeRound.totalDilutionPercent) : '—'} 稀释</Tag>
          </div>
          <EquityPieChart data={pieData} height={350} />
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">历史结构演化</h2>
              <p className="panel-subtitle">公司 → 融资轮次 → 股东，自左向右展示每一轮变化</p>
            </div>
          </div>
          <OwnershipTree data={tree} height={350} />
        </section>
      </div>
    </div>
  );
}
