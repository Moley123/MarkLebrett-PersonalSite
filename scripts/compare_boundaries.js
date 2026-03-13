/**
 * compare_boundaries.js
 * Deep comparison of existing eruv boundary data between KML and nwlondon_data.js
 */

const fs = require('fs');
const path = require('path');

const KML_PATH = path.join(__dirname, '..', 'KLBD London Eruv.kml');
const DATA_PATH = path.join(__dirname, '..', 'src', 'data', 'nwlondon_data.js');

const xml = fs.readFileSync(KML_PATH, 'utf8');

function parseCoordinates(coordStr) {
  return coordStr.trim().split(/\s+/).map(c => {
    const [lng, lat] = c.split(',').map(Number);
    return { lat, lng };
  }).filter(p => !isNaN(p.lat) && !isNaN(p.lng));
}

// Extract folders
const folderRe = /<Folder>([\s\S]*?)<\/Folder>/g;
const folders = [];
let fm;
while ((fm = folderRe.exec(xml)) !== null) {
  const content = fm[1];
  const nameMatch = content.match(/<name>(.*?)<\/name>/);
  let name = nameMatch ? nameMatch[1] : '';
  name = name.replace(/<!\[CDATA\[(.*?)\]\]>/, '$1');
  folders.push({ name, content });
}

function extractLines(content) {
  const lines = [];
  const re = /<Placemark>([\s\S]*?)<\/Placemark>/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const pm = m[1];
    const lineMatch = pm.match(/<LineString>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
    if (lineMatch) lines.push(parseCoordinates(lineMatch[1]));
  }
  return lines;
}

function extractPolygons(content) {
  const polys = [];
  const re = /<Placemark>([\s\S]*?)<\/Placemark>/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const pm = m[1];
    const polyMatch = pm.match(/<Polygon>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
    if (polyMatch) polys.push(parseCoordinates(polyMatch[1]));
  }
  return polys;
}

// Read current data
const src = fs.readFileSync(DATA_PATH, 'utf8');
const eruvimStart = src.indexOf('export const NWLONDON_ERUVIM = [');
let depth = 0, eruvimEnd = -1;
for (let i = eruvimStart + 'export const NWLONDON_ERUVIM = '.length; i < src.length; i++) {
  if (src[i] === '[') depth++;
  if (src[i] === ']') depth--;
  if (depth === 0) { eruvimEnd = i + 1; break; }
}
const eruvimData = JSON.parse(src.substring(eruvimStart + 'export const NWLONDON_ERUVIM = '.length, eruvimEnd));

function getBBox(points) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  points.forEach(p => {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  });
  return { minLat, maxLat, minLng, maxLng };
}

function roundPt(p) { return `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`; }

// Compare each existing eruv
const comparisons = [
  { kmlFolder: 'Woodside Park Eruv', dataName: 'Woodside Park Eruv' },
  { kmlFolder: 'NW London Eruv', dataName: 'NW London Eruv' },
  { kmlFolder: 'Mill Hill', dataName: 'Mill Hill' },
  { kmlFolder: 'Pinner Eruv', dataName: 'Pinner Eruv' },
];

console.log('═══════════════════════════════════════════════════════');
console.log(' DETAILED BOUNDARY COMPARISON: KML vs Current Data');
console.log('═══════════════════════════════════════════════════════\n');

comparisons.forEach(({ kmlFolder, dataName }) => {
  const folder = folders.find(f => f.name === kmlFolder);
  if (!folder) { console.log(`  ❌ KML folder "${kmlFolder}" not found!\n`); return; }
  
  const kmlLines = extractLines(folder.content);
  const kmlPolys = extractPolygons(folder.content);
  
  const dataEntry = eruvimData.find(e => e.name === dataName);
  if (!dataEntry) { console.log(`  ❌ Data entry "${dataName}" not found!\n`); return; }
  
  // Flatten all KML points
  const kmlAllPts = [];
  kmlLines.forEach(l => l.forEach(p => kmlAllPts.push(p)));
  kmlPolys.forEach(p => p.forEach(pt => kmlAllPts.push(pt)));
  
  // Flatten all data points
  const dataAllPts = [];
  (dataEntry.rawSegments || []).forEach(s => s.forEach(p => dataAllPts.push(p)));
  (dataEntry.polygonPaths || []).forEach(p => p.forEach(pt => dataAllPts.push(pt)));
  (dataEntry.containmentPath || []).forEach(p => dataAllPts.push(p));

  // Unique points (rounded to 5 decimal places)
  const kmlSet = new Set(kmlAllPts.map(roundPt));
  const dataSet = new Set(dataAllPts.map(roundPt));
  
  // Points in KML but not in data
  const inKmlOnly = [...kmlSet].filter(p => !dataSet.has(p));
  // Points in data but not in KML
  const inDataOnly = [...dataSet].filter(p => !kmlSet.has(p));
  // Shared
  const shared = [...kmlSet].filter(p => dataSet.has(p));

  // BBox comparison
  const kmlBBox = kmlAllPts.length ? getBBox(kmlAllPts) : null;
  const dataBBox = dataAllPts.length ? getBBox(dataAllPts) : null;
  
  console.log(`── ${dataName} ──`);
  console.log(`  KML: ${kmlLines.length} segments, ${kmlPolys.length} polygons, ${kmlAllPts.length} total points, ${kmlSet.size} unique`);
  console.log(`  Data: ${(dataEntry.rawSegments||[]).length} segments, ${(dataEntry.polygonPaths||[]).length} polygons, ${dataAllPts.length} total points, ${dataSet.size} unique`);
  console.log(`  Shared unique points: ${shared.length}`);
  console.log(`  In KML only: ${inKmlOnly.length}`);
  console.log(`  In Data only: ${inDataOnly.length}`);
  
  if (kmlBBox && dataBBox) {
    const latDiff = Math.abs(kmlBBox.maxLat - dataBBox.maxLat) + Math.abs(kmlBBox.minLat - dataBBox.minLat);
    const lngDiff = Math.abs(kmlBBox.maxLng - dataBBox.maxLng) + Math.abs(kmlBBox.minLng - dataBBox.minLng);
    console.log(`  BBox overlap: lat diff=${latDiff.toFixed(6)}, lng diff=${lngDiff.toFixed(6)}`);
    if (latDiff < 0.001 && lngDiff < 0.001) console.log('  ✅ Boundaries match closely');
    else if (latDiff < 0.01 && lngDiff < 0.01) console.log('  ⚠️  Minor boundary differences');
    else console.log('  ❌ Significant boundary differences');
  }
  
  // Sample first KML point vs first data point
  if (kmlAllPts.length && dataAllPts.length) {
    console.log(`  KML first pt:  ${roundPt(kmlAllPts[0])}`);
    console.log(`  Data first pt: ${roundPt(dataAllPts[0])}`);
  }
  console.log();
});

// Special: Borehamwood/Bushey (KML has polygons, data has polygons)
console.log('── Borehamwood & Bushey ──');
const bbFolder = folders.find(f => f.name.includes('Borehamwood'));
if (bbFolder) {
  const kmlPolys = extractPolygons(bbFolder.content);
  const kmlLines = extractLines(bbFolder.content);
  console.log(`  KML: ${kmlLines.length} lines, ${kmlPolys.length} polygons`);
  
  ['Borehamwood Eruv', 'Bushey Eruv'].forEach(name => {
    const entry = eruvimData.find(e => e.name === name);
    if (!entry) { console.log(`  ❌ "${name}" not found`); return; }
    const dataPts = [];
    (entry.polygonPaths || []).forEach(p => p.forEach(pt => dataPts.push(pt)));
    (entry.containmentPath || []).forEach(p => dataPts.push(p));
    console.log(`  ${name}: ${(entry.rawSegments||[]).length} segs, ${(entry.polygonPaths||[]).length} polys, ${dataPts.length} total pts`);
    
    // Check if any KML polygon roughly matches
    kmlPolys.forEach((poly, i) => {
      const kmlSet = new Set(poly.map(roundPt));
      const dataSet = new Set(dataPts.map(roundPt));
      const shared = [...kmlSet].filter(p => dataSet.has(p));
      console.log(`    KML poly ${i} (${poly.length} pts): ${shared.length} shared with data`);
    });
  });
}
console.log();

// Edgware + Stanmore
console.log('── Edgware & Stanmore ──');
const ebsFolder = folders.find(f => f.name.includes('Edgware, Belmont'));
if (ebsFolder) {
  const kmlLines = extractLines(ebsFolder.content);
  const kmlPolys = extractPolygons(ebsFolder.content);
  console.log(`  KML: ${kmlLines.length} lines, ${kmlPolys.length} polygons`);
  
  ['Edgware Eruv Area', 'Stanmore Eruv'].forEach(name => {
    const entry = eruvimData.find(e => e.name === name);
    if (!entry) return;
    const dataPts = [];
    (entry.rawSegments || []).forEach(s => s.forEach(p => dataPts.push(p)));
    (entry.polygonPaths || []).forEach(p => p.forEach(pt => dataPts.push(pt)));
    (entry.containmentPath || []).forEach(p => dataPts.push(p));
    console.log(`  ${name}: ${(entry.rawSegments||[]).length} segs, ${(entry.polygonPaths||[]).length} polys, ${dataPts.length} total pts`);
  });
}

console.log('\n═══════════════════════════════════════════════════════');
console.log(' NOTE: The existing nwlondon_data.js was originally');
console.log(' generated from a DIFFERENT KML source (process_nwlondon_kml.js).');
console.log(' Differences likely reflect different source versions.');
console.log('═══════════════════════════════════════════════════════');
