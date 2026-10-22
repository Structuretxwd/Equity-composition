// 根路由：按当前账号的权限集合跳转到对应首页
import { redirect } from 'next/navigation';
import { requirePageUser } from '@/lib/auth';
import { getLandingPath } from '@/lib/rbac';

export default async function HomePage() {
  const user = await requirePageUser();
  redirect(getLandingPath(user));
}
