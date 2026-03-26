import { readFileSync, writeFileSync } from 'fs';

let html = readFileSync('index.html', 'utf8');
const output = readFileSync('eu-paths-output.txt', 'utf8');

// Extract new paths (between markers, paths only)
const beginM = '<!-- BEGIN GENERATED EU MAP PATHS -->';
const endM = '<!-- END GENERATED EU MAP PATHS -->';
const s = output.indexOf(beginM) + beginM.length;
const e = output.indexOf(endM);
const newPaths = output.substring(s, e).trim();

// Find old <g id="eu-countries" ...>...</g> and replace inner content
const gOpen = '<g id="eu-countries" fill="none" stroke="#ffb4a8" stroke-width="0.7">';
const gStart = html.indexOf(gOpen);
if (gStart === -1) { console.error('Could not find eu-countries group'); process.exit(1); }

// Find the closing </g> for this group
const afterOpen = gStart + gOpen.length;
const gEnd = html.indexOf('</g>', afterOpen);
if (gEnd === -1) { console.error('Could not find closing </g>'); process.exit(1); }

const before = html.substring(0, afterOpen);
const after = html.substring(gEnd);
const newHtml = before + '\n' + newPaths + '\n                ' + after;

writeFileSync('index.html', newHtml, 'utf8');
console.log('Done. Old length:', html.length, '→ New length:', newHtml.length);
