import { readFileSync } from 'fs';
const h = readFileSync('index.html', 'utf8');
const eu = h.indexOf('eu-countries');
const end = h.indexOf('</g>', eu);
const block = h.substring(eu, end);
const paths = (block.match(/id="c-/g) || []).length;
const eu22 = (block.match(/opacity="0\.22"/g) || []).length;
const n10 = (block.match(/opacity="0\.10"/g) || []).length;
console.log('Total paths:', paths, '| EU (0.22):', eu22, '| Neighbor (0.10):', n10);

// Check for GB (should be neighbor)
console.log('Has GB:', block.includes('c-GB'));
// Check for XK (Kosovo - should be neighbor if present)
console.log('Has XK:', block.includes('c-XK'));
