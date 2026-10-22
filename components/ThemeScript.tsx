// 首屏主题脚本：优先 localStorage，其次系统 prefers-color-scheme，避免主题闪烁
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('equity-theme');
    var theme = stored === 'dark' || stored === 'light'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (theme === 'dark') {
      document.body.setAttribute('arco-theme', 'dark');
    } else {
      document.body.removeAttribute('arco-theme');
    }
    document.documentElement.style.colorScheme = theme;
  } catch (error) {
    /* 忽略隐私模式下的 localStorage 异常 */
  }
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />;
}
