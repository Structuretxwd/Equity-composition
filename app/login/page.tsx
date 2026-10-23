// 登录页：角色选择 + 本地密码哈希校验，成功后把会话写入 sessionStorage。
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Message } from '@arco-design/web-react';
import {
  IconCheckCircleFill,
  IconLock,
  IconSafe,
  IconStorage,
  IconUser,
  IconUserGroup,
} from '@arco-design/web-react/icon';
import { DEMO_MODE, DEMO_PASSWORDS, signIn } from '@/lib/auth';
import { getLandingPath, ROLE_DESCRIPTION, ROLE_LABEL, ROLES } from '@/lib/rbac';
import { readSession } from '@/lib/session';
import type { Role } from '@/lib/types';
import { ThemeToggle } from '@/components/ThemeToggle';

const ROLE_ICONS: Record<Role, React.ReactNode> = {
  ADMIN: <IconSafe />,
  PARTNER: <IconUserGroup />,
  INVESTOR: <IconUser />,
};

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('ADMIN');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const session = readSession();
    if (session) router.replace(getLandingPath(session.role));
  }, [router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!password) {
      setError('请输入密码');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const session = await signIn(role, password);
      Message.success(`欢迎回来，${session.name}`);
      router.replace(getLandingPath(session.role));
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  function selectRole(nextRole: Role) {
    setRole(nextRole);
    setPassword('');
    setError(null);
  }

  function fillDemoPassword() {
    setPassword(DEMO_PASSWORDS[role]);
    setError(null);
  }

  return (
    <main className="login-page">
      <div className="login-theme">
        <ThemeToggle />
      </div>

      <div className="login-shell">
        <section className="login-brand">
          <div className="login-brand-top">
            <span className="app-logo-badge login-logo">股</span>
            <div>
              <div className="login-brand-name">股权管理系统</div>
              <div className="login-brand-en">CAP TABLE · LOCAL FIRST</div>
            </div>
          </div>

          <div className="login-brand-copy">
            <div className="login-eyebrow">纯静态 · 浏览器数据库</div>
            <h1>
              把股权结构
              <br />
              装进浏览器。
            </h1>
            <p>
              股东名册、融资轮次、股权结构树与稀释模拟，全部在本地 SQLite 中完成。
              没有服务器，没有云端数据库，数据只属于当前浏览器。
            </p>
          </div>

          <div className="login-features">
            <div className="login-feature">
              <IconStorage />
              <span>sql.js + IndexedDB 自动持久化</span>
            </div>
            <div className="login-feature">
              <IconSafe />
              <span>RBAC 三角色隔离与写入二次校验</span>
            </div>
            <div className="login-feature">
              <IconCheckCircleFill />
              <span>支持 .sqlite 备份导出与跨设备迁移</span>
            </div>
          </div>

          <div className="login-brand-foot">
            GitHub Pages 静态托管 · 数据不离开浏览器
          </div>
        </section>

        <section className="login-card">
          <div className="login-card-head">
            <div>
              <h2>登录工作台</h2>
              <p>选择角色并输入对应密码</p>
            </div>
            <IconLock className="login-lock" />
          </div>

          <div className="role-grid">
            {ROLES.map((item) => (
              <button
                key={item}
                type="button"
                className={`role-card ${role === item ? 'active' : ''}`}
                onClick={() => selectRole(item)}
              >
                <span className="role-icon">{ROLE_ICONS[item]}</span>
                <span className="role-text">
                  <strong>{ROLE_LABEL[item]}</strong>
                  <small>{ROLE_DESCRIPTION[item]}</small>
                </span>
                {role === item && <IconCheckCircleFill className="role-check" />}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <label className="login-label" htmlFor="password">
              登录密码
            </label>
            <Input.Password
              id="password"
              value={password}
              onChange={setPassword}
              placeholder={`请输入${ROLE_LABEL[role]}密码`}
              allowClear
              size="large"
              autoComplete="current-password"
            />

            {error && <div className="login-error">{error}</div>}

            <Button
              type="primary"
              htmlType="submit"
              size="large"
              long
              loading={loading}
            >
              进入系统
            </Button>
          </form>

          {DEMO_MODE ? (
            <div className="demo-box">
              <div>
                <span className="demo-label">演示密码</span>
                <code>{DEMO_PASSWORDS[role]}</code>
              </div>
              <Button type="text" size="mini" onClick={fillDemoPassword}>
                一键填入
              </Button>
            </div>
          ) : (
            <p className="login-note">密码哈希由构建环境注入，演示提示已关闭。</p>
          )}

          <p className="login-note">
            会话仅保存在 sessionStorage，关闭标签页即失效。客户端权限用于防止误操作，
            不能抵御开发者工具篡改。
          </p>
        </section>
      </div>
    </main>
  );
}
