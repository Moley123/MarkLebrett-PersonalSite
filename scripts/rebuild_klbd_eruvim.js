/**
 * rebuild_klbd_eruvim.js
 *
 * Regenerates src/data/new_eruvim.js from "KLBD London Eruv.kml".
 *
 * This replaces extract_klbd_kml.js, which had two defects:
 *
 *   1. The folder "SJW / N Westminster & Camden S Hampstead" holds TWO eruvim,
 *      distinguished only by KML style colour (#9C27B0 = St John's Wood,
 *      #880E4F = South Hampstead). The old script ignored the colours and
 *      treated all 64 lines as one eruv, giving both the same boundary.
 *
 *   2. It built `containmentPath` by concatenating every point of every line
 *      in file order. Disconnected lines strung together are not a ring — the
 *      result was unclosed, self-intersecting, and ~2.5x the true area.
 *
 * What this script does instead:
 *
 *   - Splits the shared folder by style colour.
 *   - Chains each eruv's lines end-to-end into a real path.
 *   - Closes an open path using its NEIGHBOUR'S OWN COORDINATES. The KML
 *     stores each shared boundary once, in whichever folder owns it, so an
 *     eruv's line set is deliberately open where it abuts a neighbour.
 *     St John's Wood's two open ends are exact (0.0 m) matches on Brondesbury
 *     Park vertices, so the ring closes with nothing invented.
 *   - Verifies every output: closed, non-self-intersecting, plausible area,
 *     and not overlapping its neighbour. Throws rather than emit bad geometry.
 *
 * South Hampstead is deliberately NOT rebuilt here. Its two open ends are
 * 4,530 m apart and the coordinates needed to close it are absent from this
 * KML, so it is passed through unchanged from the existing data file.
 *
 *   node scripts/rebuild_klbd_eruvim.js
 */

const fs = require('fs');
const path = require('path');

const KML_PATH = path.join(__dirname, '..', 'KLBD London Eruv.kml');
const OUT_PATH = path.join(__dirname, '..', 'src', 'data', 'new_eruvim.js');

/* ═══════════════ KML parsing ═══════════════ */

const xml = fs.readFileSync(KML_PATH, 'utf8');
const decode = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim();

function parseCoords(text) {
  return text.trim().split(/\s+/).map((c) => {
    const [lng, lat] = c.split(',').map(Number);
    return { lat, lng };
  }).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

function folders() {
  const out = [];
  for (const m of xml.matchAll(/<Folder>([\s\S]*?)<\/Folder>/g)) {
    const nm = m[1].match(/<name>([\s\S]*?)<\/name>/);
    out.push({ name: nm ? decode(nm[1]) : '(unnamed)', content: m[1] });
  }
  return out;
}

function placemarks(content) {
  const out = [];
  for (const m of content.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)) {
    const pm = m[1];
    const nm = pm.match(/<name>([\s\S]*?)<\/name>/);
    const ls = pm.match(/<LineString>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
    const py = pm.match(/<Polygon>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
    const pt = pm.match(/<Point>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
    const st = pm.match(/<styleUrl>(.*?)<\/styleUrl>/);
    out.push({
      name: nm ? decode(nm[1]) : '',
      colour: st ? (st[1].match(/[a-z]+-([0-9A-Fa-f]{6})/) || [])[1] : undefined,
      line: ls ? parseCoords(ls[1]) : null,
      polygon: py ? parseCoords(py[1]) : null,
      point: pt ? parseCoords(pt[1])[0] : null,
    });
  }
  return out;
}

/* ═══════════════ geometry ═══════════════ */

const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;

function haversine(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const KEY = (p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
const planarDist = (a, b) => Math.hypot(a.lat - b.lat, a.lng - b.lng);

/** Join line segments end-to-end into the longest continuous path. */
function chainSegments(segments) {
  if (!segments || !segments.length) return { path: [], chains: 0, dropped: 0 };
  const remaining = segments.map((s) => [...s]);
  const chains = [];
  const TOL = 0.001; // ~100 m

  while (remaining.length) {
    let chain = [...remaining.shift()];
    let changed = true;
    while (changed && remaining.length) {
      changed = false;
      let bestIdx = -1;
      let bestDist = TOL;
      let mode = '';
      const head = chain[0];
      const tail = chain[chain.length - 1];
      for (let i = 0; i < remaining.length; i += 1) {
        const s = remaining[i];
        const sH = s[0];
        const sT = s[s.length - 1];
        const d = [planarDist(tail, sH), planarDist(tail, sT), planarDist(head, sT), planarDist(head, sH)];
        const m = Math.min(...d);
        if (m < bestDist) {
          bestDist = m;
          bestIdx = i;
          mode = ['th', 'tt', 'ht', 'hh'][d.indexOf(m)];
        }
      }
      if (bestIdx >= 0) {
        const s = remaining.splice(bestIdx, 1)[0];
        if (mode === 'th') { s.shift(); chain = chain.concat(s); }
        else if (mode === 'tt') { s.pop(); s.reverse(); chain = chain.concat(s); }
        else if (mode === 'ht') { s.pop(); chain = s.concat(chain); }
        else { s.shift(); s.reverse(); chain = s.concat(chain); }
        changed = true;
      }
    }
    chains.push(chain);
  }

  chains.sort((a, b) => b.length - a.length);
  return {
    path: chains[0],
    chains: chains.length,
    dropped: chains.slice(1).reduce((n, c) => n + c.length, 0),
  };
}

function ringArea(ring) {
  if (ring.length < 3) return 0;
  const lat0 = ring.reduce((s, p) => s + p.lat, 0) / ring.length;
  const kx = Math.cos(rad(lat0)) * R * Math.PI / 180;
  const ky = (R * Math.PI) / 180;
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j].lng * kx) * (ring[i].lat * ky) - (ring[i].lng * kx) * (ring[j].lat * ky);
  }
  return Math.abs(a / 2);
}

function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].lng; const yi = ring[i].lat;
    const xj = ring[j].lng; const yj = ring[j].lat;
    if ((yi > pt.lat) !== (yj > pt.lat)
      && pt.lng < ((xj - xi) * (pt.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function selfIntersections(ring) {
  const cross = (p1, p2, p3, p4) => {
    const d = (a, b, c) => (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
    const d1 = d(p3, p4, p1); const d2 = d(p3, p4, p2);
    const d3 = d(p1, p2, p3); const d4 = d(p1, p2, p4);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0))
      && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  };
  let n = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    for (let j = i + 2; j < ring.length - 1; j += 1) {
      if (i === 0 && j === ring.length - 2) continue;
      if (cross(ring[i], ring[i + 1], ring[j], ring[j + 1])) n += 1;
    }
  }
  return n;
}

const isClosed = (r) => r.length > 2 && KEY(r[0]) === KEY(r[r.length - 1]);

/**
 * Close an open path by walking a neighbour's ring between the two points
 * where the path's ends touch it. Both ends must be EXACT vertices of the
 * neighbour — otherwise we would be inventing a connection, and we refuse.
 */
function closeAgainstNeighbour(openPath, neighbourRing, label) {
  const idx = (p) => neighbourRing.findIndex((q) => KEY(q) === KEY(p));
  const a = idx(openPath[0]);
  const b = idx(openPath[openPath.length - 1]);
  if (a < 0 || b < 0) {
    throw new Error(
      `${label}: open ends are not exact vertices of the neighbour boundary `
      + `(start ${a < 0 ? 'MISSING' : a}, end ${b < 0 ? 'MISSING' : b}). `
      + 'Refusing to invent a connection.',
    );
  }

  // Two possible arcs between b and a. Take whichever yields the smaller
  // enclosed area — the larger one wraps the neighbour instead of abutting it.
  const forward = [];
  for (let i = b; i !== a; i = (i + 1) % neighbourRing.length) forward.push(neighbourRing[i]);
  forward.push(neighbourRing[a]);

  const backward = [];
  for (let i = b; i !== a; i = (i - 1 + neighbourRing.length) % neighbourRing.length) {
    backward.push(neighbourRing[i]);
  }
  backward.push(neighbourRing[a]);

  const build = (arc) => {
    const ring = [...openPath, ...arc.slice(1)];
    if (KEY(ring[ring.length - 1]) !== KEY(ring[0])) ring.push({ ...ring[0] });
    return ring;
  };
  const candidates = [build(forward), build(backward)]
    .sort((x, y) => ringArea(x) - ringArea(y));
  return candidates[0];
}

/* ═══════════════ build ═══════════════ */

const F = folders();
const folder = (n) => F.find((f) => f.name === n || f.name.startsWith(n));
const linesOf = (n, colour) => placemarks(folder(n).content)
  .filter((p) => p.line && (!colour || p.colour === colour))
  .map((p) => p.line);

const COLOURS = {
  brondesbury: '673AB7',
  stJohnsWood: '9C27B0',
  southHampstead: '880E4F',
  chigwell: 'CE93D8',
};

console.log('Reading KML…');

/* ── Brondesbury Park: self-closing, nothing to reconstruct ── */
const bpSegments = linesOf('Brondesbury Park');
const bpChain = chainSegments(bpSegments);
const bpRing = [...bpChain.path];
if (!isClosed(bpRing)) bpRing.push({ ...bpRing[0] });
console.log(`  Brondesbury Park : ${bpSegments.length} lines -> ${bpRing.length} pt ring `
  + `(${bpChain.chains} chain, ${bpChain.dropped} dropped)`);

/* ── St John's Wood: open where it abuts Brondesbury Park ── */
const sjwSegments = linesOf('SJW /', COLOURS.stJohnsWood);
const sjwChain = chainSegments(sjwSegments);
const sjwOpen = [...sjwChain.path];
if (isClosed(sjwOpen)) sjwOpen.pop();
const gap = haversine(sjwOpen[0], sjwOpen[sjwOpen.length - 1]);
console.log(`  St John's Wood   : ${sjwSegments.length} lines -> open path ${sjwOpen.length} pts, `
  + `${gap.toFixed(0)}m gap; closing against Brondesbury Park`);
const sjwRing = closeAgainstNeighbour(sjwOpen, bpRing, "St John's Wood");

/* ── Chigwell: a real KML polygon ── */
const chigwellPm = placemarks(folder('Chigwell Eruv').content).find((p) => p.polygon);
const chigwellRing = [...chigwellPm.polygon];
if (!isClosed(chigwellRing)) chigwellRing.push({ ...chigwellRing[0] });
console.log(`  Chigwell         : polygon, ${chigwellRing.length} pts`);

/* ── Labels ── */
const labels = {};
for (const f of F) {
  for (const pm of placemarks(f.content)) {
    if (pm.point && pm.name) labels[pm.name] = pm.point;
  }
}

/* ═══════════════ verify ═══════════════ */

console.log('\nVerifying…');
const checks = [];
function verify(name, ring, { minKm2, maxKm2 }) {
  const areaKm2 = ringArea(ring) / 1e6;
  const si = selfIntersections(ring);
  const closed = isClosed(ring);
  const ok = closed && si === 0 && areaKm2 >= minKm2 && areaKm2 <= maxKm2;
  console.log(`  ${name.padEnd(22)} closed=${closed ? 'yes' : 'NO'} selfInt=${si} `
    + `area=${areaKm2.toFixed(2)}km²  ${ok ? 'OK' : 'FAILED'}`);
  checks.push({ name, ok });
  return ok;
}

verify('Brondesbury Park', bpRing, { minKm2: 5, maxKm2: 25 });
verify("St John's Wood", sjwRing, { minKm2: 1, maxKm2: 10 });
verify('Chigwell', chigwellRing, { minKm2: 0.2, maxKm2: 10 });

// St John's Wood must abut Brondesbury Park, not sit inside it.
let shared = 0;
const G = 120;
const lats = sjwRing.map((p) => p.lat); const lngs = sjwRing.map((p) => p.lng);
for (let i = 0; i <= G; i += 1) {
  for (let j = 0; j <= G; j += 1) {
    const pt = {
      lat: Math.min(...lats) + (Math.max(...lats) - Math.min(...lats)) * (i / G),
      lng: Math.min(...lngs) + (Math.max(...lngs) - Math.min(...lngs)) * (j / G),
    };
    if (inRing(pt, sjwRing) && inRing(pt, bpRing)) shared += 1;
  }
}
const tiles = shared === 0;
console.log(`  ${'SJW vs BP overlap'.padEnd(22)} ${shared} shared samples  ${tiles ? 'OK (they tile)' : 'FAILED'}`);
checks.push({ name: 'SJW/BP tiling', ok: tiles });

if (checks.some((c) => !c.ok)) {
  console.error('\n[X] Verification failed — not writing output.');
  process.exit(1);
}

/* ═══════════════ emit ═══════════════ */

// South Hampstead cannot be closed from this KML (its two ends are 4,530 m
// apart with no connecting coordinates), so its existing entry is preserved
// verbatim rather than regenerated.
const existing = fs.readFileSync(OUT_PATH, 'utf8');
const shMatch = existing.match(/\{\s*"name":\s*"South Hampstead Eruv"[\s\S]*?\n\s{2}\}/);
if (!shMatch) {
  console.error('[X] Could not find the existing South Hampstead entry to preserve.');
  process.exit(1);
}

const eruvim = [
  {
    name: 'Brondesbury Park Eruv',
    color: '#673AB7',
    labelPosition: labels['Brondesbury Park Eruv'] || null,
    rawSegments: bpSegments,
    polygonPaths: [],
    containmentPath: bpRing,
  },
  {
    name: "St John's Wood Eruv",
    color: '#9C27B0',
    labelPosition: labels["St John's Wood Eruv"] || null,
    rawSegments: sjwSegments,
    polygonPaths: [],
    containmentPath: sjwRing,
  },
  {
    name: 'Chigwell Eruv',
    color: '#CE93D8',
    labelPosition: labels['Chigwell Eruv'] || null,
    rawSegments: [],
    polygonPaths: [chigwellRing],
    containmentPath: chigwellRing,
  },
];

const body = eruvim.map((e) => `  ${JSON.stringify(e, null, 2).split('\n').join('\n  ')}`).join(',\n');
const out = `// AUTO-GENERATED by scripts/rebuild_klbd_eruvim.js — do not edit by hand.
//
// Boundaries extracted from "KLBD London Eruv.kml". The shared folder
// "SJW / N Westminster & Camden S Hampstead" holds two eruvim distinguished
// only by style colour (#9C27B0 St John's Wood, #880E4F South Hampstead).
//
// St John's Wood's line set is deliberately open where it abuts Brondesbury
// Park — the KML stores each shared boundary once. Its ring is closed using
// Brondesbury Park's own coordinates; no geometry is invented.
//
// South Hampstead is NOT regenerated: its two open ends are 4,530 m apart and
// the coordinates that would close them are absent from the KML. Its entry
// below is preserved from the previous data and is known to be unreliable.

export const NEW_ERUVIM = [
${body},
${shMatch[0].replace(/^\s*/, '  ')}
];

export const ERUV_LABELS = ${JSON.stringify(labels, null, 2)};
`;

fs.writeFileSync(OUT_PATH, out);
console.log(`\n[OK] Wrote ${OUT_PATH} (${(out.length / 1024).toFixed(0)} KB)`);
eruvim.forEach((e) => console.log(`     ${e.name}: containment ${e.containmentPath.length} pts`));
console.log('     South Hampstead Eruv: preserved unchanged (cannot be closed from this KML)');
