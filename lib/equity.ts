// 股权领域纯函数：结构树构建与稀释模拟，不接触数据库，便于独立验证。
import { formatPercent, formatRoundDate, round6 } from './format';
import type {
  CapTableRow,
  OwnershipTreeNode,
  RoundSummary,
  ShareholderType,
  SimulationResponse,
  SimulationResult,
} from './types';

export function buildOwnershipTree(
  rounds: RoundSummary[],
  scopeShareholderId?: string,
): OwnershipTreeNode {
  const sorted = [...rounds].sort((a, b) => a.date.localeCompare(b.date));

  const roundNodes: OwnershipTreeNode[] = sorted.map((round) => {
    const visible = scopeShareholderId
      ? round.shareholders.filter((item) => item.shareholderId === scopeShareholderId)
      : round.shareholders;

    const children: OwnershipTreeNode[] = visible.map((item) => ({
      id: `${round.id}:${item.shareholderId}`,
      label: `${item.name} ${formatPercent(item.percent)}`,
      kind: 'shareholder',
      percent: item.percent,
      shareholderType: item.type,
    }));

    if (scopeShareholderId) {
      const others = round.shareholders
        .filter((item) => item.shareholderId !== scopeShareholderId)
        .reduce((sum, item) => sum + item.percent, 0);

      if (others > 0) {
        children.push({
          id: `${round.id}:others`,
          label: `其他股东 ${formatPercent(others)}`,
          kind: 'shareholder',
          percent: round6(others),
          shareholderType: 'NEW_SHAREHOLDER',
        });
      }
    }

    return {
      id: `round-${round.id}`,
      label: `${round.name} · ${formatRoundDate(round.date)}`,
      kind: 'round',
      percent: null,
      children,
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

/**
 * 模拟新一轮融资后的稀释结果。
 * investorProtection 为 true 时，现有投资人保持原比例，仅创始人/新股东等非投资人按比例承担稀释。
 */
export function simulateDilution(
  rows: CapTableRow[],
  newInvestorPercent: number,
  investorProtection: boolean,
): SimulationResponse {
  if (!Number.isFinite(newInvestorPercent) || newInvestorPercent <= 0 || newInvestorPercent >= 100) {
    throw new Error('新一轮融资比例必须大于 0 且小于 100%');
  }

  const protectedRows = investorProtection
    ? rows.filter((row) => row.shareholderType === 'INVESTOR')
    : [];
  const protectedSum = protectedRows.reduce((sum, row) => sum + row.percent, 0);
  const remaining = round6(100 - newInvestorPercent - protectedSum);

  if (remaining < -0.000001) {
    throw new Error('投资人保护后剩余比例不足，无法完成该轮融资');
  }

  const unprotectedBase = round6(100 - protectedSum);
  const scale = unprotectedBase > 0 ? remaining / unprotectedBase : 0;
  const protectedIds = new Set(protectedRows.map((row) => row.shareholderId));

  const results: SimulationResult[] = rows.map((row) => {
    const isProtected = protectedIds.has(row.shareholderId);
    const after = round6(isProtected ? row.percent : row.percent * scale);

    return {
      shareholderId: row.shareholderId,
      name: row.shareholderName,
      type: row.shareholderType as ShareholderType,
      before: row.percent,
      after,
      delta: round6(after - row.percent),
      protectedByRound: isProtected,
    };
  });

  results.push({
    shareholderId: 'new-investor',
    name: '新一轮投资人',
    type: 'NEW_SHAREHOLDER',
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
