// 数据管理：导出/导入 .sqlite 是 GitHub Pages 静态方案下备份与迁移数据的核心手段。
'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Message,
  Modal,
  Tag,
} from '@arco-design/web-react';
import { IconDelete, IconDownload, IconUpload } from '@arco-design/web-react/icon';
import { MetricStrip } from '@/components/MetricStrip';
import { PageHeader } from '@/components/PageHeader';
import { useAppDb } from '@/components/DbProvider';
import { useSession } from '@/components/SessionContext';
import { formatBytes } from '@/lib/format';
import { getDatabaseStats } from '@/lib/repo';
import {
  canExportDatabase,
  canImportDatabase,
  canResetDatabase,
} from '@/lib/rbac';

export default function DataPage() {
  const { db, version, exportBytes, importBytes, reset } = useAppDb();
  const session = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [resetVisible, setResetVisible] = useState(false);
  const [resetting, setResetting] = useState(false);

  const stats = useMemo(() => getDatabaseStats(db), [db, version]);
  const size = useMemo(() => db.export().length, [db, version]);

  const mayExport = canExportDatabase(session.role);
  const mayImport = canImportDatabase(session.role);
  const mayReset = canResetDatabase(session.role);

  function handleExport() {
    try {
      const bytes = exportBytes();
      const copy = new Uint8Array(bytes);
      const blob = new Blob([copy.buffer as ArrayBuffer], {
        type: 'application/vnd.sqlite3',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `equity-backup-${date}.sqlite`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      Message.success('数据库备份已开始下载');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '导出失败');
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size === 0) {
      Message.error('文件为空，请选择有效的 .sqlite 备份');
      return;
    }
    setPendingFile(file);
  }

  async function confirmImport() {
    if (!pendingFile) return;
    setImporting(true);
    try {
      const bytes = new Uint8Array(await pendingFile.arrayBuffer());
      await importBytes(bytes);
      setPendingFile(null);
      Message.success('导入完成，正在刷新本地数据…');
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '导入失败');
    } finally {
      setImporting(false);
    }
  }

  async function confirmReset() {
    setResetting(true);
    try {
      await reset();
      Message.success('业务数据已清空，账号保留');
      setResetVisible(false);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '清空失败');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="数据管理"
        subtitle="数据库完全运行在浏览器中。导出 .sqlite 文件即可离线归档，或迁移到另一台设备。"
        extra={<Tag color="blue">GitHub Pages 静态模式</Tag>}
      />

      <Alert
        type="warning"
        showIcon
        content="数据默认只保存在当前浏览器的 IndexedDB 中，不会上传到任何服务器。更换设备、更换浏览器或清除站点数据都会导致数据丢失，请定期导出 .sqlite 备份。"
      />

      <MetricStrip
        items={[
          {
            label: '股东数量',
            value: stats.shareholders,
            hint: 'Shareholder 表记录数',
          },
          {
            label: '融资轮次',
            value: stats.rounds,
            hint: '含历史轮次快照',
          },
          {
            label: '审计日志',
            value: stats.auditLogs,
            hint: '随数据库一起导出',
          },
          {
            label: '数据库体积',
            value: formatBytes(size),
            hint: 'sql.js export() 实时大小',
          },
        ]}
      />

      <div className="data-grid">
        <section className="panel data-action">
          <div>
            <h3>导出数据库</h3>
            <Tag color="green" size="small">
              推荐定期执行
            </Tag>
          </div>
          <p>
            通过 sql.js 的 db.export() 生成完整 SQLite 文件，包含股东、轮次、持股快照与审计日志。
            文件未加密，请存放在可信的离线介质中。
          </p>
          <div className="data-action-foot">
            <Button
              type="primary"
              icon={<IconDownload />}
              onClick={handleExport}
              disabled={!mayExport}
            >
              导出 .sqlite
            </Button>
            {!mayExport && <span className="muted">当前角色无导出权限</span>}
          </div>
        </section>

        <section className="panel data-action">
          <div>
            <h3>导入数据库</h3>
            <Tag color="orange" size="small">
              会覆盖当前数据
            </Tag>
          </div>
          <p>
            选择此前导出的 .sqlite 文件，系统会校验 SQLite 文件头、执行增量迁移并重建浏览器内存数据库。
            导入完成后 IndexedDB 中的旧数据将被替换。
          </p>
          <div className="data-action-foot">
            <input
              ref={fileInputRef}
              type="file"
              accept=".sqlite,.db,application/vnd.sqlite3,application/x-sqlite3"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <Button
              icon={<IconUpload />}
              onClick={() => fileInputRef.current?.click()}
              disabled={!mayImport}
            >
              选择 .sqlite 文件
            </Button>
            {!mayImport && <span className="muted">仅管理员可导入</span>}
          </div>
        </section>

        <section className="panel data-action danger-panel">
          <div>
            <h3>清空业务数据</h3>
            <Tag color="red" size="small">
              危险操作
            </Tag>
          </div>
          <p>
            删除当前浏览器中的全部股东、融资轮次、持股快照与审计日志。账号与会话不受影响，
            操作后系统为空白库，可由管理员重新录入或导入备份。该操作不可撤销，建议先导出备份。
          </p>
          <div className="data-action-foot">
            <Button
              status="danger"
              icon={<IconDelete />}
              onClick={() => setResetVisible(true)}
              disabled={!mayReset}
            >
              清空业务数据
            </Button>
            {!mayReset && <span className="muted">仅管理员可清空</span>}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">本地存储说明</h2>
            <p className="panel-subtitle">静态站点没有服务端，以下信息全部发生在当前标签页与浏览器内。</p>
          </div>
        </div>
        <div className="meta-list">
          <div className="meta-row">
            <span>数据库引擎</span>
            <strong>sql.js (SQLite WebAssembly)</strong>
          </div>
          <div className="meta-row">
            <span>持久化位置</span>
            <strong>IndexedDB · equity-composition.sqlite</strong>
          </div>
          <div className="meta-row">
            <span>自动保存</span>
            <strong>开启（600ms 防抖，写操作后立即保存）</strong>
          </div>
          <div className="meta-row">
            <span>会话存储</span>
            <strong>sessionStorage（关闭标签页失效）</strong>
          </div>
          <div className="meta-row">
            <span>备份建议</span>
            <strong>每次调整股权结构后，导出一份 .sqlite 文件离线留存</strong>
          </div>
        </div>
      </section>

      <Modal
        title="确认导入数据库"
        visible={pendingFile !== null}
        onCancel={() => setPendingFile(null)}
        onOk={() => void confirmImport()}
        confirmLoading={importing}
        okText="覆盖并导入"
        cancelText="取消"
        autoFocus={false}
      >
        <Alert
          type="warning"
          showIcon
          content="导入会完全替换当前浏览器中的数据库，现有股东、轮次与审计日志都将被覆盖。"
          style={{ marginBottom: 14 }}
        />
        <div className="meta-list">
          <div className="meta-row">
            <span>文件名</span>
            <strong>{pendingFile?.name}</strong>
          </div>
          <div className="meta-row">
            <span>文件大小</span>
            <strong>{pendingFile ? formatBytes(pendingFile.size) : '—'}</strong>
          </div>
        </div>
      </Modal>

      <Modal
        title="确认清空业务数据"
        visible={resetVisible}
        onCancel={() => setResetVisible(false)}
        onOk={() => void confirmReset()}
        confirmLoading={resetting}
        okText="确认清空"
        cancelText="取消"
        okButtonProps={{ status: 'danger' }}
        autoFocus={false}
      >
        <Alert
          type="error"
          showIcon
          content="此操作会删除当前浏览器中的全部业务数据，且无法恢复。若尚未导出备份，请先取消并执行导出。"
          style={{ marginBottom: 14 }}
        />
        <p className="page-subtitle" style={{ margin: 0 }}>
          清空范围：股东、融资轮次、持股快照与审计日志。账号信息会保留，可继续登录使用。
        </p>
      </Modal>
    </div>
  );
}
