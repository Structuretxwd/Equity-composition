// 股东名册视图：轮次筛选、只读/可编辑状态由服务端权限决定
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Avatar,
  Button,
  Form,
  Input,
  InputNumber,
  Message,
  Modal,
  Progress,
  Select,
  Space,
  Table,
  Tag,
} from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import type { CapTableRow } from '@/lib/equity';

type RoundOption = { id: string; name: string };

type CapTableViewProps = {
  rows: CapTableRow[];
  rounds: RoundOption[];
  activeRoundId: string | null;
  activeRoundName: string;
  editable: boolean;
  scoped: boolean;
};

const TYPE_META: Record<string, { label: string; color: string }> = {
  FOUNDER: { label: '创始人', color: 'blue' },
  INVESTOR: { label: '投资人', color: 'purple' },
  NEW_SHAREHOLDER: { label: '新股东', color: 'green' },
};

export function CapTableView({
  rows,
  rounds,
  activeRoundId,
  activeRoundName,
  editable,
  scoped,
}: CapTableViewProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<CapTableRow | null>(null);
  const [draftPercent, setDraftPercent] = useState(0);
  const [saving, setSaving] = useState(false);

  const columns: TableColumnProps<CapTableRow>[] = [
    {
      title: '股东',
      dataIndex: 'shareholderName',
      width: 190,
      render: (value, row) => (
        <Space>
          <Avatar size={26} style={{ backgroundColor: 'rgb(var(--primary-6))' }}>
            {String(value).slice(0, 1)}
          </Avatar>
          <span style={{ fontWeight: 500 }}>{String(value)}</span>
          {row.shareholderType === 'NEW_SHAREHOLDER' && (
            <Tag color="green" size="small">
              新
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'shareholderType',
      width: 100,
      render: (value) => {
        const meta = TYPE_META[String(value)] ?? { label: String(value), color: 'gray' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '持股比例',
      dataIndex: 'percent',
      width: 220,
      sorter: (a, b) => a.percent - b.percent,
      render: (value) => (
        <div style={{ minWidth: 170 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {Number(value).toFixed(2)}%
          </div>
          <Progress percent={Math.min(100, Number(value))} showText={false} size="small" />
        </div>
      ),
    },
    {
      title: '本轮稀释',
      dataIndex: 'dilutionApplied',
      width: 130,
      render: (value) =>
        value ? (
          <Tag color="orange">已稀释</Tag>
        ) : (
          <Tag color="green">未稀释 / 受保护</Tag>
        ),
    },
    {
      title: '初始股数',
      dataIndex: 'initialShares',
      width: 120,
      align: 'right',
      render: (value) => Number(value).toLocaleString('zh-CN'),
    },
  ];

  if (editable) {
    columns.push({
      title: '操作',
      key: 'action',
      width: 90,
      fixed: 'right',
      render: (_, row) => (
        <Button
          type="text"
          size="small"
          onClick={() => {
            setEditing(row);
            setDraftPercent(row.percent);
          }}
        >
          编辑
        </Button>
      ),
    });
  }

  async function savePercent() {
    if (!editing) return;
    if (!Number.isFinite(draftPercent) || draftPercent < 0 || draftPercent > 100) {
      Message.error('请输入 0 到 100 之间的持股比例');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/cap-table', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: editing.roundId,
          shareholderId: editing.shareholderId,
          postRoundPercent: draftPercent,
        }),
      });
      const payload = (await response.json()) as { error?: string; warning?: string };
      if (!response.ok) throw new Error(payload.error ?? '保存失败');

      Message.success(payload.warning ?? '持股比例已更新');
      setEditing(null);
      router.refresh();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">股东名册</h1>
          <p className="page-subtitle">
            当前轮次：{activeRoundName || '暂无融资轮次'}
            {scoped ? ' · 仅显示与本人相关的持股数据' : ''}
          </p>
        </div>
        <Space wrap>
          <Select
            placeholder="选择融资轮次"
            style={{ width: 220 }}
            value={activeRoundId ?? undefined}
            onChange={(value) => router.push(`/cap-table?roundId=${value}`)}
            options={rounds.map((round) => ({ label: round.name, value: round.id }))}
          />
          {editable ? (
            <Tag color="blue">管理员可编辑</Tag>
          ) : (
            <Tag color="gray">只读视图</Tag>
          )}
        </Space>
      </div>

      <div className="panel">
        <Table
          columns={columns}
          data={rows}
          rowKey="shareholderId"
          pagination={false}
          stripe
          scroll={{ x: 920 }}
          noDataElement={<div style={{ padding: 32 }}>当前轮次暂无持股数据</div>}
        />
      </div>

      <Modal
        title="编辑持股比例"
        visible={editing !== null}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        onOk={() => void savePercent()}
        onCancel={() => setEditing(null)}
        autoFocus={false}
      >
        <Form layout="vertical">
          <Form.Item label="股东">
            <Input value={editing?.shareholderName ?? ''} disabled />
          </Form.Item>
          <Form.Item label={`持股比例（${editing?.roundName ?? ''}）`}>
            <InputNumber
              value={draftPercent}
              min={0}
              max={100}
              precision={4}
              onChange={(value) => setDraftPercent(Number(value ?? 0))}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
        <p className="muted" style={{ marginBottom: 0, fontSize: 12 }}>
          修改会写入审计日志；历史轮次的手工调整不会自动重算后续轮次。
        </p>
      </Modal>
    </>
  );
}
