// 深浅色切换：直接操作 document.body 的 arco-theme，并持久化到 localStorage。
'use client';

import { useEffect, useState } from 'react';
import { Button, Tooltip } from '@arco-design/web-react';
import { IconMoonFill, IconSunFill } from '@arco-design/web-react/icon';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setTheme(document.body.getAttribute('arco-theme') === 'dark' ? 'dark' : 'light');
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.style.colorScheme = next;
    if (next === 'dark') {
      document.body.setAttribute('arco-theme', 'dark');
    } else {
      document.body.removeAttribute('arco-theme');
    }
    try {
      localStorage.setItem('equity-theme', next);
    } catch {
      /* 忽略隐私模式写入失败 */
    }
  }

  return (
    <Tooltip content={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}>
      <Button
        type="text"
        shape="circle"
        onClick={toggleTheme}
        aria-label="切换主题"
        icon={theme === 'dark' ? <IconSunFill /> : <IconMoonFill />}
      />
    </Tooltip>
  );
}
