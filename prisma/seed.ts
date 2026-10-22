// 种子数据：数据库驱动的 RBAC 角色、演示账号、三轮融资及对应快照
import { PrismaClient, ShareholderType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PERMISSIONS = [
  { key: 'cap_table:read', description: '查看全部股东名册' },
  { key: 'cap_table:read_own', description: '仅查看本人持股数据' },
  { key: 'cap_table:write', description: '编辑股东持股比例' },
  { key: 'rounds:read', description: '查看融资轮次' },
  { key: 'charts:read', description: '查看全量股权图表' },
  { key: 'charts:read_own', description: '仅查看本人股权图表' },
  { key: 'audit:read', description: '查看全部变更日志' },
  { key: 'audit:read_own', description: '仅查看与本人相关的变更日志' },
  { key: 'simulator:run', description: '运行股权稀释模拟' },
] as const;

const ROLE_DEFINITIONS = [
  {
    name: 'ADMIN',
    description: '管理员，拥有全部权限',
    permissions: PERMISSIONS.map((item) => item.key),
  },
  {
    name: 'PARTNER',
    description: '创始合伙人，可查看全部数据',
    permissions: ['cap_table:read', 'rounds:read', 'charts:read', 'audit:read'],
  },
  {
    name: 'INVESTOR',
    description: '投资人，仅可查看与自身相关的数据',
    permissions: ['cap_table:read_own', 'charts:read_own', 'audit:read_own'],
  },
] as const;

type Holder = {
  shareholderId: string;
  percent: number;
  type: ShareholderType;
  dilutionApplied: boolean;
};

const round6 = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

/** 按“新投资人占比 + 投资人保护”计算下一轮持股结构 */
function applyRound(
  previous: Holder[],
  newInvestorId: string,
  newInvestorPercent: number,
  protection: boolean,
): Holder[] {
  const protectedSum = protection
    ? previous
        .filter((holder) => holder.type === ShareholderType.INVESTOR)
        .reduce((sum, holder) => sum + holder.percent, 0)
    : 0;
  const unprotectedBase = 100 - protectedSum;
  const remaining = 100 - newInvestorPercent - protectedSum;

  if (unprotectedBase <= 0 || remaining < 0) {
    throw new Error('融资比例与投资人保护设置冲突，无法完成稀释计算');
  }

  const scale = remaining / unprotectedBase;
  const next = previous.map((holder) => {
    const isProtected = protection && holder.type === ShareholderType.INVESTOR;
    return {
      ...holder,
      percent: round6(isProtected ? holder.percent : holder.percent * scale),
      dilutionApplied: !isProtected,
    };
  });

  next.push({
    shareholderId: newInvestorId,
    percent: newInvestorPercent,
    type: ShareholderType.INVESTOR,
    dilutionApplied: false,
  });

  return next;
}

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'true') {
    throw new Error(
      '生产环境禁止执行破坏性 seed。如确认要初始化演示数据，请设置 ALLOW_SEED=true 后重试。',
    );
  }

  // 1. 权限与角色
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }

  const permissionRows = await prisma.permission.findMany();
  const permissionIdByKey = new Map(permissionRows.map((row) => [row.key, row.id]));
  const roleIdByName = new Map<string, string>();

  for (const definition of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { name: definition.name },
      update: { description: definition.description },
      create: { name: definition.name, description: definition.description },
    });
    roleIdByName.set(role.name, role.id);

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: definition.permissions.map((key) => {
        const permissionId = permissionIdByKey.get(key);
        if (!permissionId) throw new Error(`未注册的权限：${key}`);
        return { roleId: role.id, permissionId };
      }),
    });
  }

  // 2. 清理业务数据，保证种子脚本可重复执行
  await prisma.auditLog.deleteMany();
  await prisma.capTableSnapshot.deleteMany();
  await prisma.shareHolding.deleteMany();
  await prisma.fundingRound.deleteMany();
  await prisma.user.deleteMany();
  await prisma.shareholder.deleteMany();

  // 3. 股东与账号
  const zhangWei = await prisma.shareholder.create({
    data: { name: '张伟', type: ShareholderType.FOUNDER, initialShares: 5_500_000 },
  });
  const liNa = await prisma.shareholder.create({
    data: { name: '李娜', type: ShareholderType.FOUNDER, initialShares: 4_500_000 },
  });
  const angel = await prisma.shareholder.create({
    data: { name: '天使投资人', type: ShareholderType.INVESTOR, initialShares: 0 },
  });
  const redwood = await prisma.shareholder.create({
    data: { name: '红杉资本', type: ShareholderType.INVESTOR, initialShares: 0 },
  });
  const gaoling = await prisma.shareholder.create({
    data: { name: '高瓴资本', type: ShareholderType.INVESTOR, initialShares: 0 },
  });

  const [adminPasswordHash, partnerPasswordHash, investorPasswordHash] = await Promise.all([
    bcrypt.hash('Admin@12345', 12),
    bcrypt.hash('Partner@12345', 12),
    bcrypt.hash('Investor@12345', 12),
  ]);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@equity.local',
      name: '系统管理员',
      passwordHash: adminPasswordHash,
      roleId: roleIdByName.get('ADMIN')!,
    },
  });
  await prisma.user.create({
    data: {
      email: 'partner@equity.local',
      name: '张伟',
      passwordHash: partnerPasswordHash,
      roleId: roleIdByName.get('PARTNER')!,
      shareholderId: zhangWei.id,
    },
  });
  await prisma.user.create({
    data: {
      email: 'investor@equity.local',
      name: '红杉资本',
      passwordHash: investorPasswordHash,
      roleId: roleIdByName.get('INVESTOR')!,
      shareholderId: redwood.id,
    },
  });

  // 4. 三轮融资，逐轮计算持股快照
  const roundDefinitions = [
    {
      name: '天使轮',
      date: new Date('2023-06-30T00:00:00.000Z'),
      newInvestorPercent: 15,
      investorProtection: false,
      investorId: angel.id,
    },
    {
      name: 'A 轮',
      date: new Date('2024-09-15T00:00:00.000Z'),
      newInvestorPercent: 20,
      investorProtection: true,
      investorId: redwood.id,
    },
    {
      name: 'B 轮',
      date: new Date('2025-11-20T00:00:00.000Z'),
      newInvestorPercent: 10,
      investorProtection: true,
      investorId: gaoling.id,
    },
  ];

  let holders: Holder[] = [
    { shareholderId: zhangWei.id, percent: 55, type: ShareholderType.FOUNDER, dilutionApplied: false },
    { shareholderId: liNa.id, percent: 45, type: ShareholderType.FOUNDER, dilutionApplied: false },
  ];

  for (const definition of roundDefinitions) {
    const previous = holders;
    const previousPercentById = new Map(previous.map((holder) => [holder.shareholderId, holder.percent]));
    const next = applyRound(
      previous,
      definition.investorId,
      definition.newInvestorPercent,
      definition.investorProtection,
    );

    const round = await prisma.fundingRound.create({
      data: {
        name: definition.name,
        date: definition.date,
        totalDilutionPercent: definition.newInvestorPercent,
        investorProtection: definition.investorProtection,
      },
    });

    for (const holder of next) {
      await prisma.shareHolding.create({
        data: {
          shareholderId: holder.shareholderId,
          fundingRoundId: round.id,
          sharesPercent: holder.percent,
          dilutionApplied: holder.dilutionApplied,
        },
      });

      const snapshot = await prisma.capTableSnapshot.create({
        data: {
          roundId: round.id,
          shareholderId: holder.shareholderId,
          postRoundPercent: holder.percent,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: admin.id,
          action: 'SHARES_ADJUSTED',
          entity: 'CapTableSnapshot',
          entityId: snapshot.id,
          shareholderId: holder.shareholderId,
          beforeJson: { postRoundPercent: previousPercentById.get(holder.shareholderId) ?? 0 },
          afterJson: { postRoundPercent: holder.percent, round: definition.name },
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'ROUND_APPLIED',
        entity: 'FundingRound',
        entityId: round.id,
        beforeJson: { shareholderCount: previous.length },
        afterJson: {
          round: definition.name,
          shareholderCount: next.length,
          totalDilutionPercent: definition.newInvestorPercent,
          investorProtection: definition.investorProtection,
        },
      },
    });

    holders = next;
  }

  console.log('种子数据写入完成：');
  console.log('  ADMIN    admin@equity.local / Admin@12345');
  console.log('  PARTNER  partner@equity.local / Partner@12345');
  console.log('  INVESTOR investor@equity.local / Investor@12345');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
