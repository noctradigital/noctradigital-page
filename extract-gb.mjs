// extract-gb.mjs — Generate SVG path for GB from the GISCO GeoJSON
import { readFileSync } from 'fs';

const GEOJSON_PATH = './CNTR_RG_20M_2024_3035.geojson';
const XLIM = [2377294, 7453440];
const YLIM = [1313597, 5628510];
const SVG_W = 800, SVG_H = 500;
const xRange = XLIM[1] - XLIM[0];
const yRange = YLIM[1] - YLIM[0];
const scale = Math.min((SVG_W * 0.92) / xRange, (SVG_H * 0.92) / yRange);
const xCenter = (XLIM[0] + XLIM[1]) / 2;
const yCenter = (YLIM[0] + YLIM[1]) / 2;

function toSVG(ex, ey) {
  return [
    Math.round(((ex - xCenter) * scale + SVG_W / 2) * 10) / 10,
    Math.round(((yCenter - ey) * scale + SVG_H / 2) * 10) / 10,
  ];
}

const MIN_DIST = 1.8;
function simplify(pts) {
  if (pts.length < 4) return pts;
  const res = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [lx, ly] = res[res.length - 1];
    const dx = pts[i][0] - lx, dy = pts[i][1] - ly;
    if (dx * dx + dy * dy >= MIN_DIST * MIN_DIST) res.push(pts[i]);
  }
  res.push(pts[pts.length - 1]);
  return res;
}

function ringToD(ring) {
  const svgPts = ring.map(c => toSVG(c[0], c[1]));
  const vis = svgPts.some(p => p[0] >= -80 && p[0] <= SVG_W + 80 && p[1] >= -80 && p[1] <= SVG_H + 80);
  if (!vis) return '';
  const s = simplify(svgPts);
  if (s.length < 3) return '';
  return 'M' + s.map(p => `${p[0]},${p[1]}`).join('L') + 'Z';
}

const data = JSON.parse(readFileSync(GEOJSON_PATH, 'utf8'));
const gb = data.features.find(f => f.properties.CNTR_ID === 'UK');
if (!gb) { console.error('GB not found!'); process.exit(1); }

console.error('Found GB:', gb.properties.NAME_ENGL, 'EU_STAT:', gb.properties.EU_STAT);

const geom = gb.geometry;
const rings = geom.type === 'Polygon' ? geom.coordinates : geom.coordinates.flat(1);
const parts = [];
for (const ring of rings) {
  const d = ringToD(ring);
  if (d) parts.push(d);
}

if (parts.length) {
  const pathD = parts.join(' ');
  console.log(`                  <path id="c-GB" d="${pathD}" opacity="0.15"/><!-- United Kingdom -->`);
  console.error(`Generated ${pathD.length} chars, ${parts.length} sub-paths`);
} else {
  console.error('No visible paths generated for GB');
}
