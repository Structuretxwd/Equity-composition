// 变更日志视图：时间倒序、操作人与变动前后 JSON 对照
'use client';

import { Table, Tag } from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';

export type AuditLogView = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  shareholderId: string | null;
  beforeJson: unknown;
  afterJson: unknown;
  ip: string | null;
  timestamp: string;
  user: { name: string; email: string };
};

const ACTION_META: Record<string, { label: string; color: string }> = {
  CAP_TABLE_EDIT: { label: '持股比例调整', color: 'orange' },
  ROUND_APPLIED: { label: '融资轮次生效', color: 'blue' },
  SHARES_ADJUSTED: { label: '轮次稀释', color: 'purple' },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function summarize(before: unknown, after: unknown): string {
  if (!isRecord(before) || !isRecord(after)) return '—';

  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const changed = keys.filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );

  if (changed.length === 0) return '无字段变化';
  return changed
    .map((key) => `${key}: ${formatValue(before[key])} → ${formatValue(after[key])}`)
    .join('；');
}

export function AuditView({
  logs,
  scoped,
}: {
  logs: AuditLogView[];
  scoped: boolean;
}) {
  const columns: TableColumnProps<AuditLogView>[] = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      width: 170,
      render: (value) =>
        new Intl.DateTimeFormat('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Shanghai',
        }).format(new Date(String(value))),
    },
    {
      title: '操作人',
      dataIndex: 'user',
      width: 170,
      render: (_, row) => (
        <div style={{ lineHeight: '18px' }}>
          <div>{row.user.name}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {row.user.email}
          </div>
        </div>
      ),
    },
    {
      title: '动作',
      dataIndex: 'action',
      width: 130,
      render: (value) => {
        const meta = ACTION_META[String(value)] ?? {
          label: String(value),
          color: 'gray',
        };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '对象',
      dataIndex: 'entity',
      width: 200,
      render: (value, row) => (
        <div style={{ lineHeight: '18px' }}>
          <div>{String(value)}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {row.entityId ?? '—'}
          </div>
        </div>
      ),
    },
    {
      title: '变动摘要',
      dataIndex: 'afterJson',
      render: (_, row) => (
        <span style={{ fontSize: 12 }}>{summarize(row.beforeJson, row.afterJson)}</span>
      ),
    },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">变更日志</h1>
          <p className="page-subtitle">
            按时间倒序记录每一次股权变动
            {scoped ? ' · 仅显示与本人相关的记录' : ''}
          </p>
        </div>
      </div>

      <div className="panel">
        <Table
          columns={columns}
          data={logs}
          rowKey="id"
          pagination={{ pageSize: 10, showTotal: true }}
          scroll={{ x: 1000 }}
          expandedRowRender={(row) => (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 12,
              }}
            >
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  变更前
                </div>
                <pre className="audit-json">
                  {JSON.stringify(row.beforeJson ?? null, null, 2)}
                </pre>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  变更后
                </div>
                <pre className="audit-json">
                  {JSON.stringify(row.afterJson ?? null, null, 2)}
                </pre>
              </div>
            </div>
          )}
          noDataElement={<div style={{ padding: 32 }}>暂无变更记录</div>}
        />
      </div>
    </>
  );
}
