import { readFile, writeFile } from 'node:fs/promises';
const load = file => readFile(new URL(file, import.meta.url), 'utf8');
const [html, renderer, quota, demo] = await Promise.all([load('index.html'), load('../src/renderer.mjs'), load('../src/quota.mjs'), load('demo.mjs')]);
const code = [renderer.replace('export function', 'function'), quota.replace('export function', 'function'), demo.replace(/^import .+;\n/gm, '')].join('\n');
await writeFile(new URL('../preview.html', import.meta.url), html.replace('<script type="module" src="/demo.mjs"></script>', `<script type="module">\n${code}\n</script>`));
console.log('Built standalone preview.html (mock data only)');
