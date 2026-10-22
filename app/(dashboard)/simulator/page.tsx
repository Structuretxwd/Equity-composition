// 稀释模拟器页：页面级权限校验，非 ADMIN 直接跳转 403
import { redirect } from 'next/navigation';
import { requirePageUser } from '@/lib/auth';
import { PERMISSIONS, hasPermission } from '@/lib/rbac';
import { SimulatorPanel } from '@/components/SimulatorPanel';

export const dynamic = 'force-dynamic';

export default async function SimulatorPage() {
  const user = await requirePageUser();
  if (!hasPermission(user, PERMISSIONS.SIMULATOR_RUN)) redirect('/forbidden');

  return <SimulatorPanel />;
}
