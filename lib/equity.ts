// 股权领域服务：轮次查询、持股快照、数据范围收敛、稀释计算与结构树构建
import { ShareholderType } from '@prisma/client';
import { formatPercent, formatRoundDate, round6 } from './format';
import { prisma } from './prisma';

export type CapTableRow = {
  snapshotId: string | null;
  shareholderId: string;
  shareholderName: string;
  shareholderType: ShareholderType;
  initialShares: number;
  percent: number;
  dilutionApplied: boolean;
  roundId: string;
  roundName: string;
};

export type RoundSummary = {
  id: string;
  name: string;
  date: string;
  totalDilutionPercent: number;
  investorProtection: boolean;
  shareholders: Array<{
    shareholderId: string;
    name: string;
    percent: number;
    type: ShareholderType;
  }>;
};

export type OwnershipTreeNode = {
  id: string;
  label: string;
  kind: 'company' | 'round' | 'shareholder';
  percent: number | null;
  shareholderType?: ShareholderType;
  children?: OwnershipTreeNode[];
};

export type SimulationResult = {
  shareholderId: string;
  name: string;
  type: ShareholderType;
  before: number;
  after: number;
  delta: number;
  protectedByRound: boolean;
};

export type SimulationResponse = {
  newInvestorPercent: number;
  investorProtection: boolean;
  results: SimulationResult[];
};

export { formatPercent, formatRoundDate };

export async function getRounds(): Promise<RoundSummary[]> {
  const rounds = await prisma.fundingRound.findMany({
    orderBy: { date: 'asc' },
    include: {
      snapshots: {
        include: { shareholder: true },
        orderBy: { postRoundPercent: 'desc' },
      },
    },
  });

  return rounds.map((round) => ({
    id: round.id,
    name: round.name,
    date: round.date.toISOString(),
    totalDilutionPercent: Number(round.totalDilutionPercent),
    investorProtection: round.investorProtection,
    shareholders: round.snapshots.map((snapshot) => ({
      shareholderId: snapshot.shareholderId,
      name: snapshot.shareholder.name,
      percent: Number(snapshot.postRoundPercent),
      type: snapshot.shareholder.type,
    })),
  }));
}

/**
 * 读取指定轮次（默认最新轮次）的持股表。
 * scopeShareholderId 存在时只返回该股东的数据，用于 INVESTOR 的数据隔离。
 */
export async function getCapTable(
  roundId?: string,
  scopeShareholderId?: string,
): Promise<CapTableRow[]> {
  const round = roundId
    ? await prisma.fundingRound.findUnique({ where: { id: roundId } })
    : await prisma.fundingRound.findFirst({ orderBy: { date: 'desc' } });

  if (!round) return [];

  const [snapshots, holdings] = await Promise.all([
    prisma.capTableSnapshot.findMany({
      where: {
        roundId: round.id,
        ...(scopeShareholderId ? { shareholderId: scopeShareholderId } : {}),
      },
      include: { shareholder: true },
      orderBy: { postRoundPercent: 'desc' },
    }),
    prisma.shareHolding.findMany({
      where: { fundingRoundId: round.id },
      select: { shareholderId: true, dilutionApplied: true },
    }),
  ]);

  if (snapshots.length > 0) {
    const dilutionByShareholder = new Map(
      holdings.map((holding) => [holding.shareholderId, holding.dilutionApplied]),
    );

    return snapshots.map((snapshot) => ({
      snapshotId: snapshot.id,
      shareholderId: snapshot.shareholderId,
      shareholderName: snapshot.shareholder.name,
      shareholderType: snapshot.shareholder.type,
      initialShares: snapshot.shareholder.initialShares,
      percent: Number(snapshot.postRoundPercent),
      dilutionApplied: dilutionByShareholder.get(snapshot.shareholderId) ?? true,
      roundId: round.id,
      roundName: round.name,
    }));
  }

  // 兼容尚未生成快照的轮次
  const fallbackHoldings = await prisma.shareHolding.findMany({
    where: {
      fundingRoundId: round.id,
      ...(scopeShareholderId ? { shareholderId: scopeShareholderId } : {}),
    },
    include: { shareholder: true },
    orderBy: { sharesPercent: 'desc' },
  });

  return fallbackHoldings.map((holding) => ({
    snapshotId: null,
    shareholderId: holding.shareholderId,
    shareholderName: holding.shareholder.name,
    shareholderType: holding.shareholder.type,
    initialShares: holding.shareholder.initialShares,
    percent: Number(holding.sharesPercent),
    dilutionApplied: holding.dilutionApplied,
    roundId: round.id,
    roundName: round.name,
  }));
}

/** 构建“公司 → 融资轮次 → 股东”的结构树，投资人视角下其他股东聚合展示 */
export async function getOwnershipTree(
  scopeShareholderId?: string,
): Promise<OwnershipTreeNode> {
  const rounds = await prisma.fundingRound.findMany({
    orderBy: { date: 'asc' },
    include: {
      snapshots: {
        include: { shareholder: true },
        orderBy: { postRoundPercent: 'desc' },
      },
    },
  });

  const roundNodes: OwnershipTreeNode[] = rounds.map((round) => {
    const allSnapshots = round.snapshots;
    const visibleSnapshots = scopeShareholderId
      ? allSnapshots.filter((snapshot) => snapshot.shareholderId === scopeShareholderId)
      : allSnapshots;

    const nodes: OwnershipTreeNode[] = visibleSnapshots.map((snapshot) => {
      const percent = Number(snapshot.postRoundPercent);
      return {
        id: `${round.id}:${snapshot.shareholderId}`,
        label: `${snapshot.shareholder.name} ${formatPercent(percent)}`,
        kind: 'shareholder',
        percent,
        shareholderType: snapshot.shareholder.type,
      };
    });

    if (scopeShareholderId) {
      const others = allSnapshots
        .filter((snapshot) => snapshot.shareholderId !== scopeShareholderId)
        .reduce((sum, snapshot) => sum + Number(snapshot.postRoundPercent), 0);

      if (others > 0) {
        nodes.push({
          id: `${round.id}:others`,
          label: `其他股东 ${formatPercent(others)}`,
          kind: 'shareholder',
          percent: round6(others),
          shareholderType: ShareholderType.INVESTOR,
        });
      }
    }

    return {
      id: `round-${round.id}`,
      label: `${round.name} · ${formatRoundDate(round.date)}`,
      kind: 'round',
      percent: null,
      children: nodes,
    };
  });

  return {
    id: 'company',
    label: '公司股权结构',
    kind: 'company',
    percent: null,
    children: roundNodes,
  };
}

/** 纯函数：给定当前持股，模拟新一轮融资后的稀释结果（不写入数据库） */
export function simulateDilution(
  rows: CapTableRow[],
  newInvestorPercent: number,
  investorProtection: boolean,
): SimulationResponse {
  if (!Number.isFinite(newInvestorPercent) || newInvestorPercent <= 0 || newInvestorPercent >= 100) {
    throw new Error('新一轮融资比例必须大于 0 且小于 100%');
  }

  const protectedRows = investorProtection
    ? rows.filter((row) => row.shareholderType === ShareholderType.INVESTOR)
    : [];
  const protectedSum = protectedRows.reduce((sum, row) => sum + row.percent, 0);
  const remaining = 100 - newInvestorPercent - protectedSum;

  if (remaining < -0.000001) {
    throw new Error('投资人保护后剩余比例不足，无法完成该轮融资');
  }

  const unprotectedBase = 100 - protectedSum;
  const scale = unprotectedBase > 0 ? remaining / unprotectedBase : 0;

  const results: SimulationResult[] = rows.map((row) => {
    const isProtected = protectedRows.some(
      (protectedRow) => protectedRow.shareholderId === row.shareholderId,
    );
    const after = round6(isProtected ? row.percent : row.percent * scale);

    return {
      shareholderId: row.shareholderId,
      name: row.shareholderName,
      type: row.shareholderType,
      before: row.percent,
      after,
      delta: round6(after - row.percent),
      protectedByRound: isProtected,
    };
  });

  results.push({
    shareholderId: 'new-investor',
    name: '新一轮投资人',
    type: ShareholderType.NEW_SHAREHOLDER,
    before: 0,
    after: newInvestorPercent,
    delta: newInvestorPercent,
    protectedByRound: false,
  });

  return {
    newInvestorPercent,
    investorProtection,
    results: results.sort((a, b) => b.after - a.after),
  };
}
