// 数据访问层：所有 SQL 集中在此处，页面组件不直接拼接 SQL。
import type { Database } from '@motioneffector/sql';
import { round6 } from './format';
import { assertCanEditCapTable } from './rbac';
import type {
  AuditLogRow,
  CapTableRow,
  DatabaseStats,
  FundingRound,
  RoundSummary,
  Role,
  ShareholderType,
} from './types';

type RoundRecord = {
  id: string;
  name: string;
  date: string;
  totalDilutionPercent: number;
  investorProtection: number;
};

type ParticipantRecord = {
  roundId: string;
  shareholderId: string;
  name: string;
  type: ShareholderType;
  percent: number;
  dilutionApplied: number;
};

type CapTableRecord = {
  snapshotId: string | null;
  shareholderId: string;
  shareholderName: string;
  shareholderType: ShareholderType;
  initialShares: number;
  percent: number;
  dilutionApplied: number;
  roundId: string;
  roundName: string;
};

export function listRounds(db: Database): RoundSummary[] {
  const rounds = db.all<RoundRecord>(
    `SELECT id, name, date, totalDilutionPercent, investorProtection
     FROM funding_rounds
     ORDER BY date DESC`,
  );

  if (rounds.length === 0) return [];

  const participants = db.all<ParticipantRecord>(
    `SELECT c.roundId AS roundId,
            c.shareholderId AS shareholderId,
            s.name AS name,
            s.type AS type,
            c.postRoundPercent AS percent,
            COALESCE(h.dilutionApplied, 1) AS dilutionApplied
     FROM cap_table_snapshots c
     JOIN shareholders s ON s.id = c.shareholderId
     LEFT JOIN share_holdings h
       ON h.fundingRoundId = c.roundId AND h.shareholderId = c.shareholderId
     ORDER BY c.postRoundPercent DESC`,
  );

  const byRound = new Map<string, ParticipantRecord[]>();
  for (const participant of participants) {
    const list = byRound.get(participant.roundId) ?? [];
    list.push(participant);
    byRound.set(participant.roundId, list);
  }

  return rounds.map((round) => ({
    id: round.id,
    name: round.name,
    date: round.date,
    totalDilutionPercent: Number(round.totalDilutionPercent),
    investorProtection: Boolean(round.investorProtection),
    shareholders: (byRound.get(round.id) ?? []).map((participant) => ({
      shareholderId: participant.shareholderId,
      name: participant.name,
      percent: Number(participant.percent),
      type: participant.type,
      dilutionApplied: Boolean(participant.dilutionApplied),
    })),
  }));
}

export function getLatestRound(db: Database): RoundSummary | null {
  return listRounds(db)[0] ?? null;
}

export function getRound(db: Database, roundId: string): FundingRound | null {
  const row = db.get<RoundRecord>(
    `SELECT id, name, date, totalDilutionPercent, investorProtection
     FROM funding_rounds WHERE id = ?`,
    [roundId],
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    totalDilutionPercent: Number(row.totalDilutionPercent),
    investorProtection: Boolean(row.investorProtection),
  };
}

/**
 * 读取指定轮次的持股表。
 * scopeShareholderId 用于 INVESTOR 数据隔离，只返回该股东自己的记录。
 */
export function getCapTable(
  db: Database,
  roundId: string,
  scopeShareholderId?: string,
): CapTableRow[] {
  const round = getRound(db, roundId);
  if (!round) return [];

  const scopeSql = scopeShareholderId ? 'AND c.shareholderId = ?' : '';
  const scopeParams = scopeShareholderId ? [scopeShareholderId] : [];

  const snapshots = db.all<CapTableRecord>(
    `SELECT c.id AS snapshotId,
            s.id AS shareholderId,
            s.name AS shareholderName,
            s.type AS shareholderType,
            s.initialShares AS initialShares,
            c.postRoundPercent AS percent,
            COALESCE(h.dilutionApplied, 1) AS dilutionApplied,
            c.roundId AS roundId,
            ? AS roundName
     FROM cap_table_snapshots c
     JOIN shareholders s ON s.id = c.shareholderId
     LEFT JOIN share_holdings h
       ON h.fundingRoundId = c.roundId AND h.shareholderId = c.shareholderId
     WHERE c.roundId = ? ${scopeSql}
     ORDER BY c.postRoundPercent DESC`,
    [round.name, roundId, ...scopeParams],
  );

  if (snapshots.length > 0) {
    return snapshots.map((row) => ({
      ...row,
      initialShares: Number(row.initialShares),
      percent: Number(row.percent),
      dilutionApplied: Boolean(row.dilutionApplied),
    }));
  }

  // 兼容尚未生成快照的历史轮次
  const holdings = db.all<CapTableRecord>(
    `SELECT NULL AS snapshotId,
            s.id AS shareholderId,
            s.name AS shareholderName,
            s.type AS shareholderType,
            s.initialShares AS initialShares,
            h.sharesPercent AS percent,
            h.dilutionApplied AS dilutionApplied,
            h.fundingRoundId AS roundId,
            ? AS roundName
     FROM share_holdings h
     JOIN shareholders s ON s.id = h.shareholderId
     WHERE h.fundingRoundId = ? ${scopeShareholderId ? 'AND h.shareholderId = ?' : ''}
     ORDER BY h.sharesPercent DESC`,
    [round.name, roundId, ...scopeParams],
  );

  return holdings.map((row) => ({
    ...row,
    initialShares: Number(row.initialShares),
    percent: Number(row.percent),
    dilutionApplied: Boolean(row.dilutionApplied),
  }));
}

export type CapTableUpdate = {
  shareholderId: string;
  percent: number;
};

/**
 * 管理员调整某轮持股比例。
 * 写入前再次校验角色，防止绕过 UI 直接调用数据层。
 */
export async function updateCapTable(
  db: Database,
  input: {
    roundId: string;
    updates: CapTableUpdate[];
    actor: { role: Role; name: string };
  },
): Promise<boolean> {
  assertCanEditCapTable(input.actor.role);

  const round = getRound(db, input.roundId);
  if (!round) throw new Error('融资轮次不存在');

  const beforeRows = getCapTable(db, input.roundId);
  if (beforeRows.length === 0) throw new Error('当前轮次没有可编辑的持股记录');

  if (input.updates.length !== beforeRows.length) {
    throw new Error('请提交完整的持股比例列表');
  }

  const beforeMap = new Map(beforeRows.map((row) => [row.shareholderId, row]));
  const normalized = input.updates.map((update) => {
    const before = beforeMap.get(update.shareholderId);
    if (!before) throw new Error('存在不属于当前轮次的股东');
    if (!Number.isFinite(update.percent) || update.percent < 0 || update.percent > 100) {
      throw new Error('持股比例必须在 0 到 100 之间');
    }
    return { ...update, percent: round6(update.percent), before };
  });

  const total = round6(normalized.reduce((sum, item) => sum + item.percent, 0));
  if (Math.abs(total - 100) > 0.001) {
    throw new Error(`持股比例合计必须为 100%，当前为 ${total.toFixed(2)}%`);
  }

  const changed = normalized.some(
    (item) => Math.abs(item.percent - item.before.percent) > 0.000001,
  );
  if (!changed) return false;

  const beforeJson = JSON.stringify(
    beforeRows.map((row) => ({
      shareholderId: row.shareholderId,
      name: row.shareholderName,
      percent: row.percent,
    })),
  );
  const afterJson = JSON.stringify(
    normalized
      .map((item) => ({
        shareholderId: item.shareholderId,
        name: item.before.shareholderName,
        percent: item.percent,
      }))
      .sort((a, b) => b.percent - a.percent),
  );

  await db.transaction(() => {
    for (const item of normalized) {
      db.run(
        `UPDATE cap_table_snapshots
         SET postRoundPercent = ?
         WHERE roundId = ? AND shareholderId = ?`,
        [item.percent, input.roundId, item.shareholderId],
      );
      db.run(
        `UPDATE share_holdings
         SET sharesPercent = ?
         WHERE fundingRoundId = ? AND shareholderId = ?`,
        [item.percent, input.roundId, item.shareholderId],
      );
    }

    db.run(
      `INSERT INTO audit_logs
         (id, userId, action, entity, beforeJson, afterJson, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        `${input.actor.name}（${input.actor.role}）`,
        'UPDATE_CAP_TABLE',
        `FundingRound:${input.roundId}`,
        beforeJson,
        afterJson,
        new Date().toISOString(),
      ],
    );
  });

  // 立即落盘，避免用户修改后立刻关闭标签页导致 debounce 尚未触发
  await db.save();
  return true;
}

export function listAuditLogs(db: Database, limit = 300): AuditLogRow[] {
  return db.all<AuditLogRow>(
    `SELECT id, userId, action, entity, beforeJson, afterJson, timestamp
     FROM audit_logs
     ORDER BY timestamp DESC
     LIMIT ?`,
    [limit],
  );
}

export function getDatabaseStats(db: Database): DatabaseStats {
  const count = (table: string) =>
    Number(db.get<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`)?.count ?? 0);

  return {
    shareholders: count('shareholders'),
    rounds: count('funding_rounds'),
    holdings: count('share_holdings'),
    snapshots: count('cap_table_snapshots'),
    auditLogs: count('audit_logs'),
  };
}
