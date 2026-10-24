// sql.js 数据库 Schema 与版本化迁移定义。
// 所有表均在浏览器首次初始化时创建，无任何服务端数据库依赖。
import type { Migration } from '@motioneffector/sql';

export const DB_STORAGE_KEY = 'equity-composition.sqlite';

const INITIAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS shareholders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('FOUNDER', 'INVESTOR', 'NEW_SHAREHOLDER')),
  initialShares INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS funding_rounds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  totalDilutionPercent REAL NOT NULL,
  investorProtection INTEGER NOT NULL DEFAULT 0 CHECK (investorProtection IN (0, 1))
);

CREATE TABLE IF NOT EXISTS share_holdings (
  id TEXT PRIMARY KEY,
  shareholderId TEXT NOT NULL REFERENCES shareholders(id) ON DELETE CASCADE,
  fundingRoundId TEXT NOT NULL REFERENCES funding_rounds(id) ON DELETE CASCADE,
  sharesPercent REAL NOT NULL,
  dilutionApplied INTEGER NOT NULL DEFAULT 1 CHECK (dilutionApplied IN (0, 1)),
  UNIQUE (shareholderId, fundingRoundId)
);

CREATE TABLE IF NOT EXISTS cap_table_snapshots (
  id TEXT PRIMARY KEY,
  roundId TEXT NOT NULL REFERENCES funding_rounds(id) ON DELETE CASCADE,
  shareholderId TEXT NOT NULL REFERENCES shareholders(id) ON DELETE CASCADE,
  postRoundPercent REAL NOT NULL,
  UNIQUE (roundId, shareholderId)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  beforeJson TEXT,
  afterJson TEXT,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_holdings_round ON share_holdings (fundingRoundId);
CREATE INDEX IF NOT EXISTS idx_snapshots_round ON cap_table_snapshots (roundId);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rounds_date ON funding_rounds (date);
`;

const ACCOUNTS_SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  passwordHash TEXT NOT NULL,
  displayName TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'PARTNER', 'INVESTOR')),
  shareholderId TEXT REFERENCES shareholders(id) ON DELETE SET NULL,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts (username);
`;

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: INITIAL_SCHEMA,
    down: `
      DROP INDEX IF EXISTS idx_rounds_date;
      DROP INDEX IF EXISTS idx_audit_time;
      DROP INDEX IF EXISTS idx_snapshots_round;
      DROP INDEX IF EXISTS idx_holdings_round;
      DROP TABLE IF EXISTS audit_logs;
      DROP TABLE IF EXISTS cap_table_snapshots;
      DROP TABLE IF EXISTS share_holdings;
      DROP TABLE IF EXISTS funding_rounds;
      DROP TABLE IF EXISTS shareholders;
    `,
  },
  {
    version: 2,
    up: ACCOUNTS_SCHEMA,
    down: `
      DROP INDEX IF EXISTS idx_accounts_username;
      DROP TABLE IF EXISTS accounts;
    `,
  },
  {
    // 清理旧版本内置的演示数据：5 位股东、3 轮融资及其快照、初始化审计日志和演示账号。
    // 仅删除固定 id / 用户名，不影响用户自行录入的数据。
    version: 3,
    up: `
      UPDATE accounts SET shareholderId = NULL
        WHERE shareholderId IN (
          'sh-founder-zhang', 'sh-founder-li', 'sh-investor-chen',
          'sh-investor-xinghai', 'sh-investor-vision'
        );
      DELETE FROM accounts
        WHERE username IN ('partner', 'investor') AND role <> 'ADMIN';
      DELETE FROM share_holdings
        WHERE shareholderId IN (
          'sh-founder-zhang', 'sh-founder-li', 'sh-investor-chen',
          'sh-investor-xinghai', 'sh-investor-vision'
        )
        OR fundingRoundId IN ('round-angel-2023', 'round-prea-2024', 'round-seriesa-2025');
      DELETE FROM cap_table_snapshots
        WHERE shareholderId IN (
          'sh-founder-zhang', 'sh-founder-li', 'sh-investor-chen',
          'sh-investor-xinghai', 'sh-investor-vision'
        )
        OR roundId IN ('round-angel-2023', 'round-prea-2024', 'round-seriesa-2025');
      DELETE FROM audit_logs WHERE id = 'audit-seed-initial';
      DELETE FROM funding_rounds
        WHERE id IN ('round-angel-2023', 'round-prea-2024', 'round-seriesa-2025');
      DELETE FROM shareholders
        WHERE id IN (
          'sh-founder-zhang', 'sh-founder-li', 'sh-investor-chen',
          'sh-investor-xinghai', 'sh-investor-vision'
        );
    `,
    down: '',
  },
];
