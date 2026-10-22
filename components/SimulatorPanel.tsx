// 稀释模拟器：输入融资比例后防抖调用后端计算，权限与计算逻辑均在服务端校验
'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Card,
  InputNumber,
  Space,
  Switch,
  Table,
  Tag,
} from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import type { SimulationResponse, SimulationResult } from '@/lib/equity';

const TYPE_LABELS: Record<string, string> = {
  FOUNDER: '创始人',
  INVESTOR: '投资人',
  NEW_SHAREHOLDER: '新股东',
};

export function SimulatorPanel() {
  const [newInvestorPercent, setNewInvestorPercent] = useState(10);
  const [investorProtection, setInvestorProtection] = useState(true);
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/simulator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newInvestorPercent, investorProtection }),
          signal: controller.signal,
        });
        const payload = (await response.json()) as SimulationResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? '模拟计算失败');
        }
        setResult(payload);
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') return;
        setError(fetchError instanceof Error ? fetchError.message : '模拟计算失败');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [newInvestorPercent, investorProtection]);

  const columns: TableColumnProps<SimulationResult>[] = [
    {
      title: '股东',
      dataIndex: 'name',
      render: (value, row) => (
        <Space>
          <span>{String(value)}</span>
          {row.protectedByRound && <Tag color="green">受保护</Tag>}
          {row.shareholderId === 'new-investor' && <Tag color="blue">新投资人</Tag>}
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 110,
      render: (value) => <Tag>{TYPE_LABELS[String(value)] ?? String(value)}</Tag>,
    },
    {
      title: '融资前',
      dataIndex: 'before',
      width: 110,
      align: 'right',
      render: (value) => `${Number(value).toFixed(2)}%`,
    },
    {
      title: '融资后',
      dataIndex: 'after',
      width: 110,
      align: 'right',
      render: (value) => <strong>{Number(value).toFixed(2)}%</strong>,
    },
    {
      title: '变化',
      dataIndex: 'delta',
      width: 110,
      align: 'right',
      render: (value) => {
        const delta = Number(value);
        return (
          <span
            style={{
              color:
                delta < 0
                  ? 'var(--color-danger-6)'
                  : delta > 0
                    ? 'var(--color-success-6)'
                    : 'var(--color-text-3)',
            }}
          >
            {delta > 0 ? '+' : ''}
            {delta.toFixed(2)}%
          </span>
        );
      },
    },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">股权稀释模拟器</h1>
          <p className="page-subtitle">仅 ADMIN 可用 · 实时预览，不会写入数据库</p>
        </div>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div className="simulator-toolbar">
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              新一轮融资比例
            </div>
            <Space>
              <InputNumber
                value={newInvestorPercent}
                min={0.01}
                max={99.99}
                step={1}
                precision={2}
                onChange={(value) => setNewInvestorPercent(Number(value ?? 0))}
                style={{ width: 160 }}
              />
              <span>%</span>
            </Space>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              投资人保护（现有 INVESTOR 不被稀释）
            </div>
            <Switch
              checked={investorProtection}
              onChange={(checked) => setInvestorProtection(checked)}
              checkedText="开启"
              uncheckedText="关闭"
            />
          </div>
        </div>
      </Card>

      <Alert
        type="info"
        style={{ marginBottom: 16 }}
        content="计算规则：融资后总股本为 100%。开启投资人保护时，现有 INVESTOR 股东的持股比例保持不变，缺口由未受保护的股东按原比例承担。"
      />

      {error && (
        <Alert type="error" style={{ marginBottom: 16 }} content={error} />
      )}

      <div className="panel">
        <Table
          columns={columns}
          data={result?.results ?? []}
          rowKey="shareholderId"
          pagination={false}
          loading={loading}
          stripe
          noDataElement={<div style={{ padding: 32 }}>暂无模拟结果</div>}
        />
      </div>
    </>
  );
}
