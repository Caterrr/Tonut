import {readFileSync,writeFileSync} from 'node:fs';
const svg=readFileSync(new URL('../assets/tonut-donut.svg',import.meta.url),'utf8').trim();
writeFileSync(new URL('../src/donut.mjs',import.meta.url),'// Generated from assets/tonut-donut.svg; edit SVG then run npm run build:icon.\nexport const DONUT_SVG='+JSON.stringify(svg)+';\n');
