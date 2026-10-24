// 变更日志：按时间倒序查看 AuditLog，并对比修改前后的 JSON 快照。
'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, Modal, Table, Tag } from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import { IconUser } from '@arco-design/web-react/icon';
import { MetricStrip } from '@/components/MetricStrip';
import { PageHeader } from '@/components/PageHeader';
import { useAppDb } from '@/components/DbProvider';
import { formatDateTime } from '@/lib/format';
import { listAuditLogs } from '@/lib/repo';
import type { AuditLogRow } from '@/lib/types';

const ACTION_META: Record<string, { label: string; color: string }> = {
  INIT_DATABASE: { label: '初始化数据库', color: 'blue' },
  UPDATE_CAP_TABLE: { label: '调整持股比例', color: 'orange' },
  IMPORT_DATABASE: { label: '导入数据库', color: 'purple' },
  RESET_DATABASE: { label: '清空业务数据', color: 'red' },
  CREATE_ACCOUNT: { label: '创建账号', color: 'green' },
  UPDATE_ACCOUNT: { label: '修改账号', color: 'arcoblue' },
  DELETE_ACCOUNT: { label: '删除账号', color: 'red' },
  RESET_PASSWORD: { label: '重置密码', color: 'gold' },
  TRIGGER_DEPLOY: { label: '触发站点重建', color: 'cyan' },
  SQL_EXEC: { label: '执行 SQL', color: 'magenta' },
};

function prettyJson(value: string | null): string {
  if (!value) return '—';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export default function AuditPage() {
  const { db, version } = useAppDb();
  const logs = useMemo(() => listAuditLogs(db), [db, version]);
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  const columns: TableColumnProps<AuditLogRow>[] = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      width: 180,
      render: (value) => formatDateTime(String(value)),
    },
    {
      title: '操作人',
      dataIndex: 'userId',
      width: 190,
      render: (value) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IconUser className="muted" />
          {String(value)}
        </span>
      ),
    },
    {
      title: '动作',
      dataIndex: 'action',
      width: 150,
      render: (value) => {
        const meta = ACTION_META[String(value)] ?? { label: String(value), color: 'gray' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '对象',
      dataIndex: 'entity',
      render: (value) => (
        <code style={{ fontSize: 12, color: 'var(--color-text-2)' }}>{String(value)}</code>
      ),
    },
    {
      title: '详情',
      key: 'detail',
      width: 90,
      render: (_, row) => (
        <Button type="text" size="small" onClick={() => setSelected(row)}>
          查看
        </Button>
      ),
    },
  ];

  const latest = logs[0];
  const operators = new Set(logs.map((log) => log.userId)).size;

  return (
    <div className="page-stack">
      <PageHeader
        title="历史变更日志"
        subtitle="记录持股比例调整等敏感操作。日志与数据库一起保存在当前浏览器，导出备份时会一并带走。"
      />

      <MetricStrip
        items={[
          { label: '日志条数', value: logs.length, hint: '最多展示最近 300 条' },
          {
            label: '最近变更',
            value: latest ? formatDateTime(latest.timestamp) : '—',
            hint: latest?.entity ?? '暂无操作记录',
            compact: true,
          },
          { label: '操作人', value: operators, hint: '包含 system 初始化记录' },
        ]}
      />

      <Alert
        type="warning"
        showIcon
        content="审计日志保存在本地 SQLite 中，客户端代码无法提供防篡改保证。若需要具备法律效力的审计记录，请在每次导出后离线归档原始 .sqlite 文件。"
      />

      <div className="panel table-panel">
        <Table
          columns={columns}
          data={logs}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 820 }}
          noDataElement={<div style={{ padding: 36 }}>暂无审计日志</div>}
        />
      </div>

      <Modal
        title="变更详情"
        visible={selected !== null}
        onCancel={() => setSelected(null)}
        footer={<Button onClick={() => setSelected(null)}>关闭</Button>}
        autoFocus={false}
        style={{ width: 880 }}
      >
        {selected && (
          <>
            <div className="meta-list" style={{ marginBottom: 16 }}>
              <div className="meta-row">
                <span>时间</span>
                <strong>{formatDateTime(selected.timestamp)}</strong>
              </div>
              <div className="meta-row">
                <span>操作人</span>
                <strong>{selected.userId}</strong>
              </div>
              <div className="meta-row">
                <span>动作 / 对象</span>
                <strong>
                  {ACTION_META[selected.action]?.label ?? selected.action} · {selected.entity}
                </strong>
              </div>
            </div>

            <div className="audit-columns">
              <div>
                <div className="audit-label">变更前</div>
                <pre className="audit-json">{prettyJson(selected.beforeJson)}</pre>
              </div>
              <div>
                <div className="audit-label">变更后</div>
                <pre className="audit-json">{prettyJson(selected.afterJson)}</pre>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
