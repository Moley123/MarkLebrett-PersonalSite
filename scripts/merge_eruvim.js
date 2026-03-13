/**
 * merge_eruvim.js
 * Merges new eiruvim into nwlondon_data.js and:
 * 1. Adds the 4 new eiruvim (Chigwell, Brondesbury Park, SJW, South Hampstead)
 * 2. Separates Belmont from Stanmore
 * 3. Adds labelPosition to all existing eiruvim
 * 4. Outputs updated nwlondon_data.js
 */

const fs = require('fs');
const path = require('path');

const KML_PATH = path.join(__dirname, '..', 'KLBD London Eruv.kml');
const DATA_PATH = path.join(__dirname, '..', 'src', 'data', 'nwlondon_data.js');
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'nwlondon_data.js');

// ══════════════════════════════════════
// Read and parse KML
// ══════════════════════════════════════

const xml = fs.readFileSync(KML_PATH, 'utf8');

function parseCoordinates(coordStr) {
  return coordStr.trim().split(/\s+/).map(c => {
    const [lng, lat] = c.split(',').map(Number);
    return { lat, lng };
  }).filter(p => !isNaN(p.lat) && !isNaN(p.lng));
}

function extractPlacemarks(content) {
  const placemarks = [];
  const re = /<Placemark>([\s\S]*?)<\/Placemark>/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    const pm = match[1];
    const nameMatch = pm.match(/<name>(.*?)<\/name>/);
    let name = nameMatch ? nameMatch[1] : '';
    name = name.replace(/<!\[CDATA\[(.*?)\]\]>/, '$1');
    const lineMatch = pm.match(/<LineString>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
    const polyMatch = pm.match(/<Polygon>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
    const pointMatch = pm.match(/<Point>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
    placemarks.push({
      name,
      line: lineMatch ? parseCoordinates(lineMatch[1]) : null,
      polygon: polyMatch ? parseCoordinates(polyMatch[1]) : null,
      point: pointMatch ? parseCoordinates(pointMatch[1])[0] : null,
    });
  }
  return placemarks;
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

// ══════════════════════════════════════
// Extract label positions from first folder
// ══════════════════════════════════════

const labelPms = extractPlacemarks(folders[0].content).filter(p => p.point && !p.name.startsWith('Line '));
const labels = {};
labelPms.forEach(lp => { labels[lp.name] = lp.point; });

// ══════════════════════════════════════
// Read existing data
// ══════════════════════════════════════

const existingSource = fs.readFileSync(DATA_PATH, 'utf8');

// Parse out the NWLONDON_ERUVIM array and CROSSING_POINTS
// We need to be careful here - the file is huge
// Let's find the structure

const eruvimStart = existingSource.indexOf('export const NWLONDON_ERUVIM = [');
const crossingStart = existingSource.indexOf('export const CROSSING_POINTS = [');

// Extract the eruv data by finding matching brackets
let depth = 0;
let eruvimEnd = -1;
for (let i = eruvimStart + 'export const NWLONDON_ERUVIM = '.length; i < existingSource.length; i++) {
  if (existingSource[i] === '[') depth++;
  if (existingSource[i] === ']') depth--;
  if (depth === 0) { eruvimEnd = i + 1; break; }
}

const eruvimJson = existingSource.substring(eruvimStart + 'export const NWLONDON_ERUVIM = '.length, eruvimEnd);
const eruvimData = JSON.parse(eruvimJson);

// Also extract CROSSING_POINTS
depth = 0;
let crossEnd = -1;
for (let i = crossingStart + 'export const CROSSING_POINTS = '.length; i < existingSource.length; i++) {
  if (existingSource[i] === '[') depth++;
  if (existingSource[i] === ']') depth--;
  if (depth === 0) { crossEnd = i + 1; break; }
}
const crossingJson = existingSource.substring(crossingStart + 'export const CROSSING_POINTS = '.length, crossEnd);
const crossingData = JSON.parse(crossingJson);

console.log('Existing eiruvim:', eruvimData.map(e => e.name));
console.log('Crossing points:', crossingData.length);

// ══════════════════════════════════════
// Add label positions to existing eiruvim
// ══════════════════════════════════════

const nameToLabel = {
  'Edgware Eruv Area': labels['Edgware Eruv'],
  'Woodside Park Eruv': labels['Woodside Park Eruv'],
  'NW London Eruv': labels['NW London Eruv'],
  'Mill Hill': labels['Mill Hill Eruv'],
  'Borehamwood Eruv': labels['Borehamwood Eruv'],
  'Bushey Eruv': labels['Bushey Eruv'],
  'Stanmore Eruv': labels['Stanmore Eruv'],
  'Pinner Eruv': labels['Pinner Eruv'],
};

eruvimData.forEach(e => {
  if (nameToLabel[e.name]) {
    e.labelPosition = nameToLabel[e.name];
  }
});

// ══════════════════════════════════════
// Separate Belmont from Stanmore
// ══════════════════════════════════════

// The "Edgware, Belmont and Stanmore Eruvin" folder has extra line segments
// that include Belmont's own boundary lines
const ebsFolder = folders.find(f => f.name.includes('Edgware, Belmont and Stanmore'));
const ebsPms = extractPlacemarks(ebsFolder.content);

// The Belmont label position
const belmontLabel = labels['Belmont Eruv'];
console.log('Belmont label position:', belmontLabel);

// Get the "Area" polygon from the EBS folder (this is likely Belmont's area)
const ebsPoly = ebsPms.find(p => p.polygon);
const ebsLines = ebsPms.filter(p => p.line);

console.log('EBS folder: ', ebsLines.length, 'lines,', ebsPoly ? '1 polygon' : '0 polygons');

// The EBS folder has 28 lines and 1 polygon ("Area")
// Lines that are near Belmont should be separated
// Belmont is at lat ~51.6022, lng ~-0.3103
// Stanmore is at lat ~51.6164, lng ~-0.3057

const belmontLines = [];
const stanmoreLines = [];

ebsLines.forEach(pm => {
  const seg = pm.line;
  const center = {
    lat: seg.reduce((a, p) => a + p.lat, 0) / seg.length,
    lng: seg.reduce((a, p) => a + p.lng, 0) / seg.length,
  };
  const distBelmont = Math.hypot(center.lat - belmontLabel.lat, center.lng - belmontLabel.lng);
  const distStanmore = Math.hypot(center.lat - labels['Stanmore Eruv'].lat, center.lng - labels['Stanmore Eruv'].lng);
  
  if (distBelmont < distStanmore) {
    belmontLines.push(seg);
  } else {
    stanmoreLines.push(seg);
  }
});

console.log(`Belmont: ${belmontLines.length} lines, Stanmore extra: ${stanmoreLines.length} lines`);

// Create Belmont entry - use the polygon from EBS as the Belmont area
const belmontAllPts = [];
belmontLines.forEach(seg => seg.forEach(pt => belmontAllPts.push(pt)));
if (ebsPoly) belmontAllPts.push(...ebsPoly.polygon);

const belmontData = {
  name: 'Belmont Eruv',
  color: '#009688', // teal - distinct from Stanmore
  labelPosition: belmontLabel,
  rawSegments: belmontLines,
  polygonPaths: ebsPoly ? [ebsPoly.polygon] : [],
  containmentPath: belmontAllPts.length > 2 ? belmontAllPts : [],
};

// Add the extra Stanmore segments to existing Stanmore entry
const stanmoreEntry = eruvimData.find(e => e.name === 'Stanmore Eruv');
if (stanmoreEntry) {
  stanmoreEntry.rawSegments = [...(stanmoreEntry.rawSegments || []), ...stanmoreLines];
  stanmoreEntry.labelPosition = labels['Stanmore Eruv'];
}

// ══════════════════════════════════════
// Extract new eiruvim from KML
// ══════════════════════════════════════

// Chigwell
const chigFolder = folders.find(f => f.name === 'Chigwell Eruv');
const chigPms = extractPlacemarks(chigFolder.content);
const chigPoly = chigPms.find(p => p.polygon);

const chigwellData = {
  name: 'Chigwell Eruv',
  color: '#CE93D8',
  labelPosition: chigPms.find(p => p.point)?.point || { lat: 51.611, lng: 0.075 },
  rawSegments: [],
  polygonPaths: chigPoly ? [chigPoly.polygon] : [],
  containmentPath: chigPoly ? chigPoly.polygon : [],
};

// Brondesbury Park
const bpFolder = folders.find(f => f.name === 'Brondesbury Park');
const bpPms = extractPlacemarks(bpFolder.content).filter(p => p.line);
const bpSegs = bpPms.map(p => p.line);
const bpAllPts = [];
bpSegs.forEach(s => s.forEach(pt => bpAllPts.push(pt)));

const bpData = {
  name: 'Brondesbury Park Eruv',
  color: '#3F5BA9',
  labelPosition: labels['Brondesbury Park Eruv'],
  rawSegments: bpSegs,
  polygonPaths: [],
  containmentPath: bpAllPts,
};

// SJW + South Hampstead (from combined folder)
const sjwFolder = folders.find(f => f.name.includes('SJW'));
const sjwPms = extractPlacemarks(sjwFolder.content).filter(p => p.line);
const sjwAllSegs = sjwPms.map(p => p.line);
const sjwAllPts = [];
sjwAllSegs.forEach(s => s.forEach(pt => sjwAllPts.push(pt)));

// For SJW and South Hampstead, they share the SAME boundary line segments
// Both will display the same lines. The difference is:
// - SJW shows its label at (51.535, -0.177)
// - South Hampstead shows its label at (51.549, -0.168)
// Since they share boundaries (per user), we'll include all segments in both

const sjwData = {
  name: "St John's Wood Eruv",
  color: '#673AB7',
  labelPosition: labels["St John's Wood Eruv"],
  rawSegments: sjwAllSegs,
  polygonPaths: [],
  containmentPath: sjwAllPts,
};

const shData = {
  name: 'South Hampstead Eruv',
  color: '#C2185B',
  labelPosition: labels['South Hampstead Eruv'],
  rawSegments: sjwAllSegs,
  polygonPaths: [],
  containmentPath: sjwAllPts,
};

// ══════════════════════════════════════
// Build final NWLONDON_ERUVIM array
// ══════════════════════════════════════

// Insert Belmont after Stanmore, add new eiruvim at the end
const newEruvim = [...eruvimData, belmontData, chigwellData, bpData, sjwData, shData];

console.log('\n=== Final Eiruvim List ===');
newEruvim.forEach(e => {
  console.log(`  ${e.name} (${e.color}) - segs:${e.rawSegments.length} polys:${e.polygonPaths.length} contain:${e.containmentPath.length}`);
});

// ══════════════════════════════════════
// Write output
// ══════════════════════════════════════

let output = '// AUTO-GENERATED from process_nwlondon_kml.js\n';
output += 'export const NWLONDON_ERUVIM = ' + JSON.stringify(newEruvim, null, 2) + ';\n\n';
output += 'export const CROSSING_POINTS = ' + JSON.stringify(crossingData, null, 2) + ';\n';

fs.writeFileSync(OUTPUT_PATH, output, 'utf8');
console.log(`\nWritten to ${OUTPUT_PATH}`);
console.log(`File size: ${(output.length / 1024).toFixed(1)} KB`);
