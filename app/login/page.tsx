// 登录页：邮箱 + 密码登录，成功后按服务端返回的权限落地页跳转
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Form, Input, Message } from '@arco-design/web-react';
import { IconLock, IconSafe, IconUser } from '@arco-design/web-react/icon';
import { ThemeToggle } from '@/components/ThemeToggle';

type LoginValues = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(values: LoginValues) {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as {
        error?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? '登录失败，请稍后重试');
      }

      const next = new URLSearchParams(window.location.search).get('next');
      const target = next && next.startsWith('/') ? next : payload.redirectTo ?? '/cap-table';
      router.replace(target);
      router.refresh();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div style={{ position: 'absolute', top: 20, right: 24 }}>
        <ThemeToggle />
      </div>

      <div className="login-card">
        <div className="login-brand">
          <span className="app-logo-badge">股</span>
          <div>
            <div className="login-title">股权管理系统</div>
            <div className="muted" style={{ fontSize: 12 }}>
              Cap Table · Equity Management
            </div>
          </div>
        </div>

        <div style={{ height: 28 }} />

        <Form layout="vertical" onSubmit={(values) => void handleSubmit(values as LoginValues)}>
          <Form.Item
            label="邮箱"
            field="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input
              prefix={<IconUser />}
              placeholder="you@company.com"
              size="large"
              allowClear
            />
          </Form.Item>

          <Form.Item
            label="密码"
            field="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<IconLock />}
              placeholder="请输入密码"
              size="large"
            />
          </Form.Item>

          <Button type="primary" htmlType="submit" long size="large" loading={loading}>
            登录
          </Button>
        </Form>

        <div
          className="muted"
          style={{ marginTop: 20, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <IconSafe />
          仅授权人员可访问，所有股权变更均记录审计日志
        </div>
      </div>
    </div>
  );
}
