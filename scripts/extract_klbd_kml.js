/**
 * extract_klbd_kml.js
 * Parses "KLBD London Eruv.kml" and:
 * 1. Extracts boundary data for new eiruvim (Chigwell, Brondesbury Park, SJW, South Hampstead)
 * 2. Extracts label positions for ALL eiruvim
 * 3. Compares existing boundary data with KML data
 * 4. Outputs JS data ready to paste into nwlondon_data.js
 */

const fs = require('fs');
const path = require('path');

const KML_PATH = path.join(__dirname, '..', 'KLBD London Eruv.kml');
const DATA_PATH = path.join(__dirname, '..', 'src', 'data', 'nwlondon_data.js');

const xml = fs.readFileSync(KML_PATH, 'utf8');

// ══════════════════════════════════════
// Helpers
// ══════════════════════════════════════

function parseCoordinates(coordStr) {
  return coordStr.trim().split(/\s+/).map(c => {
    const [lng, lat] = c.split(',').map(Number);
    return { lat, lng };
  }).filter(p => !isNaN(p.lat) && !isNaN(p.lng));
}

function extractFolders(xml) {
  const folders = [];
  // Match top-level folders only (within Document)
  const re = /<Folder>([\s\S]*?)<\/Folder>/g;
  let match;
  while ((match = re.exec(xml)) !== null) {
    const content = match[1];
    const nameMatch = content.match(/<name>(.*?)<\/name>/);
    let name = nameMatch ? nameMatch[1] : '';
    name = name.replace(/<!\[CDATA\[(.*?)\]\]>/, '$1');
    folders.push({ name, content });
  }
  return folders;
}

function extractPlacemarks(folderContent) {
  const placemarks = [];
  const re = /<Placemark>([\s\S]*?)<\/Placemark>/g;
  let match;
  while ((match = re.exec(folderContent)) !== null) {
    const pm = match[1];
    const nameMatch = pm.match(/<name>(.*?)<\/name>/);
    let name = nameMatch ? nameMatch[1] : '';
    name = name.replace(/<!\[CDATA\[(.*?)\]\]>/, '$1');
    
    // Check for LineString
    const lineMatch = pm.match(/<LineString>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
    // Check for Polygon
    const polyMatch = pm.match(/<Polygon>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
    // Check for Point
    const pointMatch = pm.match(/<Point>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
    
    // Extract style to get color
    const styleMatch = pm.match(/<styleUrl>(.*?)<\/styleUrl>/);
    const style = styleMatch ? styleMatch[1] : '';
    
    placemarks.push({
      name,
      style,
      line: lineMatch ? parseCoordinates(lineMatch[1]) : null,
      polygon: polyMatch ? parseCoordinates(polyMatch[1]) : null,
      point: pointMatch ? parseCoordinates(pointMatch[1])[0] : null,
    });
  }
  return placemarks;
}

// ══════════════════════════════════════
// Extract all folders
// ══════════════════════════════════════

const folders = extractFolders(xml);
console.log('=== KML Folders ===');
folders.forEach(f => {
  const pms = extractPlacemarks(f.content);
  const lines = pms.filter(p => p.line);
  const polygons = pms.filter(p => p.polygon);
  const points = pms.filter(p => p.point);
  console.log(`  ${f.name || '(unnamed)'}: ${lines.length} lines, ${polygons.length} polygons, ${points.length} points`);
});

// ══════════════════════════════════════
// Extract label positions (from first folder which has all labels)
// ══════════════════════════════════════

const labelFolder = folders[0]; // "Woodside Park Eruv" folder has all labels
const labelPlacemarks = extractPlacemarks(labelFolder.content).filter(p => p.point && !p.name.startsWith('Line '));

console.log('\n=== Label Positions ===');
const labelPositions = {};
labelPlacemarks.forEach(lp => {
  labelPositions[lp.name] = lp.point;
  console.log(`  ${lp.name}: lat=${lp.point.lat}, lng=${lp.point.lng}`);
});

// ══════════════════════════════════════
// Extract NEW eiruvim boundary data
// ══════════════════════════════════════

// 1. Chigwell — from "Chigwell Eruv" folder (has a Polygon)
const chigwellFolder = folders.find(f => f.name === 'Chigwell Eruv');
const chigwellPms = extractPlacemarks(chigwellFolder.content);
const chigwellPoly = chigwellPms.find(p => p.polygon);

const chigwellData = {
  name: 'Chigwell Eruv',
  color: '#CE93D8',
  labelPosition: labelPositions['Chigwell Eruv'] || null, // May not have label in KML
  rawSegments: [],
  polygonPaths: chigwellPoly ? [chigwellPoly.polygon] : [],
  containmentPath: chigwellPoly ? chigwellPoly.polygon : [],
};

// 2. Brondesbury Park — from "Brondesbury Park" folder
const bpFolder = folders.find(f => f.name === 'Brondesbury Park');
const bpPms = extractPlacemarks(bpFolder.content).filter(p => p.line);
const bpSegments = bpPms.map(p => p.line);

// Build containment path by concatenating all segments
const bpAllPoints = [];
bpSegments.forEach(seg => seg.forEach(pt => bpAllPoints.push(pt)));

const bpData = {
  name: 'Brondesbury Park Eruv',
  color: '#3F5BA9',
  labelPosition: labelPositions['Brondesbury Park Eruv'] || null,
  rawSegments: bpSegments,
  polygonPaths: [],
  containmentPath: bpAllPoints,
};

// 3 & 4. SJW + South Hampstead — from last folder (unnamed or "SJW / N Westminster...")
// The SJW folder is the last one in the KML
const sjwFolder = folders.find(f => f.name.includes('SJW') || f.name.includes('Westminster') || f.name.includes('Camden'));
let sjwFolderActual = sjwFolder;
if (!sjwFolderActual) {
  // Try the unnamed folder (last one)
  sjwFolderActual = folders[folders.length - 1];
}

const sjwPms = extractPlacemarks(sjwFolderActual.content).filter(p => p.line);
const sjwAllSegments = sjwPms.map(p => p.line);

// Get label positions for geographic separation
const sjwLabel = labelPositions["St John's Wood Eruv"] || { lat: 51.5345951, lng: -0.1771175 };
const shLabel = labelPositions['South Hampstead Eruv'] || { lat: 51.549088, lng: -0.1683322 };

// Separate segments by proximity to each label
// South Hampstead is NORTH (~51.549), SJW is SOUTH (~51.535)
// We'll use a latitude threshold of ~51.542 as the dividing line
const LAT_DIVIDE = (sjwLabel.lat + shLabel.lat) / 2;

function segmentCenter(seg) {
  const sumLat = seg.reduce((a, p) => a + p.lat, 0) / seg.length;
  const sumLng = seg.reduce((a, p) => a + p.lng, 0) / seg.length;
  return { lat: sumLat, lng: sumLng };
}

function distToPoint(seg, ref) {
  const c = segmentCenter(seg);
  return Math.hypot(c.lat - ref.lat, c.lng - ref.lng);
}

// For shared boundaries, assign to BOTH eiruvim
// A segment is "shared" if it's roughly equidistant from both labels
const sjwSegments = [];
const shSegments = [];

sjwAllSegments.forEach(seg => {
  const dSjw = distToPoint(seg, sjwLabel);
  const dSh = distToPoint(seg, shLabel);
  
  // If close to either, include in that eruv. If shared area, include in both.
  sjwSegments.push(seg);
  shSegments.push(seg);
});

// Actually since both eiruvim share boundaries, and we can't cleanly separate
// without visual inspection, we'll include ALL segments in both eiruvim.
// The containment paths and polygon fills will distinguish them.
// But for proper containment checking, we need proper closed polygons.
// For now, include all segments as rawSegments for both.

const sjwAllPoints = [];
sjwSegments.forEach(seg => seg.forEach(pt => sjwAllPoints.push(pt)));

const shAllPoints = [];
shSegments.forEach(seg => seg.forEach(pt => shAllPoints.push(pt)));

const sjwData = {
  name: "St John's Wood Eruv",
  color: '#673AB7',
  labelPosition: sjwLabel,
  rawSegments: sjwAllSegments, // All segments from the combined folder
  polygonPaths: [],
  containmentPath: sjwAllPoints,
};

const shData = {
  name: 'South Hampstead Eruv',
  color: '#C2185B',
  labelPosition: shLabel,
  rawSegments: sjwAllSegments, // Same segments (shared boundaries)
  polygonPaths: [],
  containmentPath: shAllPoints,
};

// ══════════════════════════════════════
// Output the new eruv data
// ══════════════════════════════════════

const newEruvim = [chigwellData, bpData, sjwData, shData];

console.log('\n=== New Eiruvim Summary ===');
newEruvim.forEach(e => {
  console.log(`  ${e.name}: ${e.rawSegments.length} segments, ${e.polygonPaths.length} polygons, containment: ${e.containmentPath.length} points`);
  if (e.labelPosition) console.log(`    Label: ${JSON.stringify(e.labelPosition)}`);
});

// ══════════════════════════════════════
// Boundary Comparison — compare KML line segments with existing data
// ══════════════════════════════════════

console.log('\n=== Boundary Comparison ===');

// Map KML folder names to our data names
const folderToDataName = {
  'Woodside Park Eruv': 'Woodside Park Eruv',
  'NW London Eruv': 'NW London Eruv',
  'Mill Hill': 'Mill Hill',
  'Pinner Eruv': 'Pinner Eruv',
  'Borehamwood / Bushey Eruv': ['Borehamwood Eruv', 'Bushey Eruv'],
  'Edgware, Belmont and Stanmore Eruvin': ['Edgware Eruv Area', 'Stanmore Eruv'],
};

// Count KML segments per folder
folders.forEach(f => {
  if (!folderToDataName[f.name]) return;
  const pms = extractPlacemarks(f.content).filter(p => p.line);
  const totalPoints = pms.reduce((s, p) => s + p.line.length, 0);
  const names = Array.isArray(folderToDataName[f.name]) ? folderToDataName[f.name] : [folderToDataName[f.name]];
  console.log(`  KML "${f.name}": ${pms.length} line segments, ${totalPoints} total points`);
  console.log(`    → Maps to: ${names.join(', ')}`);
});

// ══════════════════════════════════════
// Write output file
// ══════════════════════════════════════

const outputPath = path.join(__dirname, '..', 'src', 'data', 'new_eruvim.js');

let output = '// AUTO-GENERATED from extract_klbd_kml.js\n';
output += '// New eiruvim extracted from KLBD London Eruv KML\n\n';

output += 'export const NEW_ERUVIM = ' + JSON.stringify(newEruvim, null, 2) + ';\n\n';

// Also output label positions for ALL eiruvim
output += '// Label positions for ALL eiruvim (from KML point placemarks)\n';
output += 'export const ERUV_LABELS = ' + JSON.stringify(labelPositions, null, 2) + ';\n';

fs.writeFileSync(outputPath, output, 'utf8');
console.log(`\nOutput written to: ${outputPath}`);
console.log('Total size: ' + (output.length / 1024).toFixed(1) + ' KB');
