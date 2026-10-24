// 数据库上下文：在客户端初始化 sql.js，并向页面提供查询、导出、导入、重置能力。
'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Button, Spin } from '@arco-design/web-react';
import type { Database } from '@motioneffector/sql';

type AppDbContextValue = {
  db: Database;
  version: number;
  refresh: () => void;
  exportBytes: () => Uint8Array;
  importBytes: (bytes: Uint8Array) => Promise<void>;
  reset: () => Promise<void>;
};

const AppDbContext = createContext<AppDbContextValue | null>(null);

export function DbProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;

    async function bootstrap() {
      try {
        const module = await import('@/lib/db');
        const instance = await module.getDatabase();
        if (alive) setDb(instance);
      } catch (bootstrapError) {
        console.error('[DbProvider] 数据库初始化失败', bootstrapError);
        if (alive) {
          setError(
            bootstrapError instanceof Error
              ? bootstrapError.message
              : '本地数据库初始化失败',
          );
        }
      }
    }

    void bootstrap();
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(() => {
    setVersion((value) => value + 1);
  }, []);

  const exportBytes = useCallback(() => {
    if (!db) throw new Error('数据库尚未就绪');
    return db.export();
  }, [db]);

  const importBytes = useCallback(async (bytes: Uint8Array) => {
    const module = await import('@/lib/db');
    await module.importDatabase(bytes);
    const next = await module.getDatabase();
    setDb(next);
    setVersion((value) => value + 1);
  }, []);

  const reset = useCallback(async () => {
    const module = await import('@/lib/db');
    await module.resetDatabase();
    setVersion((value) => value + 1);
  }, []);

  const value = useMemo<AppDbContextValue | null>(() => {
    if (!db) return null;
    return { db, version, refresh, exportBytes, importBytes, reset };
  }, [db, version, refresh, exportBytes, importBytes, reset]);

  if (error) {
    return (
      <div className="fullscreen-state">
        <div className="panel" style={{ maxWidth: 520 }}>
          <h2 className="page-title">本地数据库加载失败</h2>
          <p className="page-subtitle" style={{ marginBottom: 16 }}>
            {error}
          </p>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>
            请确认 public/sql-wasm.wasm 已随构建产物发布，且浏览器允许使用 IndexedDB。
            如果刚刚清除过浏览器数据，可以刷新页面重新初始化。
          </p>
          <Button type="primary" onClick={() => window.location.reload()}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  if (!value) {
    return (
      <div className="fullscreen-state">
        <Spin size={36} />
        <p className="muted">正在从 IndexedDB 恢复本地数据库…</p>
      </div>
    );
  }

  return <AppDbContext.Provider value={value}>{children}</AppDbContext.Provider>;
}

export function useAppDb(): AppDbContextValue {
  const context = useContext(AppDbContext);
  if (!context) {
    throw new Error('useAppDb 必须在 DbProvider 内部使用');
  }
  return context;
}
