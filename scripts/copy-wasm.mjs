// 构建前把 sql.js 的 WebAssembly 文件复制到 public/。
// 静态导出后该文件会出现在 out/sql-wasm.wasm，供浏览器通过 locateFile 加载。
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const targetDir = join(root, 'public');
const target = join(targetDir, 'sql-wasm.wasm');

if (!existsSync(source)) {
  console.error('[copy-wasm] 未找到 sql.js 的 wasm 文件，请先执行 npm install');
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
console.log('[copy-wasm] public/sql-wasm.wasm 已就绪');
