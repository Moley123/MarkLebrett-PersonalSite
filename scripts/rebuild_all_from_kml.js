/**
 * rebuild_all_from_kml.js
 * Rebuilds ALL eruv data from the KLBD KML, producing a complete nwlondon_data.js
 * 
 * KML Folder → Data mapping:
 *   "Woodside Park Eruv"             → Woodside Park Eruv (lines) + ALL label points
 *   "NW London Eruv"                 → NW London Eruv (lines)
 *   "Mill Hill"                       → Mill Hill (lines)
 *   "Crossing Points"                → CROSSING_POINTS (links)
 *   "Borehamwood / Bushey Eruv"      → Borehamwood Eruv + Bushey Eruv (polygons)
 *   "Pinner Eruv"                    → Pinner Eruv (lines)
 *   "Chigwell Eruv"                  → Chigwell Eruv (polygon)
 *   "Edgware, Belmont and Stanmore"  → Edgware Eruv Area + Stanmore Eruv + Belmont Eruv
 *   "Brondesbury Park"               → Brondesbury Park Eruv (lines)
 *   "SJW / N Westminster..."         → St John's Wood Eruv + South Hampstead Eruv (lines)
 */

const fs = require('fs');
const path = require('path');

const KML_PATH = path.join(__dirname, '..', 'KLBD London Eruv.kml');
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'nwlondon_data.js');

// Read old file just to grab CROSSING_POINTS (these aren't in KLBD KML the same way)
const oldSrc = fs.readFileSync(OUTPUT_PATH, 'utf8');
const crossStart = oldSrc.indexOf('export const CROSSING_POINTS = [');
let depth = 0, crossEnd = -1;
for (let i = crossStart + 'export const CROSSING_POINTS = '.length; i < oldSrc.length; i++) {
  if (oldSrc[i] === '[') depth++;
  if (oldSrc[i] === ']') depth--;
  if (depth === 0) { crossEnd = i + 1; break; }
}
const CROSSING_POINTS = JSON.parse(oldSrc.substring(crossStart + 'export const CROSSING_POINTS = '.length, crossEnd));

const xml = fs.readFileSync(KML_PATH, 'utf8');

// ── Helpers ──

function parseCoords(s) {
  return s.trim().split(/\s+/).map(c => {
    const [lng, lat] = c.split(',').map(Number);
    return { lat, lng };
  }).filter(p => !isNaN(p.lat) && !isNaN(p.lng));
}

function extractPlacemarks(content) {
  const pms = [];
  const re = /<Placemark>([\s\S]*?)<\/Placemark>/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const pm = m[1];
    const nm = pm.match(/<name>(.*?)<\/name>/);
    let name = nm ? nm[1].replace(/<!\[CDATA\[(.*?)\]\]>/, '$1') : '';
    const lineM = pm.match(/<LineString>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
    const polyM = pm.match(/<Polygon>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
    const ptM = pm.match(/<Point>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
    pms.push({
      name,
      line: lineM ? parseCoords(lineM[1]) : null,
      polygon: polyM ? parseCoords(polyM[1]) : null,
      point: ptM ? parseCoords(ptM[1])[0] : null,
    });
  }
  return pms;
}

// ── Extract folders ──

const folderRe = /<Folder>([\s\S]*?)<\/Folder>/g;
const folders = [];
let fm;
while ((fm = folderRe.exec(xml)) !== null) {
  const c = fm[1];
  const nm = c.match(/<name>(.*?)<\/name>/);
  let name = nm ? nm[1].replace(/<!\[CDATA\[(.*?)\]\]>/, '$1') : '';
  folders.push({ name, content: c });
}

function getFolder(search) {
  return folders.find(f => f.name.includes(search));
}

// ── Extract label positions ──

const labelFolder = folders[0]; // First folder has all labels
const labelPms = extractPlacemarks(labelFolder.content).filter(p => p.point && !p.name.startsWith('Line '));
const labels = {};
labelPms.forEach(lp => { labels[lp.name] = lp.point; });
console.log('Labels found:', Object.keys(labels).join(', '));

// ── Build each eruv ──

const allEruvim = [];

// Helper: extract lines from a folder
function linesFromFolder(folderName) {
  const f = getFolder(folderName);
  if (!f) { console.error(`Folder "${folderName}" not found!`); return []; }
  return extractPlacemarks(f.content).filter(p => p.line).map(p => p.line);
}

// Helper: build eruv from lines
function eruvFromLines(name, color, folderName, labelName) {
  const segs = linesFromFolder(folderName);
  const allPts = [];
  segs.forEach(s => s.forEach(p => allPts.push(p)));
  return {
    name, color,
    labelPosition: labels[labelName] || null,
    rawSegments: segs,
    polygonPaths: [],
    containmentPath: allPts,
  };
}

// 1. Edgware Eruv Area — from old data (polygon-based, not in KML as separate lines)
// The EBS folder has 28 line segments, but Edgware's polygon is in the old data
// Actually, let's check what the old Edgware looks like
const oldEruvimJson = oldSrc.substring(
  oldSrc.indexOf('export const NWLONDON_ERUVIM = [') + 'export const NWLONDON_ERUVIM = '.length
);
depth = 0;
let oldEnd = -1;
for (let i = 0; i < oldEruvimJson.length; i++) {
  if (oldEruvimJson[i] === '[') depth++;
  if (oldEruvimJson[i] === ']') depth--;
  if (depth === 0) { oldEnd = i + 1; break; }
}
const oldEruvim = JSON.parse(oldEruvimJson.substring(0, oldEnd));
const oldEdgware = oldEruvim.find(e => e.name === 'Edgware Eruv Area');

// Edgware - keep from old data (its polygon boundary was from a different, original KML)
// but add label position
allEruvim.push({
  ...oldEdgware,
  labelPosition: labels['Edgware Eruv'] || null,
});

// 2. Woodside Park Eruv — from KML
allEruvim.push(eruvFromLines('Woodside Park Eruv', '#ff9800', 'Woodside Park Eruv', 'Woodside Park Eruv'));

// 3. NW London Eruv — from KML
allEruvim.push(eruvFromLines('NW London Eruv', '#4caf50', 'NW London Eruv', 'NW London Eruv'));

// 4. Mill Hill — from KML
allEruvim.push(eruvFromLines('Mill Hill', '#2196f3', 'Mill Hill', 'Mill Hill Eruv'));

// 5. Borehamwood — from KML (polygon)
const bbFolder = getFolder('Borehamwood');
const bbPms = extractPlacemarks(bbFolder.content);
const bbPolys = bbPms.filter(p => p.polygon);
// Assign polygons based on name or size
// "Borehamwood Eruv Boundary" is Borehamwood, "Bushey Eruv Map" is Bushey
const borehamPoly = bbPms.find(p => p.polygon && p.name.includes('Borehamwood'));
const busheyPoly = bbPms.find(p => p.polygon && p.name.includes('Bushey'));

allEruvim.push({
  name: 'Borehamwood Eruv',
  color: '#3f51b5',
  labelPosition: labels['Borehamwood Eruv'] || null,
  rawSegments: [],
  polygonPaths: borehamPoly ? [borehamPoly.polygon] : [],
  containmentPath: borehamPoly ? borehamPoly.polygon : [],
});

// 6. Bushey Eruv
allEruvim.push({
  name: 'Bushey Eruv',
  color: '#9c27b0',
  labelPosition: labels['Bushey Eruv'] || null,
  rawSegments: [],
  polygonPaths: busheyPoly ? [busheyPoly.polygon] : [],
  containmentPath: busheyPoly ? busheyPoly.polygon : [],
});

// 7. Stanmore Eruv — from EBS folder (lines near Stanmore label + old polygon)
const ebsFolder = getFolder('Edgware, Belmont and Stanmore');
const ebsPms = extractPlacemarks(ebsFolder.content);
const ebsLines = ebsPms.filter(p => p.line);
const ebsPoly = ebsPms.find(p => p.polygon);
const belmontLabel = labels['Belmont Eruv'];
const stanmoreLabel = labels['Stanmore Eruv'];

const stanmoreLines = [];
const belmontLines = [];
ebsLines.forEach(pm => {
  const seg = pm.line;
  const center = {
    lat: seg.reduce((a, p) => a + p.lat, 0) / seg.length,
    lng: seg.reduce((a, p) => a + p.lng, 0) / seg.length,
  };
  const dB = Math.hypot(center.lat - belmontLabel.lat, center.lng - belmontLabel.lng);
  const dS = Math.hypot(center.lat - stanmoreLabel.lat, center.lng - stanmoreLabel.lng);
  if (dB < dS) belmontLines.push(seg);
  else stanmoreLines.push(seg);
});

// Keep old Stanmore polygon but update with KML lines
const oldStanmore = oldEruvim.find(e => e.name === 'Stanmore Eruv');
const stanAllPts = [];
stanmoreLines.forEach(s => s.forEach(p => stanAllPts.push(p)));
if (oldStanmore?.polygonPaths?.[0]) oldStanmore.polygonPaths[0].forEach(p => stanAllPts.push(p));

allEruvim.push({
  name: 'Stanmore Eruv',
  color: '#795548',
  labelPosition: stanmoreLabel,
  rawSegments: stanmoreLines,
  polygonPaths: oldStanmore?.polygonPaths || [],
  containmentPath: stanAllPts,
});

// 8. Pinner Eruv — from KML (this was the one with biggest difference!)
allEruvim.push(eruvFromLines('Pinner Eruv', '#f44336', 'Pinner Eruv', 'Pinner Eruv'));

// 9. Belmont Eruv — separated from EBS
const belmontAllPts = [];
belmontLines.forEach(s => s.forEach(p => belmontAllPts.push(p)));
if (ebsPoly) ebsPoly.polygon.forEach(p => belmontAllPts.push(p));

allEruvim.push({
  name: 'Belmont Eruv',
  color: '#009688',
  labelPosition: belmontLabel,
  rawSegments: belmontLines,
  polygonPaths: ebsPoly ? [ebsPoly.polygon] : [],
  containmentPath: belmontAllPts,
});

// 10. Chigwell Eruv — from KML (polygon)
const chigFolder = getFolder('Chigwell');
const chigPms = extractPlacemarks(chigFolder.content);
const chigPoly = chigPms.find(p => p.polygon);

allEruvim.push({
  name: 'Chigwell Eruv',
  color: '#CE93D8',
  labelPosition: chigPms.find(p => p.point)?.point || null,
  rawSegments: [],
  polygonPaths: chigPoly ? [chigPoly.polygon] : [],
  containmentPath: chigPoly ? chigPoly.polygon : [],
});

// 11. Brondesbury Park Eruv — from KML
allEruvim.push(eruvFromLines('Brondesbury Park Eruv', '#3F5BA9', 'Brondesbury Park', 'Brondesbury Park Eruv'));

// 12 & 13. SJW + South Hampstead — from KML (shared segments)
const sjwFolder = getFolder('SJW');
const sjwPms = extractPlacemarks(sjwFolder.content).filter(p => p.line);
const sjwSegs = sjwPms.map(p => p.line);
const sjwAllPts = [];
sjwSegs.forEach(s => s.forEach(p => sjwAllPts.push(p)));

allEruvim.push({
  name: "St John's Wood Eruv",
  color: '#673AB7',
  labelPosition: labels["St John's Wood Eruv"] || null,
  rawSegments: sjwSegs,
  polygonPaths: [],
  containmentPath: sjwAllPts,
});

allEruvim.push({
  name: 'South Hampstead Eruv',
  color: '#C2185B',
  labelPosition: labels['South Hampstead Eruv'] || null,
  rawSegments: sjwSegs,
  polygonPaths: [],
  containmentPath: sjwAllPts,
});

// ══════════════════════════════════════
// Output
// ══════════════════════════════════════

console.log('\n=== Final Eiruvim ===');
allEruvim.forEach(e => {
  const segPts = e.rawSegments.reduce((a, s) => a + s.length, 0);
  const polyPts = e.polygonPaths.reduce((a, p) => a + p.length, 0);
  console.log(`  ${e.name} (${e.color}): ${e.rawSegments.length} segs(${segPts}pts), ${e.polygonPaths.length} polys(${polyPts}pts), contain:${e.containmentPath.length}`);
});

let output = '// AUTO-GENERATED from rebuild_all_from_kml.js — KLBD London Eruv KML\n';
output += 'export const NWLONDON_ERUVIM = ' + JSON.stringify(allEruvim, null, 2) + ';\n\n';
output += 'export const CROSSING_POINTS = ' + JSON.stringify(CROSSING_POINTS, null, 2) + ';\n';

fs.writeFileSync(OUTPUT_PATH, output, 'utf8');
console.log(`\nWritten to ${OUTPUT_PATH}`);
console.log(`File size: ${(output.length / 1024).toFixed(1)} KB`);
