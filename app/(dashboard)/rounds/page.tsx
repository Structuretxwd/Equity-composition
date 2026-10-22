// 融资轮次页：展示每一轮融资与投资人保护状态
import { redirect } from 'next/navigation';
import { requirePageUser } from '@/lib/auth';
import { getRounds } from '@/lib/equity';
import { PERMISSIONS, hasPermission } from '@/lib/rbac';
import { RoundsView } from '@/components/RoundsView';

export const dynamic = 'force-dynamic';

export default async function RoundsPage() {
  const user = await requirePageUser();
  if (!hasPermission(user, PERMISSIONS.ROUNDS_READ)) redirect('/forbidden');

  const rounds = (await getRounds()).slice().reverse();
  return <RoundsView rounds={rounds} />;
}
