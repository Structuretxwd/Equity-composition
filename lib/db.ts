// 浏览器端数据库入口：
// sql.js 在内存中运行 SQLite，@motioneffector/sql 负责迁移与 IndexedDB 自动持久化。
// 本文件只在客户端动态加载，绝不能出现在服务端渲染路径中。
import {
  createDatabase,
  type Database,
  type StorageAdapter,
} from '@motioneffector/sql';
import { DB_STORAGE_KEY, MIGRATIONS } from './schema';
import { ensureDefaultAccounts } from './accounts';

const SQLITE_HEADER = [83, 81, 76, 105, 116, 101, 32, 102, 111, 114, 109, 97, 116, 32, 51, 0];

const IDB_NAME = 'equity-composition';
const IDB_STORE = 'sqlite';

let dbPromise: Promise<Database> | null = null;
let dbInstance: Database | null = null;

let idbPromise: Promise<IDBDatabase> | null = null;
// 导入并关闭旧实例时，旧实例的 close() 会触发一次落盘，可能覆盖刚导入的数据；
// 该开关用于在关闭旧实例的瞬间跳过这次写入。
let persistWritesEnabled = true;

/** 打开（或首次创建）IndexedDB 库，所有 sqlite 快照都存在单一 object store 中 */
function getIndexedDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('当前浏览器不支持 IndexedDB'));
  }
  if (!idbPromise) {
    idbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(IDB_STORE)) {
          database.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error('IndexedDB 打开失败'));
    });
  }
  return idbPromise;
}

/**
 * 自定义 IndexedDB 适配器。
 * 注意：@motioneffector/sql 1.0.1 的 `storage: 'indexeddb'` 分支是空实现（不会真正落盘），
 * 因此这里显式传入 StorageAdapter，保证 db.save() 与自动保存真正写入浏览器存储。
 */
const indexedDbStorage: StorageAdapter = {
  async getItem(key) {
    const database = await getIndexedDb();
    const value = await new Promise<unknown>((resolve, reject) => {
      const transaction = database.transaction(IDB_STORE, 'readonly');
      const request = transaction.objectStore(IDB_STORE).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB 读取失败'));
    });

    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    return null;
  },
  async setItem(key, value) {
    if (!persistWritesEnabled) return;
    const database = await getIndexedDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(IDB_STORE, 'readwrite');
      transaction.objectStore(IDB_STORE).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('IndexedDB 写入失败'));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('IndexedDB 写入被中止'));
    });
  },
  async removeItem(key) {
    const database = await getIndexedDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(IDB_STORE, 'readwrite');
      transaction.objectStore(IDB_STORE).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('IndexedDB 删除失败'));
    });
  },
};

/** public 目录下的 wasm 地址需要显式拼接 basePath，否则 GitHub Pages 子路径会 404 */
function getWasmPath(): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  return `${basePath}/sql-wasm.wasm`;
}

/** 校验 SQLite 文件头，避免用户误传任意文件覆盖本地数据库 */
export function isSqliteFile(bytes: Uint8Array): boolean {
  if (bytes.length < SQLITE_HEADER.length) return false;
  return SQLITE_HEADER.every((value, index) => bytes[index] === value);
}

async function openDatabase(data?: Uint8Array): Promise<Database> {
  const db = await createDatabase({
    data,
    wasmPath: getWasmPath(),
    persist: {
      key: DB_STORAGE_KEY,
      storage: indexedDbStorage,
    },
    autoSave: true,
    autoSaveDebounce: 600,
  });

  // 每次打开都执行增量迁移，旧备份文件也能自动升级到最新 Schema
  await db.migrate(MIGRATIONS);

  // 旧版本数据库没有 accounts 表数据时，补齐默认账号
  await ensureDefaultAccounts(db);

  await db.save();
  dbInstance = db;
  return db;
}

/** 单例入口：React StrictMode 下重复调用也只会创建一次数据库 */
export function getDatabase(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = openDatabase().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

export async function getDatabaseInstance(): Promise<Database> {
  if (dbInstance) return dbInstance;
  return getDatabase();
}

/**
 * 导入 .sqlite 备份：
 * 1. 先校验文件头；
 * 2. 用导入数据创建新实例并执行迁移（失败时旧库保持可用）；
 * 3. 成功后替换单例、关闭旧实例，并立即写入 IndexedDB。
 */
export async function importDatabase(bytes: Uint8Array): Promise<void> {
  if (!isSqliteFile(bytes)) {
    throw new Error('文件不是有效的 SQLite 数据库');
  }

  const next = await createDatabase({
    data: bytes,
    wasmPath: getWasmPath(),
    persist: { key: DB_STORAGE_KEY, storage: indexedDbStorage },
    autoSave: true,
    autoSaveDebounce: 600,
  });

  try {
    await next.migrate(MIGRATIONS);
    await ensureDefaultAccounts(next);

    await next.save();

    const previous = dbInstance;
    dbInstance = next;
    dbPromise = Promise.resolve(next);

    if (previous) {
      // @motioneffector/sql 的 close() 会把旧内存库再写一次存储；
      // 若此时不阻止，会用旧数据覆盖刚刚导入的备份。
      persistWritesEnabled = false;
      try {
        previous.close();
      } finally {
        persistWritesEnabled = true;
      }
    }
  } catch (error) {
    // 导入失败时关闭半成品实例，同样不能让它把不完整数据写回 IndexedDB
    persistWritesEnabled = false;
    try {
      next.close();
    } finally {
      persistWritesEnabled = true;
    }
    throw error;
  }
}

/** 清空业务数据（仅管理员可见）：删除股东、轮次、持股与审计日志，账号保留 */
export async function resetDatabase(): Promise<void> {
  const db = await getDatabase();

  await db.transaction(() => {
    // 先解除账号与股东的绑定，避免删除股东时留下悬空引用
    db.run('UPDATE accounts SET shareholderId = NULL WHERE shareholderId IS NOT NULL');
    db.exec(`
      DROP TABLE IF EXISTS audit_logs;
      DROP TABLE IF EXISTS cap_table_snapshots;
      DROP TABLE IF EXISTS share_holdings;
      DROP TABLE IF EXISTS funding_rounds;
      DROP TABLE IF EXISTS shareholders;
      DROP TABLE IF EXISTS _migrations;
    `);
  });

  await db.migrate(MIGRATIONS);
  await ensureDefaultAccounts(db);
  await db.save();
}
