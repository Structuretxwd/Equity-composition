// 根布局：引入 Arco 样式、在 body 起始处恢复主题，并用 ConfigProvider 包裹应用
import type { Metadata } from 'next';
import '@arco-design/web-react/dist/css/arco.css';
import './globals.css';
import { Providers } from './providers';
import { ThemeScript } from '@/components/ThemeScript';

export const metadata: Metadata = {
  title: '股权管理系统',
  description: '面向创始团队与投资人的股权结构、融资轮次与稀释模拟管理平台',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeScript />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
