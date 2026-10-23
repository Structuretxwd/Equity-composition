// 首次初始化时写入的演示数据：3 轮融资、5 位股东，便于直接体验完整流程。
import type { Database } from '@motioneffector/sql';

export const SEED_SHAREHOLDER_IDS = {
  zhang: 'sh-founder-zhang',
  li: 'sh-founder-li',
  chen: 'sh-investor-chen',
  xinghai: 'sh-investor-xinghai',
  vision: 'sh-investor-vision',
} as const;

const ROUND_IDS = {
  angel: 'round-angel-2023',
  preA: 'round-prea-2024',
  seriesA: 'round-seriesa-2025',
} as const;

type ShareholderSeed = {
  id: string;
  name: string;
  type: 'FOUNDER' | 'INVESTOR' | 'NEW_SHAREHOLDER';
  initialShares: number;
};

type HoldingSeed = {
  roundId: string;
  shareholderId: string;
  percent: number;
  dilutionApplied: boolean;
};

const SHAREHOLDERS: ShareholderSeed[] = [
  { id: SEED_SHAREHOLDER_IDS.zhang, name: '张远', type: 'FOUNDER', initialShares: 600_000 },
  { id: SEED_SHAREHOLDER_IDS.li, name: '李岚', type: 'FOUNDER', initialShares: 400_000 },
  { id: SEED_SHAREHOLDER_IDS.chen, name: '陈默', type: 'INVESTOR', initialShares: 0 },
  { id: SEED_SHAREHOLDER_IDS.xinghai, name: '星海资本', type: 'INVESTOR', initialShares: 0 },
  { id: SEED_SHAREHOLDER_IDS.vision, name: '远见基金', type: 'INVESTOR', initialShares: 0 },
];

const ROUNDS = [
  {
    id: ROUND_IDS.angel,
    name: '天使轮',
    date: '2023-03-15',
    totalDilutionPercent: 10,
    investorProtection: false,
  },
  {
    id: ROUND_IDS.preA,
    name: 'Pre-A 轮',
    date: '2024-06-20',
    totalDilutionPercent: 8,
    investorProtection: true,
  },
  {
    id: ROUND_IDS.seriesA,
    name: 'A 轮',
    date: '2025-11-08',
    totalDilutionPercent: 12,
    investorProtection: true,
  },
];

const HOLDINGS: HoldingSeed[] = [
  { roundId: ROUND_IDS.angel, shareholderId: SEED_SHAREHOLDER_IDS.zhang, percent: 54, dilutionApplied: true },
  { roundId: ROUND_IDS.angel, shareholderId: SEED_SHAREHOLDER_IDS.li, percent: 36, dilutionApplied: true },
  { roundId: ROUND_IDS.angel, shareholderId: SEED_SHAREHOLDER_IDS.chen, percent: 10, dilutionApplied: false },

  { roundId: ROUND_IDS.preA, shareholderId: SEED_SHAREHOLDER_IDS.zhang, percent: 49.2, dilutionApplied: true },
  { roundId: ROUND_IDS.preA, shareholderId: SEED_SHAREHOLDER_IDS.li, percent: 32.8, dilutionApplied: true },
  { roundId: ROUND_IDS.preA, shareholderId: SEED_SHAREHOLDER_IDS.chen, percent: 10, dilutionApplied: false },
  { roundId: ROUND_IDS.preA, shareholderId: SEED_SHAREHOLDER_IDS.xinghai, percent: 8, dilutionApplied: false },

  { roundId: ROUND_IDS.seriesA, shareholderId: SEED_SHAREHOLDER_IDS.zhang, percent: 42, dilutionApplied: true },
  { roundId: ROUND_IDS.seriesA, shareholderId: SEED_SHAREHOLDER_IDS.li, percent: 28, dilutionApplied: true },
  { roundId: ROUND_IDS.seriesA, shareholderId: SEED_SHAREHOLDER_IDS.chen, percent: 10, dilutionApplied: false },
  { roundId: ROUND_IDS.seriesA, shareholderId: SEED_SHAREHOLDER_IDS.xinghai, percent: 8, dilutionApplied: false },
  { roundId: ROUND_IDS.seriesA, shareholderId: SEED_SHAREHOLDER_IDS.vision, percent: 12, dilutionApplied: false },
];

export async function seedDatabase(db: Database): Promise<void> {
  const createdAt = '2023-03-01T00:00:00.000Z';

  await db.transaction(() => {
    for (const shareholder of SHAREHOLDERS) {
      db.run(
        `INSERT INTO shareholders (id, name, type, initialShares, createdAt)
         VALUES (?, ?, ?, ?, ?)`,
        [shareholder.id, shareholder.name, shareholder.type, shareholder.initialShares, createdAt],
      );
    }

    for (const round of ROUNDS) {
      db.run(
        `INSERT INTO funding_rounds
           (id, name, date, totalDilutionPercent, investorProtection)
         VALUES (?, ?, ?, ?, ?)`,
        [
          round.id,
          round.name,
          round.date,
          round.totalDilutionPercent,
          round.investorProtection ? 1 : 0,
        ],
      );
    }

    for (const holding of HOLDINGS) {
      db.run(
        `INSERT INTO share_holdings
           (id, shareholderId, fundingRoundId, sharesPercent, dilutionApplied)
         VALUES (?, ?, ?, ?, ?)`,
        [
          `holding-${holding.roundId}-${holding.shareholderId}`,
          holding.shareholderId,
          holding.roundId,
          holding.percent,
          holding.dilutionApplied ? 1 : 0,
        ],
      );

      db.run(
        `INSERT INTO cap_table_snapshots
           (id, roundId, shareholderId, postRoundPercent)
         VALUES (?, ?, ?, ?)`,
        [
          `snapshot-${holding.roundId}-${holding.shareholderId}`,
          holding.roundId,
          holding.shareholderId,
          holding.percent,
        ],
      );
    }

    db.run(
      `INSERT INTO audit_logs
         (id, userId, action, entity, beforeJson, afterJson, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'audit-seed-initial',
        'system',
        'INIT_DATABASE',
        'Database',
        null,
        JSON.stringify({ shareholders: SHAREHOLDERS.length, rounds: ROUNDS.length }),
        createdAt,
      ],
    );
  });
}
