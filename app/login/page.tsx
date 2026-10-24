// 登录页：本地账号密码登录，或管理员使用 GitHub 用户名 + PAT 验证身份。
// 注册入口已关闭，新账号由管理员在控制台创建。
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Message } from '@arco-design/web-react';
import { IconGithub, IconLock, IconUser } from '@arco-design/web-react/icon';
import { DEMO_LOGIN_ENABLED, signIn, signInWithGitHub } from '@/lib/auth';
import { getLandingPath } from '@/lib/rbac';
import { readSession } from '@/lib/session';
import { ThemeToggle } from '@/components/ThemeToggle';

type Method = 'password' | 'github';

export default function LoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const session = readSession();
    if (session) router.replace(getLandingPath(session.role));
  }, [router]);

  function switchMethod(next: Method) {
    if (next === method) return;
    setMethod(next);
    setUsername('');
    setPassword('');
    setToken('');
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;

    if (!username.trim()) {
      setError(method === 'github' ? '请输入 GitHub 用户名' : '请输入账号');
      return;
    }
    if (method === 'password' && !password) {
      setError('请输入密码');
      return;
    }
    if (method === 'github' && !token.trim()) {
      setError('请输入 Personal Access Token');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const session =
        method === 'password'
          ? await signIn(username, password)
          : await signInWithGitHub(username, token);
      Message.success(`欢迎回来，${session.name}`);
      router.replace(getLandingPath(session.role));
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  function fillDemoAccount() {
    setUsername('admin');
    setPassword('admin123');
    setError(null);
  }

  return (
    <main className="auth-page">
      <div className="auth-theme">
        <ThemeToggle />
      </div>

      <section className="auth-card">
        <header className="auth-brand">
          <span className="app-logo-badge">股</span>
          <div className="auth-brand-text">
            <strong>股权管理系统</strong>
            <span>CAP TABLE · LOCAL FIRST</span>
          </div>
        </header>

        <h1 className="auth-title">
          {method === 'password' ? '登录工作台' : 'GitHub 管理员登录'}
        </h1>
        <p className="auth-sub">
          {method === 'password'
            ? '输入账号与密码即可，系统会自动识别你的角色与数据范围。'
            : '使用 GitHub 用户名与 Personal Access Token 验证管理员身份。'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-label" htmlFor="username">
            {method === 'password' ? '账号' : 'GitHub 用户名'}
          </label>
          <Input
            id="username"
            value={username}
            onChange={(value) => {
              setUsername(value);
              setError(null);
            }}
            placeholder={method === 'password' ? '请输入账号' : '例如 octocat'}
            prefix={method === 'password' ? <IconUser /> : <IconGithub />}
            size="large"
            allowClear
            autoComplete="username"
            autoFocus
          />

          {method === 'password' ? (
            <>
              <label className="auth-label" htmlFor="password">
                密码
              </label>
              <Input.Password
                id="password"
                value={password}
                onChange={(value) => {
                  setPassword(value);
                  setError(null);
                }}
                placeholder="请输入密码"
                prefix={<IconLock />}
                size="large"
                autoComplete="current-password"
              />
            </>
          ) : (
            <>
              <label className="auth-label" htmlFor="token">
                Personal Access Token
              </label>
              <Input.Password
                id="token"
                value={token}
                onChange={(value) => {
                  setToken(value);
                  setError(null);
                }}
                placeholder="ghp_… 或 github_pat_…"
                prefix={<IconLock />}
                size="large"
                autoComplete="off"
              />
              <p className="auth-hint">
                Deploy Key 只能用于 Git 推送，无法调用 GitHub API 登录。令牌仅保存在当前标签页，并可在控制台直接用于触发重建。
              </p>
            </>
          )}

          {error && <div className="auth-error">{error}</div>}

          <Button type="primary" htmlType="submit" size="large" long loading={loading}>
            {method === 'password' ? '登录' : '使用 GitHub 登录'}
          </Button>
        </form>

        {method === 'password' && DEMO_LOGIN_ENABLED && (
          <button type="button" className="auth-demo" onClick={fillDemoAccount}>
            <span>初始管理员</span>
            <code>admin / admin123</code>
            <span className="auth-demo-action">一键填入</span>
          </button>
        )}

        <p className="auth-note">注册已关闭。需要新账号，请让管理员在控制台创建。</p>

        <button
          type="button"
          className="auth-switch"
          onClick={() => switchMethod(method === 'password' ? 'github' : 'password')}
        >
          {method === 'password' ? '管理员使用 GitHub 登录' : '返回账号密码登录'}
        </button>
      </section>
    </main>
  );
}
