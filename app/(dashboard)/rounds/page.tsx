// 融资轮次：展示轮次历史、稀释比例与投资人不被稀释标记。
'use client';

import { useMemo } from 'react';
import { Alert, Progress, Space, Tag } from '@arco-design/web-react';
import { PageHeader } from '@/components/PageHeader';
import { useAppDb } from '@/components/DbProvider';
import { formatPercent, formatRoundDate } from '@/lib/format';
import { listRounds } from '@/lib/repo';
import type { ShareholderType } from '@/lib/types';

const TYPE_META: Record<ShareholderType, { label: string; color: string }> = {
  FOUNDER: { label: '创始人', color: 'blue' },
  INVESTOR: { label: '投资人', color: 'purple' },
  NEW_SHAREHOLDER: { label: '新股东', color: 'green' },
};

const BAR_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
];

export default function RoundsPage() {
  const { db, version } = useAppDb();
  const rounds = useMemo(() => listRounds(db), [db, version]);

  return (
    <div className="page-stack">
      <PageHeader
        title="融资轮次"
        subtitle="按时间倒序查看每轮融资的稀释比例、投资人保护策略与轮后持股快照。"
      />

      <Alert
        type="info"
        showIcon
        content="“投资人保护”表示该轮融资中已有投资人（类型为 INVESTOR）不承担稀释，稀释仅由创始人与新股东按比例承担。该标记会同步影响稀释模拟器。"
      />

      <div className="round-list">
        {rounds.map((round, index) => (
          <article className="round-card" key={round.id}>
            <div className="round-card-head">
              <div>
                <h2 className="round-name">
                  第 {rounds.length - index} 轮 · {round.name}
                </h2>
                <div className="round-date">交割日期 {formatRoundDate(round.date)}</div>
              </div>
              <div className="round-tags">
                <Tag color="blue">本轮稀释 {formatPercent(round.totalDilutionPercent)}</Tag>
                {round.investorProtection ? (
                  <Tag color="green">投资人保护 · 不被稀释</Tag>
                ) : (
                  <Tag color="gray">全体按比例稀释</Tag>
                )}
                <Tag color="gray">{round.shareholders.length} 位股东</Tag>
              </div>
            </div>

            <div className="round-participants">
              {round.shareholders.map((item, participantIndex) => {
                const meta = TYPE_META[item.type];
                return (
                  <div className="round-participant" key={item.shareholderId}>
                    <span className="round-participant-name">
                      <Space size={6}>
                        <span>{item.name}</span>
                        <Tag size="small" color={meta.color}>
                          {meta.label}
                        </Tag>
                        {!item.dilutionApplied && (
                          <Tag size="small" color="green">
                            未稀释
                          </Tag>
                        )}
                      </Space>
                    </span>
                    <Progress
                      percent={Math.min(100, item.percent)}
                      showText={false}
                      size="small"
                      color={BAR_COLORS[participantIndex % BAR_COLORS.length]}
                    />
                    <span className="round-participant-value">
                      {formatPercent(item.percent)}
                    </span>
                  </div>
                );
              })}
            </div>
          </article>
        ))}

        {rounds.length === 0 && (
          <div className="panel">
            <p className="page-subtitle" style={{ margin: 0 }}>
              暂无融资轮次数据。管理员可在后续版本中通过数据库导入恢复备份。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
