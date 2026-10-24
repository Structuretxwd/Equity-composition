// GitHub Pages 重建：通过 workflow_dispatch 触发仓库里的 deploy.yml。
// 仓库信息保存在 localStorage；访问令牌只保存在 sessionStorage，关闭标签页即失效。
export type DeployConfig = {
  owner: string;
  repo: string;
  workflow: string;
  ref: string;
};

const CONFIG_KEY = 'equity.deploy.config.v1';
const TOKEN_KEY = 'equity.deploy.token.v1';

const DEFAULT_CONFIG: DeployConfig = {
  owner: '',
  repo: '',
  workflow: 'deploy.yml',
  ref: 'main',
};

const KNOWN_ROUTES = new Set([
  'login',
  'cap-table',
  'rounds',
  'charts',
  'audit',
  'simulator',
  'data',
  'console',
]);

export function readDeployConfig(): DeployConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<DeployConfig>;
    return {
      owner: typeof parsed.owner === 'string' ? parsed.owner : '',
      repo: typeof parsed.repo === 'string' ? parsed.repo : '',
      workflow:
        typeof parsed.workflow === 'string' && parsed.workflow.trim()
          ? parsed.workflow
          : 'deploy.yml',
      ref: typeof parsed.ref === 'string' && parsed.ref.trim() ? parsed.ref : 'main',
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveDeployConfig(config: DeployConfig): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function readDeployToken(): string {
  if (typeof window === 'undefined') return '';
  return window.sessionStorage.getItem(TOKEN_KEY) ?? '';
}

export function saveDeployToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearDeployToken(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(TOKEN_KEY);
}

/** 从 *.github.io 地址推导 owner/repo，减少手填 */
export function deriveDeployTarget(): Partial<DeployConfig> | null {
  if (typeof window === 'undefined') return null;

  const host = window.location.hostname;
  if (!/\.github\.io$/i.test(host)) return null;

  const owner = host.replace(/\.github\.io$/i, '');
  const first = window.location.pathname.split('/').filter(Boolean)[0] ?? '';
  const repo = first && !KNOWN_ROUTES.has(first) ? first : `${owner}.github.io`;

  return { owner, repo };
}

export function actionsUrl(config: DeployConfig): string {
  return `https://github.com/${config.owner}/${config.repo}/actions/workflows/${encodeURIComponent(
    config.workflow,
  )}`;
}

export async function triggerDeploy(config: DeployConfig, token: string): Promise<void> {
  const owner = config.owner.trim();
  const repo = config.repo.trim();
  const workflow = config.workflow.trim();
  const ref = config.ref.trim() || 'main';

  if (!owner || !repo) throw new Error('请填写仓库 owner 与仓库名');
  if (!workflow) throw new Error('请填写 workflow 文件名');
  if (!token.trim()) throw new Error('请填写 GitHub 访问令牌');

  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
    repo,
  )}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token.trim()}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ ref }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const data = (await response.json()) as { message?: string };
      detail = data.message ?? '';
    } catch {
      /* 忽略非 JSON 响应 */
    }
    const hint = response.status === 403 ? '（令牌缺少 Actions 写权限）' : '';
    throw new Error(`触发失败：HTTP ${response.status}${hint}${detail ? ` · ${detail}` : ''}`);
  }
}
