// 浏览器端认证：SHA-256 密码哈希比对 + sessionStorage 会话。
// 哈希可在构建时通过 NEXT_PUBLIC_*_PASSWORD_HASH 注入；未注入时使用演示密码。
import { createSession, writeSession } from './session';
import type { Role, SessionUser } from './types';

const DEFAULT_PASSWORD_HASHES: Record<Role, string> = {
  ADMIN: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', // admin123
  PARTNER: 'd4e870198339c045e84f416cc6a1f15c30f010f68e14c637a9d35366f2e35ba6', // partner123
  INVESTOR: '4f841b0d8d0c53395802c1588be3b15c0f26336a019b93a98a03bce1ad693d8e', // investor123
};

const PASSWORD_HASHES: Record<Role, string> = {
  ADMIN: process.env.NEXT_PUBLIC_ADMIN_PASSWORD_HASH?.trim() || DEFAULT_PASSWORD_HASHES.ADMIN,
  PARTNER:
    process.env.NEXT_PUBLIC_PARTNER_PASSWORD_HASH?.trim() || DEFAULT_PASSWORD_HASHES.PARTNER,
  INVESTOR:
    process.env.NEXT_PUBLIC_INVESTOR_PASSWORD_HASH?.trim() || DEFAULT_PASSWORD_HASHES.INVESTOR,
};

const CUSTOM_HASH_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD_HASH ||
    process.env.NEXT_PUBLIC_PARTNER_PASSWORD_HASH ||
    process.env.NEXT_PUBLIC_INVESTOR_PASSWORD_HASH,
);

export const DEMO_MODE =
  process.env.NEXT_PUBLIC_DEMO_MODE === 'false' ? false : !CUSTOM_HASH_CONFIGURED;

export const DEMO_PASSWORDS: Record<Role, string> = {
  ADMIN: 'admin123',
  PARTNER: 'partner123',
  INVESTOR: 'investor123',
};

export type RoleAccount = {
  role: Role;
  name: string;
  shareholderId: string | null;
  shareholderName: string | null;
};

export const ROLE_ACCOUNTS: Record<Role, RoleAccount> = {
  ADMIN: {
    role: 'ADMIN',
    name: '系统管理员',
    shareholderId: null,
    shareholderName: null,
  },
  PARTNER: {
    role: 'PARTNER',
    name: '李岚',
    shareholderId: 'sh-founder-li',
    shareholderName: '李岚',
  },
  INVESTOR: {
    role: 'INVESTOR',
    name: '陈默',
    shareholderId: 'sh-investor-chen',
    shareholderName: '陈默',
  },
};

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** 校验角色密码；成功时写入 sessionStorage 并返回会话 */
export async function signIn(role: Role, password: string): Promise<SessionUser> {
  const hash = await sha256Hex(password);
  if (hash !== PASSWORD_HASHES[role]) {
    throw new Error('密码不正确，请重试');
  }

  const account = ROLE_ACCOUNTS[role];
  const session = createSession(account);
  writeSession(session);
  return session;
}
