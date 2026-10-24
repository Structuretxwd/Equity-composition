// 浏览器端会话：sessionStorage 中的短期 token（关闭标签页即失效）。
// 这不是服务端可信会话，仅用于静态站点内的界面级访问控制。
import type { Role, SessionUser } from './types';

const SESSION_KEY = 'equity.session.v1';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export const SESSION_CHANGE_EVENT = 'equity:session-change';

function isRole(value: unknown): value is Role {
  return value === 'ADMIN' || value === 'PARTNER' || value === 'INVESTOR';
}

function createToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `token-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createSession(input: {
  role: Role;
  name: string;
  shareholderId: string | null;
  shareholderName: string | null;
  accountId: string | null;
  username: string | null;
}): SessionUser {
  const issuedAt = Date.now();
  return {
    ...input,
    token: createToken(),
    issuedAt,
    expiresAt: issuedAt + SESSION_TTL_MS,
  };
}

export function readSession(): SessionUser | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SessionUser>;
    if (
      !isRole(parsed.role) ||
      typeof parsed.token !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt <= Date.now()
    ) {
      window.sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    return {
      role: parsed.role,
      name: typeof parsed.name === 'string' ? parsed.name : parsed.role,
      shareholderId: typeof parsed.shareholderId === 'string' ? parsed.shareholderId : null,
      shareholderName:
        typeof parsed.shareholderName === 'string' ? parsed.shareholderName : null,
      accountId: typeof parsed.accountId === 'string' ? parsed.accountId : null,
      username: typeof parsed.username === 'string' ? parsed.username : null,
      token: parsed.token,
      issuedAt: typeof parsed.issuedAt === 'number' ? parsed.issuedAt : 0,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function writeSession(session: SessionUser): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}
