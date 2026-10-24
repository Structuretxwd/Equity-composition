// 稀释模拟器（ADMIN 专用）：只读当前轮次，在内存中计算新一轮稀释结果，绝不写入数据库。
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  InputNumber,
  Select,
  Switch,
  Table,
  Tag,
} from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import { MetricStrip } from '@/components/MetricStrip';
import { PageHeader } from '@/components/PageHeader';
import { useAppDb } from '@/components/DbProvider';
import { useSession } from '@/components/SessionContext';
import { simulateDilution } from '@/lib/equity';
import { formatPercent, round6 } from '@/lib/format';
import { getCapTable, listRounds } from '@/lib/repo';
import { canRunSimulator } from '@/lib/rbac';
import type { ShareholderType, SimulationResult } from '@/lib/types';

const TYPE_META: Record<ShareholderType, { label: string; color: string }> = {
  FOUNDER: { label: '创始人', color: 'blue' },
  INVESTOR: { label: '投资人', color: 'purple' },
  NEW_SHAREHOLDER: { label: '新股东', color: 'green' },
};

export default function SimulatorPage() {
  const { db, version } = useAppDb();
  const session = useSession();
  const allowed = canRunSimulator(session.role);

  const rounds = useMemo(() => listRounds(db), [db, version]);
  const [roundId, setRoundId] = useState('');
  const [newPercent, setNewPercent] = useState(10);
  const [protection, setProtection] = useState(true);

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
    () => (activeRound ? getCapTable(db, activeRound.id) : []),
    [db, version, activeRound?.id],
  );

  const outcome = useMemo(() => {
    if (!activeRound) return { data: null, error: '暂无融资轮次数据' };
    try {
      return {
        data: simulateDilution(rows, Number(newPercent), protection),
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : '模拟计算失败',
      };
    }
  }, [rows, newPercent, protection, activeRound]);

  const protectedSum = round6(
    rows
      .filter((row) => row.shareholderType === 'INVESTOR')
      .reduce((sum, row) => sum + row.percent, 0),
  );

  const columns: TableColumnProps<SimulationResult>[] = [
    {
      title: '股东',
      dataIndex: 'name',
      width: 180,
      render: (value, row) => (
        <span style={{ fontWeight: row.shareholderId === 'new-investor' ? 600 : 400 }}>
          {String(value)}
        </span>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (value) => {
        const meta = TYPE_META[value as ShareholderType];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '融资前',
      dataIndex: 'before',
      width: 110,
      align: 'right',
      render: (value) => formatPercent(Number(value)),
    },
    {
      title: '融资后',
      dataIndex: 'after',
      width: 110,
      align: 'right',
      render: (value) => <strong>{formatPercent(Number(value))}</strong>,
    },
    {
      title: '变化',
      dataIndex: 'delta',
      width: 150,
      align: 'right',
      render: (value) => {
        const delta = Number(value);
        if (Math.abs(delta) < 0.000001) return <span className="muted">0.00%</span>;
        return (
          <span className={delta > 0 ? 'delta-pos' : 'delta-neg'}>
            {delta > 0 ? '+' : ''}
            {delta.toFixed(2)}%
          </span>
        );
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 130,
      render: (_, row) => {
        if (row.shareholderId === 'new-investor') return <Tag color="blue">新进入</Tag>;
        if (row.protectedByRound) return <Tag color="green">受保护 · 未稀释</Tag>;
        return <Tag color="orange">按比例稀释</Tag>;
      },
    },
  ];

  if (!allowed) {
    return (
      <div className="page-stack">
        <Alert
          type="error"
          showIcon
          content="稀释模拟器仅对管理员开放。当前账号没有 simulator:run 权限。"
        />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="股权稀释模拟器"
        subtitle="输入新一轮融资比例，预览各股东的稀释结果。所有计算只在内存中完成，不会写入数据库。"
        extra={<Tag color="red">仅管理员</Tag>}
      />

      <Alert
        type="info"
        showIcon
        content="模拟结果不会改变股东名册。确认方案可行后，仍需由管理员在“股东名册”中正式调整比例，系统才会持久化并写入审计日志。"
      />

      <div className="panel">
        <div className="simulator-toolbar">
          <div className="field">
            <span className="field-label">基准轮次</span>
            <Select
              style={{ width: 210 }}
              value={activeRound?.id}
              onChange={(value) => setRoundId(String(value))}
              options={rounds.map((round) => ({ label: round.name, value: round.id }))}
            />
          </div>

          <div className="field">
            <span className="field-label">新一轮融资比例</span>
            <InputNumber
              value={newPercent}
              min={0.01}
              max={99.99}
              step={0.5}
              precision={2}
              suffix="%"
              style={{ width: 180 }}
              onChange={(value) => setNewPercent(Number(value ?? 0))}
            />
          </div>

          <div className="field">
            <span className="field-label">投资人保护（现有投资人不被稀释）</span>
            <Switch checked={protection} onChange={setProtection} />
          </div>

          <div style={{ flex: 1 }} />
          <Tag color="gray">
            当前基准：{activeRound?.name ?? '—'} · 现有投资人合计 {formatPercent(protectedSum)}
          </Tag>
        </div>
      </div>

      <MetricStrip
        items={[
          {
            label: '模拟轮次',
            value: activeRound?.name ?? '—',
            hint: '基准轮后持股快照',
            compact: true,
          },
          {
            label: '新投资人',
            value: formatPercent(Number(newPercent)),
            hint: '新进入股东获得的比例',
          },
          {
            label: '受保护投资人',
            value: protection ? formatPercent(protectedSum) : '未启用',
            hint: '该部分比例保持不变',
          },
          {
            label: '融资后合计',
            value: outcome.data
              ? formatPercent(
                  round6(outcome.data.results.reduce((sum, row) => sum + row.after, 0)),
                )
              : '—',
            hint: '应为 100.00%',
          },
        ]}
      />

      {outcome.error && (
        <Alert type="error" showIcon content={outcome.error} />
      )}

      <section className="panel table-panel">
        <div className="panel-head" style={{ padding: '18px 20px 0', marginBottom: 14 }}>
          <div>
            <h2 className="panel-title">稀释预览</h2>
            <p className="panel-subtitle">
              投资人保护开启时，类型为“投资人”的现有股东保持原比例，其余股东按比例承担稀释。
            </p>
          </div>
        </div>
        <Table
          columns={columns}
          data={outcome.data?.results ?? []}
          rowKey="shareholderId"
          pagination={false}
          scroll={{ x: 880 }}
          noDataElement={<div style={{ padding: 36 }}>暂无可模拟的数据</div>}
        />
      </section>
    </div>
  );
}
