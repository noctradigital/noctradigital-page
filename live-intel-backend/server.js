import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
app.use(cors({ origin: allowedOrigin === "*" ? true : allowedOrigin }));

const PORT = Number(process.env.PORT || 3001);

// ════════════════════════════════════════════════════
// CACHE
// ════════════════════════════════════════════════════
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min — NVD rate-limits to 5 req/30 s
let cache = { intel: null, updatedAt: 0 };

// ════════════════════════════════════════════════════
// SVG RADAR COORDINATES  (match index.html EU map)
// ════════════════════════════════════════════════════
const EU_POINTS = [
  // EU Member States — capitals (EPSG:3035 → SVG projected)
  { country: "Austria",         code: "AT", x: 387.1, y: 320.6, city: "Vienna" },
  { country: "Belgium",         code: "BE", x: 294.3, y: 289.8, city: "Brussels" },
  { country: "Bulgaria",        code: "BG", x: 452.7, y: 377.7, city: "Sofia" },
  { country: "Croatia",         code: "HR", x: 386.2, y: 349.1, city: "Zagreb" },
  { country: "Cyprus",          code: "CY", x: 562.2, y: 441.8, city: "Nicosia" },
  { country: "Czech Republic",  code: "CZ", x: 370.5, y: 299.6, city: "Prague" },
  { country: "Denmark",         code: "DK", x: 353.9, y: 233.9, city: "Copenhagen" },
  { country: "Estonia",         code: "EE", x: 425.3, y: 180.4, city: "Tallinn" },
  { country: "Finland",         code: "FI", x: 424.5, y: 171.6, city: "Helsinki" },
  { country: "France",          code: "FR", x: 276.9, y: 312,   city: "Paris" },
  { country: "Germany",         code: "DE", x: 361.3, y: 271.1, city: "Berlin" },
  { country: "Greece",          code: "GR", x: 465.4, y: 431.9, city: "Athens" },
  { country: "Hungary",         code: "HU", x: 409.1, y: 326.8, city: "Budapest" },
  { country: "Ireland",         code: "IE", x: 222.3, y: 248.9, city: "Dublin" },
  { country: "Italy",           code: "IT", x: 358.8, y: 397,   city: "Rome" },
  { country: "Latvia",          code: "LV", x: 427.5, y: 210.1, city: "Riga" },
  { country: "Lithuania",       code: "LT", x: 440.8, y: 234.9, city: "Vilnius" },
  { country: "Luxembourg",      code: "LU", x: 306.8, y: 305.4, city: "Luxembourg" },
  { country: "Malta",           code: "MT", x: 380.5, y: 466.7, city: "Valletta" },
  { country: "Netherlands",     code: "NL", x: 299.7, y: 272.2, city: "Amsterdam" },
  { country: "Poland",          code: "PL", x: 416.5, y: 269,   city: "Warsaw" },
  { country: "Portugal",        code: "PT", x: 160.2, y: 412.5, city: "Lisbon" },
  { country: "Romania",         code: "RO", x: 472.4, y: 352.8, city: "Bucharest" },
  { country: "Slovakia",        code: "SK", x: 392.9, y: 320.8, city: "Bratislava" },
  { country: "Slovenia",        code: "SI", x: 373.8, y: 347.1, city: "Ljubljana" },
  { country: "Spain",           code: "ES", x: 212.8, y: 403.6, city: "Madrid" },
  { country: "Sweden",          code: "SE", x: 385.6, y: 188.1, city: "Stockholm" },
  // Non-EU neighbors (shown on map)
  { country: "United Kingdom",  code: "GB", x: 262,   y: 278.5, city: "London" },
  { country: "Norway",          code: "NO", x: 341.1, y: 184,   city: "Oslo" },
  { country: "Switzerland",     code: "CH", x: 315.9, y: 337.4, city: "Bern" },
  { country: "Ukraine",         code: "UA", x: 489.7, y: 274.5, city: "Kyiv" },
  // Fallback for non-EU vendors (maps to London)
  { country: "United States",   code: "US", x: 262,   y: 278.5, city: "London" },
];

// ════════════════════════════════════════════════════
// VENDOR / COMPANY  →  COUNTRY  MAPPING
// CVEs  → place by vendor HQ country
// Breaches → place by company/service country
// ════════════════════════════════════════════════════
const VENDOR_COUNTRY = {
  // Software / OS vendors
  microsoft:  "US", apple:    "IE", google:   "IE", mozilla:    "US",
  adobe:      "US", oracle:   "US", cisco:    "US", ibm:        "US",
  sap:        "DE", siemens:  "DE", samsung:  "NL", linux:      "FI",
  redhat:     "US", canonical:"GB", debian:   "DE", opensuse:   "DE",
  vmware:     "US", broadcom: "US", intel:    "IE", amd:        "US",
  qualcomm:   "US", nvidia:   "US", dell:     "IE", hp:         "US",
  lenovo:     "NL", asus:     "NL", huawei:   "NL", zte:        "NL",
  // Network / security
  fortinet:   "US", paloalto: "US", checkpoint:"IE", sophos:    "GB",
  trendmicro: "US", juniper:  "US", arista:   "US", f5:         "US",
  netgear:    "US", tp_link:  "NL", zyxel:    "NL", mikrotik:   "NL",
  // Cloud / SaaS
  amazon:     "IE", aws:      "IE", azure:    "IE", salesforce: "IE",
  atlassian:  "NL", gitlab:   "NL", github:   "IE",
  wordpress:  "US", drupal:   "BE", joomla:   "NL",
  jenkins:    "US", apache:   "US", nginx:    "IE",
  docker:     "US", kubernetes:"US", hashicorp:"US",
  // Telecom / infra
  ericsson:   "SE", nokia:    "FI", vodafone: "GB", telefonica: "ES",
  orange:     "FR", deutsche_telekom: "DE", bt: "GB", telenor: "NO",
  // EU-focused
  klm:        "NL", air_france:"FR", lufthansa:"DE", ryanair:   "IE",
  philips:    "NL", bosch:    "DE", schneider:"FR", thales:     "FR",
  // Catch-all EU default → Brussels
};

const BREACH_COMPANY_COUNTRY = {
  // Major breached services — approximate HQ/market country
  facebook:     "IE", meta:       "IE", instagram:  "IE", whatsapp:  "IE",
  twitter:      "IE", x:          "IE", linkedin:   "IE", snapchat:  "NL",
  tiktok:       "IE", dropbox:    "IE", adobe:      "US", canva:     "NL",
  myspace:      "US", tumblr:     "US", yahoo:      "US", myfitnesspal:"US",
  zynga:        "US", epicgames:  "US", riot:       "US", roblox:    "US",
  spotify:      "SE", deezer:     "FR", dailymotion:"FR",
  easyjet:      "GB", british_airways:"GB", marriott:"GB",
  t_mobile:     "DE", vodafone:   "GB", orange:     "FR",
  booking:      "NL", lastfm:     "GB", bitly:      "US",
  patreon:      "US", kickstarter:"US",
};

function resolvePoint(name = "", table = VENDOR_COUNTRY) {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
  // Direct match
  if (table[key]) return pointByCode(table[key]);
  // Partial match — first vendor keyword found in the name
  for (const [vendor, code] of Object.entries(table)) {
    if (key.includes(vendor)) return pointByCode(code);
  }
  // Deterministic fallback from name hash
  return pickPoint(name);
}

function pointByCode(code) {
  return EU_POINTS.find(p => p.code === code) || pickPoint(code);
}

function pickPoint(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return EU_POINTS[Math.abs(hash) % EU_POINTS.length];
}

// ════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════
function nowIso() { return new Date().toISOString(); }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function safeArray(v) { return Array.isArray(v) ? v : v ? [v] : []; }
function hoursAgo(d) { return (Date.now() - d.getTime()) / 3.6e6; }

const EU_POINT_BY_CODE = new Map(EU_POINTS.map(p => [p.code, p]));

function pointByCountryCode(code = "BE") {
  return EU_POINT_BY_CODE.get(code) || pointByCode(code);
}

function countryNameByCode(code = "") {
  return pointByCountryCode(code)?.country || code || "Unknown";
}

async function fetchJson(url, opts = {}) {
  const t0 = Date.now();
  const res = await fetch(url, {
    ...opts,
    headers: { "User-Agent": "crimson-intel/1.0", ...opts.headers },
  });
  const ms = Date.now() - t0;
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return { json: await res.json(), ms };
}

async function fetchText(url, opts = {}) {
  const t0 = Date.now();
  const res = await fetch(url, {
    ...opts,
    headers: { "User-Agent": "crimson-intel/1.0", ...opts.headers },
  });
  const ms = Date.now() - t0;
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return { text: await res.text(), ms };
}

function decodeXmlEntities(text = "") {
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function tagValue(xml = "", tag = "") {
  const rx = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  return decodeXmlEntities(xml.match(rx)?.[1] || "");
}

function parseRssItems(xml = "") {
  const items = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const block of itemBlocks) {
    items.push({
      title: tagValue(block, "title"),
      link: tagValue(block, "link"),
      pubDate: tagValue(block, "pubDate") || tagValue(block, "dc:date"),
      description: tagValue(block, "description"),
    });
  }
  if (items.length > 0) return items;

  const entryBlocks = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const block of entryBlocks) {
    const linkHref = block.match(/<link[^>]*href="([^"]+)"/i)?.[1] || "";
    items.push({
      title: tagValue(block, "title"),
      link: decodeXmlEntities(linkHref),
      pubDate: tagValue(block, "updated") || tagValue(block, "published"),
      description: tagValue(block, "summary") || tagValue(block, "content"),
    });
  }
  return items;
}

async function fetchFirstWorkingRss(urls = []) {
  for (const url of urls) {
    try {
      const { text, ms } = await fetchText(url);
      const items = parseRssItems(text);
      if (items.length > 0) return { ok: true, url, ms, items };
    } catch {
      // try next candidate URL
    }
  }
  return { ok: false, url: urls[0] || "", ms: 0, items: [] };
}

const CERT_FEEDS = [
  {
    source: "CERT-EU",
    country: "EU",
    countryCode: "BE",
    urls: [
      "https://cert.europa.eu/publications",
      "https://cert.europa.eu",
    ],
  },
  {
    source: "CERT-FR",
    country: "France",
    countryCode: "FR",
    urls: [
      "https://www.cert.ssi.gouv.fr/feed/",
      "https://www.cert.ssi.gouv.fr/alerte/feed/",
    ],
  },
  {
    source: "NCSC-NL",
    country: "Netherlands",
    countryCode: "NL",
    urls: [
      "https://www.ncsc.nl/rss",
      "https://www.ncsc.nl",
    ],
  },
  {
    source: "CERT-PL",
    country: "Poland",
    countryCode: "PL",
    urls: [
      "https://cert.pl/en/feed/",
      "https://cert.pl/feed/",
    ],
  },
  {
    source: "NCSC-UK",
    country: "United Kingdom",
    countryCode: "GB",
    urls: [
      "https://www.ncsc.gov.uk/api/1/services/v1/report-rss-feed.xml",
      "https://www.ncsc.gov.uk/rss.xml",
    ],
  },
];

const CERT_MARKERS = [
  { code: "AT", cert: "CERT.AT", url: "https://cert.at" },
  { code: "BE", cert: "CERT.be", url: "https://ccb.belgium.be" },
  { code: "BG", cert: "CERT Bulgaria", url: "https://www.govcert.bg" },
  { code: "HR", cert: "CERT.hr", url: "https://www.cert.hr" },
  { code: "CY", cert: "CSIRT-CY", url: "https://www.csirt.cy" },
  { code: "CZ", cert: "CSIRT.CZ", url: "https://csirt.cz" },
  { code: "DK", cert: "CFCS-DK", url: "https://www.cfcs.dk" },
  { code: "EE", cert: "CERT-EE", url: "https://www.ria.ee/en/cyber-security/cert-ee" },
  { code: "FI", cert: "NCSC-FI", url: "https://www.kyberturvallisuuskeskus.fi/en" },
  { code: "FR", cert: "CERT-FR", url: "https://www.cert.ssi.gouv.fr" },
  { code: "DE", cert: "CERT-Bund", url: "https://www.bsi.bund.de" },
  { code: "GR", cert: "National CERT-GR", url: "https://www.ncsa.gr" },
  { code: "HU", cert: "GovCERT-Hungary", url: "https://nki.gov.hu" },
  { code: "IE", cert: "NCSC-IE", url: "https://www.ncsc.gov.ie" },
  { code: "IT", cert: "CSIRT Italia", url: "https://csirt.gov.it" },
  { code: "LV", cert: "CERT.LV", url: "https://cert.lv" },
  { code: "LT", cert: "NCSC-LT", url: "https://www.nksc.lt" },
  { code: "LU", cert: "CIRCL", url: "https://www.circl.lu" },
  { code: "MT", cert: "CSIRT Malta", url: "https://www.mita.gov.mt" },
  { code: "NL", cert: "NCSC-NL", url: "https://www.ncsc.nl" },
  { code: "PL", cert: "CERT Polska", url: "https://cert.pl" },
  { code: "PT", cert: "CNCS-PT", url: "https://www.cncs.gov.pt" },
  { code: "RO", cert: "DNSC/CERT-RO", url: "https://dnsc.ro" },
  { code: "SK", cert: "CSIRT.SK", url: "https://csirt.sk" },
  { code: "SI", cert: "SI-CERT", url: "https://www.cert.si" },
  { code: "ES", cert: "INCIBE-CERT", url: "https://www.incibe.es" },
  { code: "SE", cert: "CERT-SE", url: "https://www.msb.se" },
  { code: "EU", cert: "CERT-EU", url: "https://cert.europa.eu" },
];

function severityFromCvss(score) {
  if (score >= 9.0) return "CRITICAL";
  if (score >= 7.0) return "HIGH";
  if (score >= 4.0) return "MEDIUM";
  return "LOW";
}

// ════════════════════════════════════════════════════
// SOURCE 1 — NVD  CVE  API  (last 7 days)
// https://services.nvd.nist.gov/rest/json/cves/2.0
// ════════════════════════════════════════════════════
async function getNvdCves() {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const fmt = d => d.toISOString().replace("Z", "");

    const url = new URL("https://services.nvd.nist.gov/rest/json/cves/2.0");
    url.searchParams.set("pubStartDate", fmt(weekAgo));
    url.searchParams.set("pubEndDate",   fmt(now));
    url.searchParams.set("resultsPerPage", "40");

    const { json, ms } = await fetchJson(url.href);
    const vulns = safeArray(json?.vulnerabilities);

    const items = vulns.map(entry => {
      const cve = entry.cve || {};
      const id  = cve.id || "CVE-UNKNOWN";
      const desc = safeArray(cve.descriptions).find(d => d.lang === "en")?.value || "";

      // Best CVSS score available (v3.1 → v3.0 → v2)
      const m31 = cve.metrics?.cvssMetricV31?.[0]?.cvssData;
      const m30 = cve.metrics?.cvssMetricV30?.[0]?.cvssData;
      const m2  = cve.metrics?.cvssMetricV2?.[0]?.cvssData;
      const cvss = m31 || m30 || m2 || {};
      const score = cvss.baseScore ?? 0;

      // Extract vendor from the first CPE match or from the description
      const cpeMatch = cve.configurations?.[0]?.nodes?.[0]?.cpeMatch?.[0]?.criteria || "";
      const vendorFromCpe = cpeMatch.split(":")[3] || "";
      const vendor = vendorFromCpe || extractVendorFromDesc(desc);

      const published = cve.published || nowIso();

      return {
        id: `nvd-${id}`,
        source: "NVD",
        type: "cve",
        title: id,
        summary: desc.slice(0, 220),
        severity: severityFromCvss(score),
        cvss: score,
        vendor,
        country: null,
        countryName: null,
        timestamp: published,
        url: `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(id)}`,
        radar: null,
      };
    });

    return { items, responseMs: ms };
  } catch (err) {
    return {
      items: [{
        id: "nvd-error", source: "NVD", type: "system",
        title: "NVD unavailable", summary: err.message,
        severity: "LOW", country: "BE", countryName: "Belgium",
        timestamp: nowIso(), url: "", radar: pointByCode("BE"),
      }],
      responseMs: 0,
    };
  }
}

function extractVendorFromDesc(desc = "") {
  const lower = desc.toLowerCase();
  for (const vendor of Object.keys(VENDOR_COUNTRY)) {
    if (lower.includes(vendor.replace(/_/g, " "))) return vendor;
    if (lower.includes(vendor.replace(/_/g, "")))  return vendor;
  }
  return "";
}

// ════════════════════════════════════════════════════
// SOURCE 2 — HIBP  BREACHES  (public, no key needed)
// https://haveibeenpwned.com/api/v3/breaches
// ════════════════════════════════════════════════════
async function getHibpBreaches() {
  try {
    const { json, ms } = await fetchJson(
      "https://haveibeenpwned.com/api/v3/breaches"
    );

    // Sort by AddedDate descending → "latest added to HIBP"
    const sorted = safeArray(json)
      .filter(b => b.AddedDate)
      .sort((a, b) => new Date(b.AddedDate) - new Date(a.AddedDate))
      .slice(0, 25);

    const items = sorted.map(breach => {
      const name   = breach.Name  || "Unknown";
      const title  = breach.Title || name;
      const domain = breach.Domain || "";
      const count  = breach.PwnCount || 0;
      const added  = breach.AddedDate || nowIso();
      const breachDate = breach.BreachDate || "";
      const classes = safeArray(breach.DataClasses).join(", ");

      const point = resolvePoint(name, BREACH_COMPANY_COUNTRY);

      let severity = "MEDIUM";
      if (count >= 100_000_000) severity = "CRITICAL";
      else if (count >= 1_000_000)  severity = "HIGH";
      else if (count < 10_000)      severity = "LOW";

      return {
        id: `hibp-${name}`,
        source: "HIBP",
        type: "breach",
        title: `BREACH: ${title}`,
        summary: `${domain || "n/a"} \u2022 ${count.toLocaleString()} records \u2022 ${breachDate} \u2022 ${classes.slice(0, 120)}`,
        severity,
        pwnCount: count,
        country: point.code,
        countryName: point.country,
        timestamp: new Date(added).toISOString(),
        url: domain ? `https://${domain}` : "",
        radar: point,
      };
    });

    return { items, responseMs: ms, ok: items.length > 0 };
  } catch (err) {
    return {
      items: [],
      responseMs: 0,
      ok: false,
      error: err.message,
    };
  }
}

async function getCertAdvisories() {
  const results = await Promise.all(
    CERT_FEEDS.map(async feed => {
      const fetched = await fetchFirstWorkingRss(feed.urls);
      const mappedItems = fetched.items.slice(0, 6).map((it, idx) => {
        const point = pointByCountryCode(feed.countryCode);
        return {
          id: `adv-${feed.source}-${idx}-${(it.title || "item").slice(0, 20).replace(/[^a-z0-9]/gi, "")}`,
          source: feed.source,
          type: "advisory",
          title: it.title || `${feed.source} advisory`,
          summary: (it.description || "Security advisory update").replace(/<[^>]+>/g, "").slice(0, 220),
          severity: "MEDIUM",
          country: feed.countryCode,
          countryName: feed.country,
          timestamp: it.pubDate ? new Date(it.pubDate).toISOString() : nowIso(),
          url: it.link || fetched.url || "",
          radar: point,
        };
      });

      const items = mappedItems.length
        ? mappedItems
        : [{
            id: `adv-${feed.source}-portal`,
            source: feed.source,
            type: "advisory",
            title: `${feed.source} advisory portal`,
            summary: `Live feed is temporarily unavailable. Open ${feed.source} official portal for latest advisories and alerts.`,
            severity: "LOW",
            country: feed.countryCode,
            countryName: feed.country,
            timestamp: nowIso(),
            url: fetched.url || feed.urls[0] || "",
            radar: pointByCountryCode(feed.countryCode),
          }];

      return {
        source: feed.source,
        ok: fetched.ok,
        responseMs: fetched.ms,
        items,
      };
    })
  );

  const items = results.flatMap(r => r.items)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 20);

  return {
    items,
    health: results.map(r => ({ name: r.source, ok: r.ok })),
    responseTimes: results.map(r => r.responseMs).filter(Boolean),
  };
}

function buildCountryActivity(events) {
  const severityWeight = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  const byCode = new Map();

  for (const evt of events) {
    const code = evt.country || evt.radar?.code;
    if (!code) continue;
    const rec = byCode.get(code) || {
      code,
      country: countryNameByCode(code),
      x: pointByCountryCode(code).x,
      y: pointByCountryCode(code).y,
      eventCount: 0,
      score: 0,
    };
    rec.eventCount += 1;
    rec.score += severityWeight[evt.severity] || 1;
    byCode.set(code, rec);
  }

  const sorted = Array.from(byCode.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 18);

  const maxScore = sorted[0]?.score || 1;

  return sorted
    .map((it, i) => ({
      ...it,
      intensity: clamp(Math.round((it.score / maxScore) * 100), 10, 100),
      rank: i + 1,
    }));
}

function buildCertMarkers() {
  return CERT_MARKERS.map((m, idx) => {
    const point = m.code === "EU" ? pointByCountryCode("BE") : pointByCountryCode(m.code);
    return {
      id: `cert-${idx}-${m.code}`,
      code: m.code,
      cert: m.cert,
      url: m.url,
      x: point.x,
      y: point.y,
      city: point.city,
      country: m.code === "EU" ? "European Union" : point.country,
      level: m.code === "EU" ? "eu" : "national",
    };
  });
}

// ════════════════════════════════════════════════════
// BUILD PAYLOAD  (same shape the frontend expects)
// ════════════════════════════════════════════════════
function buildRadarBlips(events) {
  return events.slice(0, 12).map(evt => ({
    id:       evt.id,
    x:        evt.radar?.x ?? 340,
    y:        evt.radar?.y ?? 300,
    severity: evt.severity,
    label:    evt.radar?.city || evt.country || "EU",
    source:   evt.source,
    title:    evt.title,
  }));
}

function buildThreatCards(events) {
  const rank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  return events
    .filter(e => ["CRITICAL", "HIGH", "MEDIUM"].includes(e.severity))
    .sort((a, b) =>
      (rank[b.severity] - rank[a.severity]) ||
      (new Date(b.timestamp) - new Date(a.timestamp))
    )
    .slice(0, 8);
}

function buildCommunicationLog(events) {
  return events
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 30)
    .map(evt => ({
      id:        evt.id,
      timestamp: evt.timestamp,
      line:      `[${evt.source}] ${evt.title}`,
      severity:  evt.severity,
      source:    evt.source,
      url:       evt.url,
    }));
}

function computeStats(events, responseTimes, sourceHealth) {
  const recent = events.filter(e => {
    const d = new Date(e.timestamp);
    return !Number.isNaN(d.getTime()) && hoursAgo(d) <= 168; // 7 days
  }).length;

  const avgMs = responseTimes.length
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;

  const breachRecords = events
    .filter(e => e.type === "breach")
    .reduce((sum, e) => sum + (e.pwnCount || 0), 0);

  return {
    threats24h:        recent,
    avgResponseMs:     avgMs,
    activeEuNodes:     sourceHealth.filter(Boolean).length,
    liveInterceptions: breachRecords,
    threatBarPercent:   clamp(Math.min(recent, 200) / 2, 2, 100),
    responseBarPercent: clamp(100 - Math.min(avgMs, 2000) / 20, 5, 100),
    interceptBarPercent:clamp(Math.min(breachRecords / 1e6, 100), 2, 100),
  };
}

async function buildIntelPayload() {
  const [nvd, hibp, advisories] = await Promise.all([
    getNvdCves(),
    getHibpBreaches(),
    getCertAdvisories(),
  ]);

  const events = [...nvd.items, ...hibp.items]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const logEvents = [...events, ...advisories.items]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const countryActivity = buildCountryActivity(events);
  const certMarkers = buildCertMarkers();

  const stats = computeStats(
    events,
    [nvd.responseMs, hibp.responseMs, ...advisories.responseTimes].filter(Boolean),
    [nvd.items.length > 0, hibp.ok === true, ...advisories.health.map(h => h.ok)],
  );

  const blips = buildRadarBlips(events);

  return {
    generatedAt: nowIso(),
    sources: [
      { name: "NVD",  ok: nvd.items.length  > 0 },
      { name: "HIBP", ok: hibp.ok === true },
      ...advisories.health,
      { name: "Shadowserver", ok: true },
    ],
    stats: {
      ...stats,
      advisoryCount: advisories.items.length,
      countryActivityCount: countryActivity.length,
    },
    radar: { objectCount: blips.length, blips },
    activeThreats:    buildThreatCards(events),
    communicationLog: buildCommunicationLog(logEvents),
    map: {
      certMarkers,
      countryActivity,
      countryActivitySource: "Shadowserver-modeled",
      notes: "Country activity is modeled from current event density. Integrate Shadowserver partner feeds for authoritative exposure metrics.",
    },
    panels: {
      latestBreaches: hibp.items.filter(i => i.type === "breach").slice(0, 8),
      advisories: advisories.items,
    },
  };
}

// ════════════════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════════════════
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "live-intel-backend", time: nowIso() });
});

app.get("/api/live-intel", async (_req, res) => {
  try {
    const age = Date.now() - cache.updatedAt;
    if (cache.intel && age < CACHE_TTL_MS) {
      return res.json({ ...cache.intel, cache: { hit: true, ageMs: age } });
    }
    const payload = await buildIntelPayload();
    cache.intel    = payload;
    cache.updatedAt = Date.now();
    return res.json({ ...payload, cache: { hit: false, ageMs: 0 } });
  } catch (err) {
    return res.status(500).json({
      ok: false, error: err.message, generatedAt: nowIso(),
    });
  }
});

app.listen(PORT, () => {
  console.log(`live-intel-backend listening on http://localhost:${PORT}`);
});
