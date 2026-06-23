import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const indexPath = resolve(process.cwd(), 'dist/index.html');

if (!existsSync(indexPath)) {
  console.warn('[postbuild] dist/index.html não encontrado; nada para normalizar.');
  process.exit(0);
}

const normalizeRootAssetPaths = (html) => html
  .replace(/(src|href)=(['"])\.\/assets\//g, '$1=$2/assets/')
  .replace(/href=(['"])\.\/manifest\.webmanifest\1/g, 'href=$1/manifest.webmanifest$1')
  .replace(/navigator\.serviceWorker\.register\((['"])\.\/sw\.js\1/g, 'navigator.serviceWorker.register($1/sw.js$1')
  .replace(/scope:\s*(['"])\.\/\1/g, 'scope: $1/$1');

const html = readFileSync(indexPath, 'utf8');
const fixedHtml = normalizeRootAssetPaths(html);

if (fixedHtml !== html) {
  writeFileSync(indexPath, fixedHtml);
  console.log('[postbuild] Caminhos relativos de assets corrigidos para raiz (/assets, /sw.js, /manifest.webmanifest).');
}

const forbiddenPatterns = [
  /(?:src|href)=(['"])\.\/assets\//,
  /href=(['"])\.\/manifest\.webmanifest\1/,
  /navigator\.serviceWorker\.register\((['"])\.\/sw\.js\1/,
  /scope:\s*(['"])\.\/\1/,
];

const stillBroken = forbiddenPatterns.some((pattern) => pattern.test(readFileSync(indexPath, 'utf8')));
if (stillBroken) {
  console.error('[postbuild] ERRO: dist/index.html ainda contém caminhos relativos que quebram rotas profundas.');
  process.exit(1);
}

console.log('[postbuild] OK: dist/index.html usa caminhos absolutos para assets públicos.');
