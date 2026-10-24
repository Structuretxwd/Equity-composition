// GitHub 管理员身份验证：纯静态站点没有 OAuth 回调，只能由用户手动提供 PAT。
// Deploy Key 是 SSH 部署密钥，只能用于 git push/pull，无法调用 GitHub API 验证身份。
const GITHUB_API = 'https://api.github.com';

/** GitHub Pages 的用户/项目站点，其主机名就是仓库所有者 */
export function getGitHubOwnerFromHost(): string | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  if (!/\.github\.io$/i.test(host)) return null;
  return host.replace(/\.github\.io$/i, '');
}

/** 允许登录的 GitHub 用户名：构建变量 + GitHub Pages 站点所有者 */
export function allowedGitHubLogins(): string[] {
  const values: string[] = [];

  const env = process.env.NEXT_PUBLIC_GITHUB_ADMIN ?? '';
  for (const part of env.split(/[,;\s]+/)) {
    if (part.trim()) values.push(part.trim());
  }

  const owner = getGitHubOwnerFromHost();
  if (owner) values.push(owner);

  return Array.from(new Set(values.map((value) => value.toLowerCase())));
}

export type GitHubIdentity = {
  login: string;
  name: string | null;
};

/**
 * 用 GitHub 用户名 + Personal Access Token 验证身份。
 * 令牌只用于查询 /user 和后续的 Actions 触发，不写入 localStorage。
 */
export async function verifyGitHubAdmin(
  username: string,
  token: string,
): Promise<GitHubIdentity> {
  const login = username.trim();
  const value = token.trim();

  if (!login) throw new Error('请输入 GitHub 用户名');
  if (!value) throw new Error('请输入 Personal Access Token');

  let response: Response;
  try {
    response = await fetch(`${GITHUB_API}/user`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${value}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  } catch {
    throw new Error('无法连接 GitHub，请检查网络后重试');
  }

  if (response.status === 401) throw new Error('令牌无效或已过期');
  if (!response.ok) throw new Error(`GitHub 验证失败：HTTP ${response.status}`);

  const data = (await response.json()) as { login?: string; name?: string | null };
  if (!data.login) throw new Error('GitHub 返回的用户信息不完整');

  if (data.login.toLowerCase() !== login.toLowerCase()) {
    throw new Error(`令牌属于 ${data.login}，与填写的用户名不一致`);
  }

  const allowed = allowedGitHubLogins();
  if (!allowed.includes(data.login.toLowerCase())) {
    throw new Error(
      '该 GitHub 用户不在管理员白名单。请设置 NEXT_PUBLIC_GITHUB_ADMIN，或在 GitHub Pages 站点上使用仓库所有者账号登录',
    );
  }

  return { login: data.login, name: data.name ?? null };
}
