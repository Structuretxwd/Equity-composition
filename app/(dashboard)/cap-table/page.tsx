// 股东名册：按轮次查询持股；ADMIN 可批量调整比例，INVESTOR 只看自己。
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
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
import { IconEdit } from '@arco-design/web-react/icon';
import { useAppDb } from '@/components/DbProvider';
import { MetricStrip } from '@/components/MetricStrip';
import { PageHeader } from '@/components/PageHeader';
import { useSession } from '@/components/SessionContext';
import { formatPercent, formatRoundDate, formatShares, round6 } from '@/lib/format';
import { getCapTable, listRounds, updateCapTable } from '@/lib/repo';
import { canEditCapTable, getDataScope, ROLE_LABEL } from '@/lib/rbac';
import type { CapTableRow, ShareholderType } from '@/lib/types';

const TYPE_META: Record<ShareholderType, { label: string; color: string }> = {
  FOUNDER: { label: '创始人', color: 'blue' },
  INVESTOR: { label: '投资人', color: 'purple' },
  NEW_SHAREHOLDER: { label: '新股东', color: 'green' },
};

type DraftRow = {
  shareholderId: string;
  name: string;
  type: ShareholderType;
  percent: number;
};

export default function CapTablePage() {
  const { db, version, refresh } = useAppDb();
  const session = useSession();
  const editable = canEditCapTable(session.role);
  const scope = getDataScope(session);

  const rounds = useMemo(() => listRounds(db), [db, version]);
  const [roundId, setRoundId] = useState('');
  const [editorVisible, setEditorVisible] = useState(false);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [saving, setSaving] = useState(false);

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

  const totalPercent = round6(rows.reduce((sum, row) => sum + row.percent, 0));
  const topRow = rows[0];

  function openEditor() {
    if (!activeRound || !editable) return;
    const fullRows = getCapTable(db, activeRound.id);
    setDrafts(
      fullRows.map((row) => ({
        shareholderId: row.shareholderId,
        name: row.shareholderName,
        type: row.shareholderType,
        percent: row.percent,
      })),
    );
    setEditorVisible(true);
  }

  const draftTotal = round6(drafts.reduce((sum, row) => sum + row.percent, 0));
  const draftInvalid = Math.abs(draftTotal - 100) > 0.001;

  async function saveDrafts() {
    if (!activeRound) return;
    setSaving(true);
    try {
      const changed = await updateCapTable(db, {
        roundId: activeRound.id,
        updates: drafts.map((row) => ({
          shareholderId: row.shareholderId,
          percent: row.percent,
        })),
        // 写入数据层前再次校验角色，不能只依赖 UI 的按钮状态
        actor: { role: session.role, name: session.name },
      });

      if (changed) {
        Message.success('持股比例已保存，并写入审计日志');
        refresh();
        setEditorVisible(false);
      } else {
        Message.info('持股比例没有变化');
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  const columns: TableColumnProps<CapTableRow>[] = [
    {
      title: '股东',
      dataIndex: 'shareholderName',
      width: 210,
      render: (value, row) => (
        <Space size={8}>
          <Avatar size={28} style={{ backgroundColor: 'rgb(var(--primary-6))' }}>
            {String(value).slice(0, 1)}
          </Avatar>
          <span className="editor-name">
            <span style={{ fontWeight: 600 }}>{String(value)}</span>
            <small>初始股数 {formatShares(row.initialShares)}</small>
          </span>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'shareholderType',
      width: 100,
      render: (value) => {
        const meta = TYPE_META[value as ShareholderType];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '当前持股',
      dataIndex: 'percent',
      width: 260,
      sorter: (a, b) => a.percent - b.percent,
      render: (value) => (
        <div className="table-percent">
          <Progress
            percent={Math.min(100, Number(value))}
            showText={false}
            size="small"
            color="rgb(var(--primary-6))"
          />
          <span className="percent-text">{formatPercent(Number(value))}</span>
        </div>
      ),
    },
    {
      title: '本轮稀释',
      dataIndex: 'dilutionApplied',
      width: 130,
      render: (value) =>
        value ? <Tag color="orange">已稀释</Tag> : <Tag color="green">未稀释 / 受保护</Tag>,
    },
  ];

  if (editable) {
    columns.push({
      title: '操作',
      key: 'action',
      width: 90,
      fixed: 'right',
      render: () => (
        <Button type="text" size="small" icon={<IconEdit />} onClick={openEditor}>
          调整
        </Button>
      ),
    });
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="股东名册"
        subtitle={
          activeRound
            ? `当前轮次：${activeRound.name} · ${formatRoundDate(activeRound.date)}${
                scope ? ' · 已启用投资人数据隔离，仅展示本人持股' : ''
              }`
            : '当前还没有融资轮次数据'
        }
        extra={
          <Space wrap>
            <Select
              style={{ width: 200 }}
              value={activeRound?.id}
              onChange={(value) => setRoundId(String(value))}
              options={rounds.map((round) => ({ label: round.name, value: round.id }))}
              placeholder="选择融资轮次"
            />
            {editable ? (
              <Button type="primary" icon={<IconEdit />} onClick={openEditor}>
                调整比例
              </Button>
            ) : (
              <Tag color="gray">只读视图</Tag>
            )}
          </Space>
        }
      />

      <MetricStrip
        items={[
          {
            label: '本轮登记股东',
            value: activeRound?.shareholders.length ?? 0,
            hint: scope ? '当前仅展示本人记录' : '全部持股主体',
          },
          {
            label: '最大持股',
            value: topRow ? formatPercent(topRow.percent) : '—',
            hint: topRow?.shareholderName ?? '暂无数据',
          },
          {
            label: '可见比例合计',
            value: formatPercent(totalPercent),
            hint: '正常情况下应合计 100%',
          },
          {
            label: '本轮稀释',
            value: activeRound ? formatPercent(activeRound.totalDilutionPercent) : '—',
            hint: activeRound?.investorProtection ? '投资人受保护' : '全体按比例稀释',
          },
        ]}
      />

      <Alert
        type={scope ? 'info' : editable ? 'success' : 'warning'}
        showIcon
        content={
          scope
            ? `当前以${ROLE_LABEL[session.role]}身份登录，数据层已按股东 ID 收敛，只能看到自己的持股记录。`
            : editable
              ? '管理员可直接调整本轮持股比例；保存时会写入 ShareHolding、CapTableSnapshot 与 AuditLog。'
              : '当前角色为只读访问。需要修改持股比例时，请使用管理员账号登录。'
        }
      />

      <div className="panel table-panel">
        <Table
          columns={columns}
          data={rows}
          rowKey="shareholderId"
          pagination={false}
          scroll={{ x: 860 }}
          noDataElement={<div style={{ padding: 36 }}>当前轮次暂无可见持股数据</div>}
        />
      </div>

      <Modal
        title={`调整持股比例 · ${activeRound?.name ?? ''}`}
        visible={editorVisible}
        onCancel={() => setEditorVisible(false)}
        autoFocus={false}
        style={{ width: 560 }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setEditorVisible(false)}>取消</Button>
            <Button
              type="primary"
              loading={saving}
              disabled={draftInvalid}
              onClick={() => void saveDrafts()}
            >
              保存并记录日志
            </Button>
          </div>
        }
      >
        <Alert
          type="info"
          showIcon
          content="请确保所有股东比例合计为 100%。保存后本轮快照与持股记录会同步更新，并生成一条可追溯的审计日志。"
          style={{ marginBottom: 16 }}
        />

        <div className="editor-grid">
          {drafts.map((row) => (
            <div key={row.shareholderId} style={{ display: 'contents' }}>
              <div className="editor-name">
                <span style={{ fontWeight: 500 }}>{row.name}</span>
                <small>{TYPE_META[row.type].label}</small>
              </div>
              <InputNumber
                value={row.percent}
                min={0}
                max={100}
                precision={2}
                step={0.1}
                suffix="%"
                style={{ width: '100%' }}
                onChange={(value) => {
                  const next = Number(value ?? 0);
                  setDrafts((current) =>
                    current.map((item) =>
                      item.shareholderId === row.shareholderId
                        ? { ...item, percent: Number.isFinite(next) ? next : 0 }
                        : item,
                    ),
                  );
                }}
              />
            </div>
          ))}
        </div>

        <div className="editor-sum">
          <span>
            合计比例
            <span className="muted" style={{ marginLeft: 8 }}>
              （必须为 100.00%）
            </span>
          </span>
          <strong style={{ color: draftInvalid ? '#f53f3f' : '#00b42a' }}>
            {draftTotal.toFixed(2)}%
          </strong>
        </div>
      </Modal>
    </div>
  );
}
