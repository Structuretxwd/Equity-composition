// 可在客户端安全引用的格式化工具（不依赖 Prisma）
export const round6 = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export const formatPercent = (value: number) => `${round6(value).toFixed(2)}%`;

export function formatRoundDate(value: string | Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).format(new Date(value));
}
