/**
 * GitHub Pages 静态导出配置。
 *
 * 仓库名自动推导规则：
 * - 项目页（https://<user>.github.io/<repo>/）：basePath = /<repo>
 * - 用户/组织页（仓库名以 .github.io 结尾）：basePath = ''
 * - 本地开发或自定义域名：可通过 NEXT_PUBLIC_BASE_PATH 显式覆盖
 *
 * 注意：GitHub Actions 会自动注入 GITHUB_REPOSITORY（owner/repo），
 * 因此推送后无需手动修改仓库名。
 */
const repoName = (process.env.GITHUB_REPOSITORY ?? '').split('/')[1] ?? '';
const isUserSite = /\.github\.io$/i.test(repoName);

function normalizeBasePath(value) {
  if (!value || value === '/') return '';
  return `/${value.replace(/^\/+|\/+$/g, '')}`;
}

const basePath = normalizeBasePath(
  process.env.NEXT_PUBLIC_BASE_PATH ??
    (repoName && !isUserSite ? `/${repoName}` : ''),
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静态导出：构建产物直接输出到 out/，不含任何 Node 服务端代码
  output: 'export',
  // GitHub Pages 对 /cap-table 这类目录路由更友好
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath,
  assetPrefix: basePath || undefined,
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    // 供客户端拼接 sql-wasm.wasm 等 public 资源地址
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

module.exports = nextConfig;
