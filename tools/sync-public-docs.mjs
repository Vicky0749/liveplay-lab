import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { marked } from 'marked';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'docs');
const target = resolve(root, 'public', 'docs');

if (!existsSync(source)) throw new Error('docs source directory is missing');
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true, force: true });

const htmlShell = (title, body) => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><style>
:root{font-family:"Noto Sans SC","Microsoft YaHei",system-ui,sans-serif;color:#192824;background:#eff3f0}*{box-sizing:border-box}body{margin:0}.document{max-width:980px;margin:32px auto 56px;padding:34px 44px;background:#fff;box-shadow:0 12px 32px #173c2920}h1{font-size:28px;color:#1e6f55;margin:0 0 20px;border-bottom:2px solid #b8dbc4;padding-bottom:12px}h2{font-size:19px;color:#1e6f55;margin:25px 0 8px}h3{font-size:15px;margin:18px 0 6px}p,li,td,th{font-size:13px;line-height:1.58}p{margin:4px 0 8px}ul,ol{margin:4px 0 9px;padding-left:23px}li{margin:2px 0}table{width:100%;border-collapse:collapse;margin:10px 0 15px}th,td{border:1px solid #cdd9d1;padding:6px 8px;text-align:left;vertical-align:top}th{background:#e8f3ec}code{font-family:Consolas,monospace;background:#edf2ef;padding:1px 4px;border-radius:3px;font-size:12px}pre{overflow:auto;padding:12px;background:#172825;color:#edf7f1;border-radius:5px;line-height:1.45}blockquote{margin:10px 0;padding:8px 12px;border-left:3px solid #e9b94f;background:#fff9e9;color:#634f29}@media(max-width:650px){.document{margin:0;padding:22px 17px;box-shadow:none}h1{font-size:23px}p,li,td,th{font-size:12px}table{display:block;overflow:auto;white-space:nowrap}}</style></head><body><article class="document">${body}</article></body></html>`;

for (const filename of readdirSync(source)) {
  if (!filename.endsWith('.md')) continue;
  const markdown = readFileSync(resolve(source, filename), 'utf8');
  const html = htmlShell(markdown.match(/^#\s+(.+)$/m)?.[1] || filename, marked.parse(markdown));
  writeFileSync(resolve(target, filename.replace(/\.md$/, '.html')), html, 'utf8');
}
console.log('Copied portfolio documents and generated UTF-8 HTML review pages');
