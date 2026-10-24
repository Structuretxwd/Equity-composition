// 本地账号体系：登录校验、管理员创建账号与 GitHub 管理员身份绑定。
// 账号保存在浏览器数据库里，登录后由账号记录自动决定角色与数据范围。
import type { Database } from '@motioneffector/sql';
import type { AccountRow, Role } from './types';

type AccountRecord = {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  role: Role;
  shareholderId: string | null;
  shareholderName: string | null;
  createdAt: string;
};

const USERNAME_PATTERN = /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,24}$/;

/**
 * 仅保留引导用的管理员账号。
 * 演示业务数据与 partner / investor 演示账号已移除，注册入口也已关闭；
 * 其他账号由管理员在控制台创建。
 */
export const DEFAULT_ACCOUNTS: Array<{
  username: string;
  password: string;
  displayName: string;
  role: Role;
  shareholderId: string | null;
  hash: string;
}> = [
  {
    username: 'admin',
    password: 'admin123',
    displayName: '系统管理员',
    role: 'ADMIN',
    shareholderId: null,
    hash:
      process.env.NEXT_PUBLIC_ADMIN_PASSWORD_HASH?.trim() ||
      '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  },
];

/** 构建时注入自定义密码哈希后，登录页不再展示演示口令 */
export const DEMO_LOGIN_ENABLED =
  !process.env.NEXT_PUBLIC_ADMIN_PASSWORD_HASH &&
  process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

export function validateUsername(raw: string): string {
  const username = raw.trim();
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error('账号需为 2–24 位中文、字母、数字或下划线');
  }
  return username;
}

export function validatePassword(raw: string): string {
  if (raw.length < 6) throw new Error('密码至少 6 位');
  if (raw.length > 64) throw new Error('密码不能超过 64 位');
  return raw;
}

export async function hashPassword(value: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('当前环境不支持密码加密，请使用 HTTPS 或 localhost 访问');
  }
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function accountId(): string {
  return `account-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readAccount(db: Database, id: string): AccountRecord | null {
  return (
    db.get<AccountRecord>(
      `SELECT a.id, a.username, a.passwordHash, a.displayName, a.role,
              a.shareholderId, s.name AS shareholderName, a.createdAt
       FROM accounts a
       LEFT JOIN shareholders s ON s.id = a.shareholderId
       WHERE a.id = ?`,
      [id],
    ) ?? null
  );
}

export function listAccounts(db: Database): AccountRow[] {
  return db.all<AccountRow>(
    `SELECT a.id, a.username, a.displayName, a.role,
            a.shareholderId, s.name AS shareholderName, a.createdAt
     FROM accounts a
     LEFT JOIN shareholders s ON s.id = a.shareholderId
     ORDER BY CASE a.role WHEN 'ADMIN' THEN 0 WHEN 'PARTNER' THEN 1 ELSE 2 END,
              a.createdAt ASC`,
  );
}

export function countAccounts(db: Database): number {
  return Number(db.get<{ count: number }>('SELECT COUNT(*) AS count FROM accounts')?.count ?? 0);
}

export function countAdmins(db: Database): number {
  return Number(
    db.get<{ count: number }>("SELECT COUNT(*) AS count FROM accounts WHERE role = 'ADMIN'")
      ?.count ?? 0,
  );
}

/** 兼容旧索引：首次启动或导入旧备份时补齐默认账号 */
export async function ensureDefaultAccounts(db: Database): Promise<void> {
  if (countAccounts(db) > 0) return;

  const createdAt = new Date().toISOString();
  await db.transaction(() => {
    for (const account of DEFAULT_ACCOUNTS) {
      db.run(
        `INSERT INTO accounts
           (id, username, passwordHash, displayName, role, shareholderId, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          accountId(),
          account.username,
          account.hash,
          account.displayName,
          account.role,
          account.shareholderId,
          createdAt,
        ],
      );
    }
  });
}

export async function verifyCredentials(
  db: Database,
  username: string,
  password: string,
): Promise<AccountRow> {
  const row = db.get<AccountRecord>(
    `SELECT a.id, a.username, a.passwordHash, a.displayName, a.role,
            a.shareholderId, s.name AS shareholderName, a.createdAt
     FROM accounts a
     LEFT JOIN shareholders s ON s.id = a.shareholderId
     WHERE a.username = ?`,
    [username.trim()],
  );

  if (!row) throw new Error('账号不存在，请检查账号名或联系管理员');

  const hash = await hashPassword(password);
  if (hash !== row.passwordHash) throw new Error('密码不正确');

  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role,
    shareholderId: row.shareholderId,
    shareholderName: row.shareholderName,
    createdAt: row.createdAt,
  };
}

export async function createAccount(
  db: Database,
  input: {
    username: string;
    password: string;
    displayName?: string;
    role?: Role;
    shareholderId?: string | null;
  },
): Promise<AccountRow> {
  const username = validateUsername(input.username);
  const password = validatePassword(input.password);
  const displayName = (input.displayName ?? '').trim() || username;

  const exists = db.get<{ id: string }>('SELECT id FROM accounts WHERE username = ?', [username]);
  if (exists) throw new Error('该账号已存在');

  const shareholderId = input.shareholderId || null;
  if (shareholderId) {
    const shareholder = db.get<{ id: string }>('SELECT id FROM shareholders WHERE id = ?', [
      shareholderId,
    ]);
    if (!shareholder) throw new Error('关联的股东不存在');
  }

  const id = accountId();
  const passwordHash = await hashPassword(password);
  await db.transaction(() => {
    db.run(
      `INSERT INTO accounts
         (id, username, passwordHash, displayName, role, shareholderId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        username,
        passwordHash,
        displayName,
        input.role ?? 'PARTNER',
        shareholderId,
        new Date().toISOString(),
      ],
    );
  });
  await db.save();

  const created = readAccount(db, id);
  if (!created) throw new Error('账号创建失败');
  return created;
}

/**
 * 绑定 GitHub 管理员身份：
 * 令牌验证通过后，把 GitHub 用户名映射为本地 ADMIN 账号。
 * 已存在同名账号时提升为管理员；不存在时创建一个不可用密码的账号占位。
 */
export async function upsertGithubAdmin(
  db: Database,
  input: { login: string; name?: string | null },
): Promise<AccountRow> {
  const login = input.login.trim();
  if (!login) throw new Error('GitHub 用户名为空');

  const existing = db.get<{ id: string; role: Role }>(
    'SELECT id, role FROM accounts WHERE username = ?',
    [login],
  );

  if (existing) {
    if (existing.role !== 'ADMIN') {
      await db.transaction(() => {
        db.run("UPDATE accounts SET role = 'ADMIN' WHERE id = ?", [existing.id]);
      });
      await db.save();
    }
    const account = readAccount(db, existing.id);
    if (!account) throw new Error('账号读取失败');
    return account;
  }

  const id = accountId();
  const displayName = (input.name ?? '').trim() || login;
  // GitHub 登录不依赖本地密码，写入随机哈希占位，避免空密码可登录
  const passwordHash = await hashPassword(crypto.randomUUID());
  await db.transaction(() => {
    db.run(
      `INSERT INTO accounts
         (id, username, passwordHash, displayName, role, shareholderId, createdAt)
       VALUES (?, ?, ?, ?, 'ADMIN', NULL, ?)`,
      [id, login, passwordHash, displayName, new Date().toISOString()],
    );
  });
  await db.save();

  const created = readAccount(db, id);
  if (!created) throw new Error('账号创建失败');
  return created;
}

export async function updateAccount(
  db: Database,
  id: string,
  patch: {
    displayName?: string;
    role?: Role;
    shareholderId?: string | null;
  },
): Promise<void> {
  const current = readAccount(db, id);
  if (!current) throw new Error('账号不存在');

  const nextRole = patch.role ?? current.role;
  if (current.role === 'ADMIN' && nextRole !== 'ADMIN' && countAdmins(db) <= 1) {
    throw new Error('至少需要保留一个管理员账号');
  }

  const nextShareholderId =
    patch.shareholderId === undefined ? current.shareholderId : patch.shareholderId || null;

  if (nextShareholderId) {
    const shareholder = db.get<{ id: string }>('SELECT id FROM shareholders WHERE id = ?', [
      nextShareholderId,
    ]);
    if (!shareholder) throw new Error('关联的股东不存在');
  }

  await db.transaction(() => {
    db.run(
      `UPDATE accounts
       SET displayName = ?, role = ?, shareholderId = ?
       WHERE id = ?`,
      [
        (patch.displayName ?? current.displayName).trim() || current.displayName,
        nextRole,
        nextShareholderId,
        id,
      ],
    );
  });
  await db.save();
}

export async function resetAccountPassword(
  db: Database,
  id: string,
  password: string,
): Promise<void> {
  validatePassword(password);
  if (!readAccount(db, id)) throw new Error('账号不存在');

  const passwordHash = await hashPassword(password);
  await db.transaction(() => {
    db.run('UPDATE accounts SET passwordHash = ? WHERE id = ?', [passwordHash, id]);
  });
  await db.save();
}

export async function deleteAccount(db: Database, id: string): Promise<void> {
  const current = readAccount(db, id);
  if (!current) throw new Error('账号不存在');
  if (current.role === 'ADMIN' && countAdmins(db) <= 1) {
    throw new Error('至少需要保留一个管理员账号');
  }

  await db.transaction(() => {
    db.run('DELETE FROM accounts WHERE id = ?', [id]);
  });
  await db.save();
}
