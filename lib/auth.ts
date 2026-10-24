// 浏览器端认证：本地账号登录 + GitHub 管理员令牌登录。
// 会话写入 sessionStorage；这不是服务端可信会话，仅用于静态站点内的界面级访问控制。
import { DEMO_LOGIN_ENABLED, upsertGithubAdmin, verifyCredentials } from './accounts';
import { saveDeployToken } from './deploy';
import { verifyGitHubAdmin } from './github-auth';
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
 * 管理员 GitHub 登录：
 * 用 PAT 向 GitHub 验证用户名后，把该 GitHub 用户名绑定为本地管理员账号。
 * 令牌同时写入 sessionStorage，控制台的「立即重建」可直接复用。
 */
export async function signInWithGitHub(
  username: string,
  token: string,
): Promise<SessionUser> {
  const identity = await verifyGitHubAdmin(username, token);

  const { getDatabase } = await import('./db');
  const db = await getDatabase();
  const account = await upsertGithubAdmin(db, identity);

  const session = toSession(account);
  writeSession(session);
  saveDeployToken(token.trim());
  return session;
}
