// 根布局：引入 Arco 样式与全局主题脚本，不包含任何服务端依赖。
import type { Metadata, Viewport } from 'next';
import '@arco-design/web-react/dist/css/arco.css';
import './globals.css';
import { Providers } from '@/components/Providers';
import { ThemeScript } from '@/components/ThemeScript';

export const metadata: Metadata = {
  title: '股权管理系统 · Cap Table',
  description:
    '纯静态股权管理系统：股东名册、融资轮次、结构可视化、稀释模拟与本地数据库备份。',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#165DFF',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeScript />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
