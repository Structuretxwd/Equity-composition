// 监听 body 的 arco-theme 属性，供 Canvas 图表（G6）同步深浅色
'use client';

import { useEffect, useState } from 'react';

export function useArcoTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const readTheme = () => {
      setTheme(document.body.getAttribute('arco-theme') === 'dark' ? 'dark' : 'light');
    };

    readTheme();
    const observer = new MutationObserver(readTheme);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['arco-theme'],
    });

    return () => observer.disconnect();
  }, []);

  return theme;
}
