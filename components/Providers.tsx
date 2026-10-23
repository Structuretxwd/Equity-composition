// 客户端 Provider：统一 Arco 中文语言包与组件上下文。
'use client';

import { ConfigProvider } from '@arco-design/web-react';
import zhCN from '@arco-design/web-react/es/locale/zh-CN';

export function Providers({ children }: { children: React.ReactNode }) {
  return <ConfigProvider locale={zhCN}>{children}</ConfigProvider>;
}
