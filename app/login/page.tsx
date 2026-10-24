// 登录页：账号 + 密码登录，角色由账号记录自动识别；支持在同一页面注册本地账号。
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Message } from '@arco-design/web-react';
import { IconLock, IconUser } from '@arco-design/web-react/icon';
import { DEMO_LOGIN_ENABLED, registerAccount, signIn } from '@/lib/auth';
import { getLandingPath } from '@/lib/rbac';
import { readSession } from '@/lib/session';
import { ThemeToggle } from '@/components/ThemeToggle';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const session = readSession();
    if (session) router.replace(getLandingPath(session.role));
  }, [router]);

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setPassword('');
    setConfirm('');
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;

    if (!username.trim()) {
      setError('请输入账号');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }
    if (mode === 'register' && password !== confirm) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const session =
        mode === 'login'
          ? await signIn(username, password)
          : await registerAccount({ username, password, displayName });
      Message.success(
        mode === 'login' ? `欢迎回来，${session.name}` : `账号已创建，欢迎，${session.name}`,
      );
      router.replace(getLandingPath(session.role));
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  function fillDemoAccount() {
    setMode('login');
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

        <div className="auth-tabs" role="tablist" aria-label="登录或注册">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`auth-tab${mode === 'login' ? ' is-active' : ''}`}
            onClick={() => switchMode('login')}
          >
            登录
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={`auth-tab${mode === 'register' ? ' is-active' : ''}`}
            onClick={() => switchMode('register')}
          >
            注册
          </button>
        </div>

        <h1 className="auth-title">{mode === 'login' ? '登录工作台' : '创建本地账号'}</h1>
        <p className="auth-sub">
          {mode === 'login'
            ? '输入账号与密码即可，系统会自动识别你的角色与数据范围。'
            : '新账号默认为只读合伙人，管理员可在控制台调整权限。'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-label" htmlFor="username">
            账号
          </label>
          <Input
            id="username"
            value={username}
            onChange={(value) => {
              setUsername(value);
              setError(null);
            }}
            placeholder="请输入账号"
            prefix={<IconUser />}
            size="large"
            allowClear
            autoComplete="username"
            autoFocus
          />

          {mode === 'register' && (
            <>
              <label className="auth-label" htmlFor="displayName">
                显示名称（可选）
              </label>
              <Input
                id="displayName"
                value={displayName}
                onChange={setDisplayName}
                placeholder="例如：李岚"
                size="large"
                maxLength={24}
                autoComplete="nickname"
              />
            </>
          )}

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
            placeholder={mode === 'login' ? '请输入密码' : '至少 6 位'}
            prefix={<IconLock />}
            size="large"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          {mode === 'register' && (
            <>
              <label className="auth-label" htmlFor="confirm">
                确认密码
              </label>
              <Input.Password
                id="confirm"
                value={confirm}
                onChange={(value) => {
                  setConfirm(value);
                  setError(null);
                }}
                placeholder="再次输入密码"
                prefix={<IconLock />}
                size="large"
                autoComplete="new-password"
              />
            </>
          )}

          {error && <div className="auth-error">{error}</div>}

          <Button type="primary" htmlType="submit" size="large" long loading={loading}>
            {mode === 'login' ? '登录' : '创建并登录'}
          </Button>
        </form>

        {mode === 'login' && DEMO_LOGIN_ENABLED && (
          <button type="button" className="auth-demo" onClick={fillDemoAccount}>
            <span>演示管理员</span>
            <code>admin / admin123</code>
            <span className="auth-demo-action">一键填入</span>
          </button>
        )}

        <p className="auth-note">
          账号与数据仅保存在当前浏览器。换设备或清理浏览器数据前，请在「数据管理」导出备份。
        </p>
      </section>
    </main>
  );
}
