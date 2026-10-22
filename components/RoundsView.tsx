// 融资轮次视图：卡片展示每轮融资、投资保护状态与投后持股
'use client';

import { Card, Progress, Space, Tag } from '@arco-design/web-react';
import type { RoundSummary } from '@/lib/equity';
import { formatRoundDate } from '@/lib/format';

export function RoundsView({ rounds }: { rounds: RoundSummary[] }) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">融资轮次</h1>
          <p className="page-subtitle">按时间倒序展示历次融资及投后股权结构</p>
        </div>
        <Tag color="blue">共 {rounds.length} 轮</Tag>
      </div>

      <div className="round-list">
        {rounds.map((round) => (
          <Card
            key={round.id}
            title={
              <Space>
                <span>{round.name}</span>
                <Tag color={round.investorProtection ? 'green' : 'gray'}>
                  投资人保护{round.investorProtection ? '生效' : '未生效'}
                </Tag>
              </Space>
            }
            extra={<span className="muted">{formatRoundDate(round.date)}</span>}
          >
            <Space size="large" wrap>
              <span>
                本轮新股比例 <strong>{round.totalDilutionPercent.toFixed(2)}%</strong>
              </span>
              <span className="muted">投后股东数 {round.shareholders.length}</span>
            </Space>

            <div className="round-participants">
              {round.shareholders.map((shareholder) => (
                <div className="round-participant" key={shareholder.shareholderId}>
                  <span>{shareholder.name}</span>
                  <Progress
                    percent={shareholder.percent}
                    showText={false}
                    size="small"
                  />
                  <strong style={{ textAlign: 'right' }}>
                    {shareholder.percent.toFixed(2)}%
                  </strong>
                </div>
              ))}
            </div>
          </Card>
        ))}

        {rounds.length === 0 && (
          <div className="panel" style={{ textAlign: 'center', padding: 48 }}>
            暂无融资轮次数据
          </div>
        )}
      </div>
    </>
  );
}
