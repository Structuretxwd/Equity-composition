// 浏览器端认证：账号从本地 accounts 表读取，角色由账号记录自动识别。
// 会话写入 sessionStorage；这不是服务端可信会话，仅用于静态站点内的界面级访问控制。
import { createAccount, DEMO_LOGIN_ENABLED, verifyCredentials } from './accounts';
import { createSession, writeSession } from './session';
import type { SessionUser } from './types';

export { DEMO_LOGIN_ENABLED };

function toSession(account: {
  id: string;
  username: string;
  displayName: string;
  role: SessionUser['role'];
  shareholderId: string | null;
  shareholderName: string | null;
}): SessionUser {
  return createSession({
    accountId: account.id,
    username: account.username,
    role: account.role,
    name: account.displayName,
    shareholderId: account.shareholderId,
    shareholderName: account.shareholderName,
  });
}

/** 账号 + 密码登录；角色、姓名与关联股东全部由账号记录决定 */
export async function signIn(username: string, password: string): Promise<SessionUser> {
  if (!username.trim()) throw new Error('请输入账号');
  if (!password) throw new Error('请输入密码');

  const { getDatabase } = await import('./db');
  const db = await getDatabase();
  const account = await verifyCredentials(db, username, password);
  const session = toSession(account);
  writeSession(session);
  return session;
}

/**
 * 注册新账号。
 * 静态站点没有后台审核，新账号默认给“合伙人”只读权限，
 * 管理员可在控制台调整角色、绑定股东或重置密码。
 */
export async function registerAccount(input: {
  username: string;
  password: string;
  displayName?: string;
}): Promise<SessionUser> {
  const { getDatabase } = await import('./db');
  const db = await getDatabase();
  const account = await createAccount(db, {
    username: input.username,
    password: input.password,
    displayName: input.displayName,
    role: 'PARTNER',
  });
  const session = toSession(account);
  writeSession(session);
  return session;
}
