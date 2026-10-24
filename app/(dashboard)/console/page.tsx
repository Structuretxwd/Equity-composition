// 管理员控制台：账号权限、GitHub Actions 重建与本地数据库维护。
// 这里集中所有“管理员完全控制”的操作，其他页面不重复暴露。
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Input,
  Message,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import {
  IconDelete,
  IconLock,
  IconRefresh,
  IconUserAdd,
} from '@arco-design/web-react/icon';
import { useAppDb } from '@/components/DbProvider';
import { MetricStrip } from '@/components/MetricStrip';
import { PageHeader } from '@/components/PageHeader';
import { useSession } from '@/components/SessionContext';
import {
  countAdmins,
  createAccount,
  deleteAccount,
  listAccounts,
  resetAccountPassword,
  updateAccount,
} from '@/lib/accounts';
import {
  actionsUrl,
  clearDeployToken,
  deriveDeployTarget,
  readDeployConfig,
  readDeployToken,
  saveDeployConfig,
  saveDeployToken,
  triggerDeploy,
  type DeployConfig,
} from '@/lib/deploy';
import { formatBytes, formatDateTime } from '@/lib/format';
import { canAccessConsole, ROLE_LABEL, ROLES } from '@/lib/rbac';
import { getDatabaseStats, listShareholders } from '@/lib/repo';
import type { AccountRow, Role } from '@/lib/types';

type SqlResult = {
  readOnly: boolean;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  elapsed: number;
};

const DEFAULT_SQL = `SELECT name, type
FROM sqlite_master
WHERE type IN ('table', 'view')
ORDER BY type, name;`;

function stripLeadingComments(input: string): string {
  return input.replace(/^(?:\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/))*/g, '').trim();
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value instanceof Uint8Array) return `BLOB (${value.length} B)`;
  return JSON.stringify(value);
}

export default function ConsolePage() {
  const { db, version, refresh } = useAppDb();
  const session = useSession();

  const accounts = useMemo(() => listAccounts(db), [db, version]);
  const shareholders = useMemo(() => listShareholders(db), [db, version]);
  const stats = useMemo(() => getDatabaseStats(db), [db, version]);
  const admins = useMemo(() => countAdmins(db), [db, version]);
  const size = useMemo(() => db.export().length, [db, version]);
  const tables = useMemo(() => db.getTables().sort(), [db, version]);

  const [createVisible, setCreateVisible] = useState(false);
  const [createForm, setCreateForm] = useState<{
    username: string;
    displayName: string;
    password: string;
    role: Role;
    shareholderId: string | null;
  }>({ username: '', displayName: '', password: '', role: 'PARTNER', shareholderId: null });
  const [creating, setCreating] = useState(false);

  const [resetTarget, setResetTarget] = useState<AccountRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AccountRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [config, setConfig] = useState<DeployConfig>({
    owner: '',
    repo: '',
    workflow: 'deploy.yml',
    ref: 'main',
  });
  const [token, setToken] = useState('');
  const [deploying, setDeploying] = useState(false);

  const [sql, setSql] = useState(DEFAULT_SQL);
  const [sqlAcknowledged, setSqlAcknowledged] = useState(false);
  const [running, setRunning] = useState(false);
  const [sqlResult, setSqlResult] = useState<SqlResult | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);

  useEffect(() => {
    const saved = readDeployConfig();
    const derived = deriveDeployTarget();
    setConfig({
      owner: saved.owner || derived?.owner || '',
      repo: saved.repo || derived?.repo || '',
      workflow: saved.workflow,
      ref: saved.ref,
    });
    setToken(readDeployToken());
  }, []);

  async function record(action: string, entity: string, detail: Record<string, unknown>) {
    try {
      db.run(
        `INSERT INTO audit_logs
           (id, userId, action, entity, beforeJson, afterJson, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          `${session.name}（${session.role}）`,
          action,
          entity,
          null,
          JSON.stringify(detail),
          new Date().toISOString(),
        ],
      );
      await db.save();
      refresh();
    } catch (error) {
      console.error('[console] 写审计日志失败', error);
    }
  }

  async function patchAccount(account: AccountRow, patch: { role?: Role; shareholderId?: string | null }) {
    try {
      await updateAccount(db, account.id, patch);
      await record('UPDATE_ACCOUNT', `Account:${account.username}`, {
        target: account.username,
        ...patch,
      });
      Message.success('账号权限已更新，重新登录后生效');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '更新失败');
    }
  }

  async function submitCreate() {
    if (!createForm.username.trim() || !createForm.password) {
      Message.error('请填写账号与密码');
      return;
    }
    setCreating(true);
    try {
      const created = await createAccount(db, { ...createForm });
      await record('CREATE_ACCOUNT', `Account:${created.username}`, {
        role: created.role,
        shareholderId: created.shareholderId,
      });
      Message.success('账号已创建');
      setCreateVisible(false);
      setCreateForm({
        username: '',
        displayName: '',
        password: '',
        role: 'PARTNER',
        shareholderId: null,
      });
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '创建失败');
    } finally {
      setCreating(false);
    }
  }

  async function submitReset() {
    if (!resetTarget) return;
    if (newPassword !== confirmPassword) {
      Message.error('两次输入的密码不一致');
      return;
    }
    setResetting(true);
    try {
      await resetAccountPassword(db, resetTarget.id, newPassword);
      await record('RESET_PASSWORD', `Account:${resetTarget.username}`, {
        target: resetTarget.username,
      });
      Message.success('密码已重置');
      setResetTarget(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '重置失败');
    } finally {
      setResetting(false);
    }
  }

  async function submitDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.id === session.accountId) {
      Message.error('不能删除当前登录账号');
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(db, deleteTarget.id);
      await record('DELETE_ACCOUNT', `Account:${deleteTarget.username}`, {
        target: deleteTarget.username,
      });
      Message.success('账号已删除');
      setDeleteTarget(null);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeploy() {
    setDeploying(true);
    saveDeployConfig(config);
    saveDeployToken(token);
    try {
      await triggerDeploy(config, token);
      await record('TRIGGER_DEPLOY', `GitHubActions:${config.repo}`, {
        repo: `${config.owner}/${config.repo}`,
        workflow: config.workflow,
        ref: config.ref,
      });
      Message.success('已触发 GitHub Actions，通常 1–2 分钟后完成发布');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '触发失败');
    } finally {
      setDeploying(false);
    }
  }

  function handleClearToken() {
    clearDeployToken();
    setToken('');
    Message.success('已清除当前标签页中的令牌');
  }

  async function runSql() {
    const statement = sql.trim();
    if (!statement) {
      setSqlError('请输入 SQL');
      return;
    }
    setRunning(true);
    setSqlError(null);
    setSqlResult(null);
    const started = performance.now();
    try {
      const readOnly = /^(select|with|pragma|explain)\b/i.test(stripLeadingComments(statement));
      if (readOnly) {
        const rows = db.all<Record<string, unknown>>(statement);
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        setSqlResult({
          readOnly: true,
          columns,
          rows,
          elapsed: Math.round(performance.now() - started),
        });
      } else {
        db.exec(statement);
        await db.save();
        await record('SQL_EXEC', 'Database:sqlite', {
          preview: statement.slice(0, 300),
        });
        setSqlResult({
          readOnly: false,
          columns: [],
          rows: [],
          elapsed: Math.round(performance.now() - started),
        });
        Message.success('语句已执行，数据库已保存');
      }
      refresh();
    } catch (error) {
      setSqlError(error instanceof Error ? error.message : '执行失败');
    } finally {
      setRunning(false);
      setSqlAcknowledged(false);
    }
  }

  if (!canAccessConsole(session.role)) {
    return (
      <Alert
        type="error"
        showIcon
        content="控制台仅对管理员开放。请使用管理员账号登录后再访问。"
      />
    );
  }

  const columns: TableColumnProps<AccountRow>[] = [
    {
      title: '账号',
      dataIndex: 'username',
      render: (_, row) => (
        <span className="account-cell">
          <strong>{row.displayName}</strong>
          <small>
            {row.username}
            {row.id === session.accountId ? ' · 当前登录' : ''}
          </small>
        </span>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      width: 150,
      render: (_, row) => (
        <Select
          size="small"
          value={row.role}
          style={{ width: 126 }}
          disabled={row.id === session.accountId}
          onChange={(next) => void patchAccount(row, { role: String(next) as Role })}
          options={ROLES.map((role) => ({ label: ROLE_LABEL[role], value: role }))}
        />
      ),
    },
    {
      title: '关联股东',
      dataIndex: 'shareholderId',
      width: 186,
      render: (_, row) => (
        <Select
          size="small"
          allowClear
          showSearch
          placeholder="未关联"
          value={row.shareholderId ?? undefined}
          style={{ width: 162 }}
          onChange={(next) =>
            void patchAccount(row, { shareholderId: next ? String(next) : null })
          }
          options={shareholders.map((shareholder) => ({
            label: shareholder.name,
            value: shareholder.id,
          }))}
        />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 172,
      render: (value) => <span className="muted">{formatDateTime(String(value))}</span>,
    },
    {
      title: '操作',
      width: 116,
      render: (_, row) => (
        <Space size={2}>
          <Tooltip content="重置密码">
            <Button
              type="text"
              size="small"
              icon={<IconLock />}
              onClick={() => {
                setResetTarget(row);
                setNewPassword('');
                setConfirmPassword('');
              }}
            />
          </Tooltip>
          <Tooltip content={row.id === session.accountId ? '不能删除当前登录账号' : '删除账号'}>
            <Button
              type="text"
              size="small"
              status="danger"
              icon={<IconDelete />}
              disabled={row.id === session.accountId}
              onClick={() => setDeleteTarget(row)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="控制台"
        subtitle="管理员专属区域：管理账号与权限、触发线上重建、直接维护本地数据库。"
        extra={<Tag color="red">完全控制</Tag>}
      />

      <Alert
        type="info"
        showIcon
        content="所有改动都会写入审计日志。账号与角色修改需要对方重新登录后才会生效。"
      />

      <MetricStrip
        items={[
          {
            label: '本地账号',
            value: accounts.length,
            hint: 'accounts 表记录数',
          },
          {
            label: '管理员',
            value: admins,
            hint: admins <= 1 ? '建议至少保留两个管理员' : '可互相兜底',
          },
          {
            label: '关联股东',
            value: accounts.filter((account) => account.shareholderId).length,
            hint: `股东名册共 ${shareholders.length} 位`,
          },
          {
            label: '审计日志',
            value: stats.auditLogs,
            hint: '包含控制台操作记录',
          },
        ]}
      />

      <section className="panel table-panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">账号管理</h2>
            <p className="panel-subtitle">
              新注册账号默认为只读合伙人，可在这里调整为管理员、投资人，或绑定到具体股东。
            </p>
          </div>
          <Button type="primary" icon={<IconUserAdd />} onClick={() => setCreateVisible(true)}>
            新建账号
          </Button>
        </div>
        <Table
          columns={columns}
          data={accounts}
          rowKey="id"
          pagination={false}
          scroll={{ x: 880 }}
          noDataElement={<div style={{ padding: 36 }}>还没有本地账号</div>}
        />
      </section>

      <div className="console-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">发布与重建</h2>
              <p className="panel-subtitle">
                通过 GitHub API 触发仓库中的 deploy.yml，重新构建并发布当前版本。
              </p>
            </div>
            <Tag color="purple">GitHub Actions</Tag>
          </div>

          <div className="deploy-grid">
            <div className="deploy-field">
              <label htmlFor="deploy-owner">仓库所有者</label>
              <Input
                id="deploy-owner"
                value={config.owner}
                placeholder="例如 trae-user"
                onChange={(value) => setConfig((current) => ({ ...current, owner: value }))}
              />
            </div>
            <div className="deploy-field">
              <label htmlFor="deploy-repo">仓库名称</label>
              <Input
                id="deploy-repo"
                value={config.repo}
                placeholder="例如 equity-composition"
                onChange={(value) => setConfig((current) => ({ ...current, repo: value }))}
              />
            </div>
            <div className="deploy-field">
              <label htmlFor="deploy-workflow">Workflow 文件</label>
              <Input
                id="deploy-workflow"
                value={config.workflow}
                placeholder="deploy.yml"
                onChange={(value) => setConfig((current) => ({ ...current, workflow: value }))}
              />
            </div>
            <div className="deploy-field">
              <label htmlFor="deploy-ref">分支 / 标签</label>
              <Input
                id="deploy-ref"
                value={config.ref}
                placeholder="main"
                onChange={(value) => setConfig((current) => ({ ...current, ref: value }))}
              />
            </div>
            <div className="deploy-field deploy-field-wide">
              <label htmlFor="deploy-token">GitHub 访问令牌</label>
              <Input.Password
                id="deploy-token"
                value={token}
                placeholder="仅保存在当前标签页，关闭后自动清除"
                onChange={setToken}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="console-actions">
            <Button
              type="primary"
              icon={<IconRefresh />}
              loading={deploying}
              disabled={!token.trim()}
              onClick={() => void handleDeploy()}
            >
              立即重建
            </Button>
            <Button
              onClick={() => {
                saveDeployConfig(config);
                Message.success('仓库配置已保存在本机');
              }}
            >
              保存配置
            </Button>
            <Button status="danger" onClick={handleClearToken} disabled={!token}>
              清除令牌
            </Button>
            {config.owner && config.repo && (
              <a
                className="console-link"
                href={actionsUrl(config)}
                target="_blank"
                rel="noreferrer"
              >
                查看运行记录
              </a>
            )}
          </div>

          <p className="console-hint">
            令牌需要 Actions 读写权限：fine-grained PAT 勾选 Repository permissions → Actions →
            Read and write；classic token 勾选 <code>workflow</code>。令牌只存在当前标签页的
            sessionStorage，关闭页面即失效。也可在 GitHub 仓库页面手动运行同一 workflow。
          </p>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">系统信息</h2>
              <p className="panel-subtitle">当前浏览器内的运行状态，不涉及任何服务器。</p>
            </div>
          </div>

          <div className="meta-list">
            <div className="meta-row">
              <span>数据库体积</span>
              <strong>{formatBytes(size)}</strong>
            </div>
            <div className="meta-row">
              <span>股东 / 轮次</span>
              <strong>
                {stats.shareholders} / {stats.rounds}
              </strong>
            </div>
            <div className="meta-row">
              <span>持股记录</span>
              <strong>{stats.holdings}</strong>
            </div>
            <div className="meta-row">
              <span>快照记录</span>
              <strong>{stats.snapshots}</strong>
            </div>
            <div className="meta-row">
              <span>审计日志</span>
              <strong>{stats.auditLogs}</strong>
            </div>
            <div className="meta-row meta-row-wrap">
              <span>数据表</span>
              <strong>{tables.join(' · ')}</strong>
            </div>
          </div>

          <div className="console-actions">
            <Button
              icon={<IconRefresh />}
              onClick={() => {
                refresh();
                Message.success('已重新读取本地数据库');
              }}
            >
              刷新数据
            </Button>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">SQL 控制台</h2>
            <p className="panel-subtitle">
              SELECT / WITH / PRAGMA 会返回结果集，其余语句会直接执行并保存。仅管理员可见。
            </p>
          </div>
          <Tag color="orange">高风险操作</Tag>
        </div>

        <Input.TextArea
          className="sql-editor"
          value={sql}
          onChange={setSql}
          autoSize={{ minRows: 5, maxRows: 14 }}
          spellCheck={false}
        />

        <Checkbox
          className="deploy-confirm"
          checked={sqlAcknowledged}
          onChange={setSqlAcknowledged}
        >
          我已了解：非查询语句会直接修改本地数据库，且无法撤销
        </Checkbox>

        <div className="console-actions">
          <Button
            type="primary"
            icon={<IconRefresh />}
            loading={running}
            disabled={!sqlAcknowledged}
            onClick={() => void runSql()}
          >
            执行 SQL
          </Button>
          <Button onClick={() => setSql(DEFAULT_SQL)}>恢复示例</Button>
        </div>

        {sqlError && (
          <Alert
            type="error"
            showIcon
            content={sqlError}
            style={{ marginTop: 14 }}
          />
        )}

        {sqlResult && (
          <div className="sql-output">
            <div className="sql-output-head">
              <span>
                {sqlResult.readOnly
                  ? `返回 ${sqlResult.rows.length} 行`
                  : '语句已执行并保存到 IndexedDB'}
              </span>
              <span className="muted">{sqlResult.elapsed} ms</span>
            </div>
            {sqlResult.readOnly && sqlResult.columns.length > 0 && (
              <div className="sql-output-scroll">
                <table className="sql-table">
                  <thead>
                    <tr>
                      {sqlResult.columns.map((column) => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sqlResult.rows.slice(0, 100).map((row, index) => (
                      <tr key={index}>
                        {sqlResult.columns.map((column) => (
                          <td key={column}>{formatCell(row[column])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {sqlResult.readOnly && sqlResult.rows.length > 100 && (
              <p className="console-hint">仅展示前 100 行，共 {sqlResult.rows.length} 行。</p>
            )}
          </div>
        )}
      </section>

      <Modal
        title="新建账号"
        visible={createVisible}
        onCancel={() => setCreateVisible(false)}
        onOk={() => void submitCreate()}
        confirmLoading={creating}
        okText="创建账号"
        cancelText="取消"
        autoFocus={false}
      >
        <div className="modal-form">
          <label htmlFor="new-username">账号</label>
          <Input
            id="new-username"
            value={createForm.username}
            placeholder="2–24 位中文、字母、数字或下划线"
            onChange={(value) => setCreateForm((current) => ({ ...current, username: value }))}
            maxLength={24}
          />
          <label htmlFor="new-display-name">显示名称</label>
          <Input
            id="new-display-name"
            value={createForm.displayName}
            placeholder="留空则使用账号名"
            onChange={(value) => setCreateForm((current) => ({ ...current, displayName: value }))}
            maxLength={24}
          />
          <label htmlFor="new-password">初始密码</label>
          <Input.Password
            id="new-password"
            value={createForm.password}
            placeholder="至少 6 位"
            onChange={(value) => setCreateForm((current) => ({ ...current, password: value }))}
            autoComplete="new-password"
          />
          <label htmlFor="new-role">角色</label>
          <Select
            id="new-role"
            value={createForm.role}
            onChange={(value) =>
              setCreateForm((current) => ({ ...current, role: String(value) as Role }))
            }
            options={ROLES.map((role) => ({ label: ROLE_LABEL[role], value: role }))}
          />
          <label htmlFor="new-shareholder">关联股东（可选）</label>
          <Select
            id="new-shareholder"
            allowClear
            showSearch
            placeholder="不关联"
            value={createForm.shareholderId ?? undefined}
            onChange={(value) =>
              setCreateForm((current) => ({
                ...current,
                shareholderId: value ? String(value) : null,
              }))
            }
            options={shareholders.map((shareholder) => ({
              label: shareholder.name,
              value: shareholder.id,
            }))}
          />
        </div>
      </Modal>

      <Modal
        title={resetTarget ? `重置密码 · ${resetTarget.displayName}` : '重置密码'}
        visible={resetTarget !== null}
        onCancel={() => setResetTarget(null)}
        onOk={() => void submitReset()}
        confirmLoading={resetting}
        okText="重置密码"
        cancelText="取消"
        autoFocus={false}
      >
        <div className="modal-form">
          <label htmlFor="reset-password">新密码</label>
          <Input.Password
            id="reset-password"
            value={newPassword}
            placeholder="至少 6 位"
            onChange={setNewPassword}
            autoComplete="new-password"
          />
          <label htmlFor="reset-confirm">确认新密码</label>
          <Input.Password
            id="reset-confirm"
            value={confirmPassword}
            placeholder="再次输入新密码"
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />
        </div>
      </Modal>

      <Modal
        title="删除账号"
        visible={deleteTarget !== null}
        onCancel={() => setDeleteTarget(null)}
        onOk={() => void submitDelete()}
        confirmLoading={deleting}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ status: 'danger' }}
        autoFocus={false}
      >
        <Alert
          type="error"
          showIcon
          content={`删除后，账号「${deleteTarget?.username ?? ''}」将无法登录，但已写入的股东数据不会被删除。`}
          style={{ marginBottom: 14 }}
        />
        <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.7 }}>
          当前共有 {admins} 个管理员账号，系统会阻止删除最后一个管理员。
        </p>
      </Modal>
    </div>
  );
}
