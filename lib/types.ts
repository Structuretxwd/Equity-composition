// 领域类型定义：全部为浏览器端可安全使用的纯 TypeScript 类型

export type Role = 'ADMIN' | 'PARTNER' | 'INVESTOR';

export type ShareholderType = 'FOUNDER' | 'INVESTOR' | 'NEW_SHAREHOLDER';

export const SHAREHOLDER_TYPE_LABEL: Record<ShareholderType, string> = {
  FOUNDER: '创始人',
  INVESTOR: '投资人',
  NEW_SHAREHOLDER: '新股东',
};

export type Shareholder = {
  id: string;
  name: string;
  type: ShareholderType;
  initialShares: number;
  createdAt: string;
};

export type FundingRound = {
  id: string;
  name: string;
  date: string;
  totalDilutionPercent: number;
  investorProtection: boolean;
};

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

export type RoundSummary = FundingRound & {
  shareholders: Array<{
    shareholderId: string;
    name: string;
    percent: number;
    type: ShareholderType;
    dilutionApplied: boolean;
  }>;
};

export type AuditLogRow = {
  id: string;
  userId: string;
  action: string;
  entity: string;
  beforeJson: string | null;
  afterJson: string | null;
  timestamp: string;
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

export type SessionUser = {
  role: Role;
  name: string;
  shareholderId: string | null;
  shareholderName: string | null;
  accountId: string | null;
  username: string | null;
  token: string;
  issuedAt: number;
  expiresAt: number;
};

export type AccountRow = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  shareholderId: string | null;
  shareholderName: string | null;
  createdAt: string;
};

export type DatabaseStats = {
  shareholders: number;
  rounds: number;
  holdings: number;
  snapshots: number;
  auditLogs: number;
};
