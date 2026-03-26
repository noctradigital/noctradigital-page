// generate-eu-map.mjs — Read local GISCO GeoJSON and generate SVG paths for EU-only radar
import { readFileSync } from 'fs';

// ── Local GeoJSON file (20M, EPSG:3035) ──
const GEOJSON_PATH = './CNTR_RG_20M_2024_3035.geojson';

// ── Europe clip bounds (EPSG:3035 meters, from giscoR vignette) ──
const XLIM = [2377294, 7453440];
const YLIM = [1313597, 5628510];

// ── SVG viewport ──
const SVG_W = 800, SVG_H = 500;

// ── Scale ──
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

// ── EU-only: filter by EU_STAT === "T" (following giscoR guidance) ──
// Plus a few non-EU neighbors for geographic context (faint background)
const EU_NEIGHBORS = new Set(['GB','NO','CH','IS','BA','RS','ME','MK','AL','XK','MD','UA','BY','TR','GE','LI']);

// ── Simplification ──
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

// ── Main ──
function main() {
  console.error(`Reading ${GEOJSON_PATH} ...`);
  const data = JSON.parse(readFileSync(GEOJSON_PATH, 'utf8'));
  console.error(`✓ Loaded ${data.features.length} features`);

  const paths = [];
  for (const f of data.features) {
    const id = f.properties.CNTR_ID;
    const isEU = f.properties.EU_STAT === 'T';
    const isNeighbor = EU_NEIGHBORS.has(id);
    if (!isEU && !isNeighbor) continue;
    const parts = [];
    const geom = f.geometry;
    const rings = geom.type === 'Polygon'
      ? geom.coordinates
      : geom.coordinates.flat(1); // MultiPolygon → array of rings
    for (const ring of rings) {
      const d = ringToD(ring);
      if (d) parts.push(d);
    }
    if (parts.length)
      paths.push({ id, name: f.properties.NAME_ENGL, isEU, d: parts.join(' ') });
  }

  // ── Output SVG paths ──
  console.log('<!-- BEGIN GENERATED EU MAP PATHS -->');
  for (const p of paths) {
    console.log(`                  <path id="c-${p.id}" d="${p.d}" opacity="${p.isEU ? '0.22' : '0.10'}"/><!-- ${p.name} -->`);
  }
  console.log('<!-- END GENERATED EU MAP PATHS -->');

  // ── City coordinates ──
  const CAPS = {
    FR: [3880000,2930000,'Paris'],      DE: [4550000,3290000,'Berlin'],
    PL: [5110000,3220000,'Warsaw'],     NL: [3970000,3210000,'Amsterdam'],
    ES: [3180000,2010000,'Madrid'],     IT: [4380000,2240000,'Rome'],
    GR: [5310000,1740000,'Athens'],     SE: [4770000,4260000,'Stockholm'],
    FI: [5490000,4280000,'Helsinki'],   DK: [4560000,3590000,'Copenhagen'],
    IE: [3310000,3240000,'Dublin'],     GB: [3505000,3090000,'London'],
    AT: [4750000,2790000,'Vienna'],     CZ: [4640000,3060000,'Prague'],
    CH: [4150000,2770000,'Zurich'],     BE: [3940000,3110000,'Brussels'],
    RO: [5510000,2530000,'Bucharest'],  NO: [4360000,4120000,'Oslo'],
    PT: [2770000,2030000,'Lisbon'],     UA: [6020000,3020000,'Kyiv'],
    DE2:[4320000,3010000,'Frankfurt'],  DE3:[4550000,2835000,'Munich'],
    IT2:[4240000,2510000,'Milan'],      BG: [5475000,2415000,'Sofia'],
  };
  console.log('\n// ──── SVG City coordinates ────');
  console.log('// For frontend EU labels & backend EU_POINTS');
  for (const [code, [ex, ey, city]] of Object.entries(CAPS)) {
    const [sx, sy] = toSVG(ex, ey);
    console.log(`//   ${code.replace(/\d/,'')} ${city}: x=${sx}, y=${sy}`);
  }

  const [rcx, rcy] = toSVG(4700000, 3100000);
  console.log(`\n// Radar center (Central Europe): x=${rcx}, y=${rcy}`);
  console.log(`// Scale: 1 SVG unit ≈ ${Math.round(1/scale)} meters`);
}

main();
