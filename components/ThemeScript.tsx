// 首屏主题脚本：在 body 起始处同步设置 arco-theme，避免深浅色闪烁。
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('equity-theme');
    var theme = stored === 'dark' || stored === 'light'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    if (theme === 'dark') {
      document.body.setAttribute('arco-theme', 'dark');
    } else {
      document.body.removeAttribute('arco-theme');
    }
  } catch (error) {
    /* 隐私模式下忽略 localStorage 异常 */
  }
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />;
}
