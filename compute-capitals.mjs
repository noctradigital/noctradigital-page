// compute-capitals.mjs — Convert WGS84 capital coords → EPSG:3035 → SVG
// Uses exact same SVG projection params as generate-eu-map.mjs

// ── EPSG:3035 LAEA projection parameters ──
const LAT0 = 52 * Math.PI / 180;   // 52°N
const LON0 = 10 * Math.PI / 180;   // 10°E
const FE = 4321000;                 // False easting
const FN = 3210000;                 // False northing
const a = 6378137.0;                // GRS80 semi-major axis
const f = 1 / 298.257222101;        // GRS80 flattening
const e2 = 2 * f - f * f;           // eccentricity squared
const e = Math.sqrt(e2);

// Authalic sphere radius
function qsfn(sinphi) {
  const con = e * sinphi;
  return (1 - e2) * (sinphi / (1 - con * con) - (1 / (2 * e)) * Math.log((1 - con) / (1 + con)));
}
const qP = qsfn(1.0);
const Rq = a * Math.sqrt(qP / 2);

// Authalic latitude at origin
const q0 = qsfn(Math.sin(LAT0));
const beta0 = Math.asin(q0 / qP);
const D = a * Math.cos(LAT0) / (Math.sqrt(1 - e2 * Math.sin(LAT0) * Math.sin(LAT0)) * Rq * Math.cos(beta0));

function wgs84ToEpsg3035(lat, lon) {
  const phi = lat * Math.PI / 180;
  const lam = lon * Math.PI / 180;
  const q = qsfn(Math.sin(phi));
  const beta = Math.asin(q / qP);
  const B = Rq * Math.sqrt(2 / (1 + Math.sin(beta0) * Math.sin(beta) + Math.cos(beta0) * Math.cos(beta) * Math.cos(lam - LON0)));
  const x = FE + B * D * Math.cos(beta) * Math.sin(lam - LON0);
  const y = FN + (B / D) * (Math.cos(beta0) * Math.sin(beta) - Math.sin(beta0) * Math.cos(beta) * Math.cos(lam - LON0));
  return [x, y];
}

// ── SVG projection (same as generate-eu-map.mjs) ──
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

// ── All EU member state capitals (WGS84) ──
const CAPITALS = [
  // EU Members
  { country: "Austria",         code: "AT", city: "Vienna",     lat: 48.2082, lon: 16.3738 },
  { country: "Belgium",         code: "BE", city: "Brussels",   lat: 50.8503, lon:  4.3517 },
  { country: "Bulgaria",        code: "BG", city: "Sofia",      lat: 42.6977, lon: 23.3219 },
  { country: "Croatia",         code: "HR", city: "Zagreb",     lat: 45.8150, lon: 15.9819 },
  { country: "Cyprus",          code: "CY", city: "Nicosia",    lat: 35.1856, lon: 33.3823 },
  { country: "Czech Republic",  code: "CZ", city: "Prague",     lat: 50.0755, lon: 14.4378 },
  { country: "Denmark",         code: "DK", city: "Copenhagen", lat: 55.6761, lon: 12.5683 },
  { country: "Estonia",         code: "EE", city: "Tallinn",    lat: 59.4370, lon: 24.7536 },
  { country: "Finland",         code: "FI", city: "Helsinki",   lat: 60.1699, lon: 24.9384 },
  { country: "France",          code: "FR", city: "Paris",      lat: 48.8566, lon:  2.3522 },
  { country: "Germany",         code: "DE", city: "Berlin",     lat: 52.5200, lon: 13.4050 },
  { country: "Greece",          code: "GR", city: "Athens",     lat: 37.9838, lon: 23.7275 },
  { country: "Hungary",         code: "HU", city: "Budapest",   lat: 47.4979, lon: 19.0402 },
  { country: "Ireland",         code: "IE", city: "Dublin",     lat: 53.3498, lon: -6.2603 },
  { country: "Italy",           code: "IT", city: "Rome",       lat: 41.9028, lon: 12.4964 },
  { country: "Latvia",          code: "LV", city: "Riga",       lat: 56.9496, lon: 24.1052 },
  { country: "Lithuania",       code: "LT", city: "Vilnius",    lat: 54.6872, lon: 25.2797 },
  { country: "Luxembourg",      code: "LU", city: "Luxembourg", lat: 49.6116, lon:  6.1319 },
  { country: "Malta",           code: "MT", city: "Valletta",   lat: 35.8989, lon: 14.5146 },
  { country: "Netherlands",     code: "NL", city: "Amsterdam",  lat: 52.3676, lon:  4.9041 },
  { country: "Poland",          code: "PL", city: "Warsaw",     lat: 52.2297, lon: 21.0122 },
  { country: "Portugal",        code: "PT", city: "Lisbon",     lat: 38.7223, lon: -9.1393 },
  { country: "Romania",         code: "RO", city: "Bucharest",  lat: 44.4268, lon: 26.1025 },
  { country: "Slovakia",        code: "SK", city: "Bratislava", lat: 48.1486, lon: 17.1077 },
  { country: "Slovenia",        code: "SI", city: "Ljubljana",  lat: 46.0569, lon: 14.5058 },
  { country: "Spain",           code: "ES", city: "Madrid",     lat: 40.4168, lon: -3.7038 },
  { country: "Sweden",          code: "SE", city: "Stockholm",  lat: 59.3293, lon: 18.0686 },
  // Key non-EU countries (shown on map as neighbors)
  { country: "United Kingdom",  code: "GB", city: "London",     lat: 51.5074, lon: -0.1278 },
  { country: "Norway",          code: "NO", city: "Oslo",       lat: 59.9139, lon: 10.7522 },
  { country: "Switzerland",     code: "CH", city: "Bern",       lat: 46.9480, lon:  7.4474 },
  { country: "Ukraine",         code: "UA", city: "Kyiv",       lat: 50.4504, lon: 30.5234 },
];

console.log('// ──── EU Capital Cities — SVG Coordinates ────\n');
console.log('// For index.html SVG labels and server.js EU_POINTS\n');

// Output for server.js EU_POINTS
console.log('// ── server.js EU_POINTS ──');
console.log('const EU_POINTS = [');
for (const c of CAPITALS) {
  const [epsgX, epsgY] = wgs84ToEpsg3035(c.lat, c.lon);
  const [svgX, svgY] = toSVG(epsgX, epsgY);
  console.log(`  { country: "${c.country.padEnd(20)}", code: "${c.code}", x: ${svgX}, y: ${svgY}, city: "${c.city}" },`);
}
console.log('];');

// Output for SVG labels
console.log('\n// ── SVG dot markers + labels ──');
console.log('// <g class="eu-capital-dots">');
for (const c of CAPITALS) {
  const [epsgX, epsgY] = wgs84ToEpsg3035(c.lat, c.lon);
  const [svgX, svgY] = toSVG(epsgX, epsgY);
  const label = c.city.substring(0, 3).toUpperCase();
  console.log(`//   <circle cx="${svgX}" cy="${svgY}" r="2" fill="#ffb4a8" opacity="0.4"/>`);
  console.log(`//   <text x="${svgX + 5}" y="${svgY + 3}" font-size="6">${label}</text>`);
}
console.log('// </g>');
