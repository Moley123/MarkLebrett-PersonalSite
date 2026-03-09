const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');

console.log("---- NW London KML Parser ----");

const kmlPath = path.join(__dirname, '..', 'The Edgware Eruv & Surrounding Eruvin.kml');
const kmlText = fs.readFileSync(kmlPath, 'utf8');

const parser = new DOMParser();
const doc = parser.parseFromString(kmlText, 'text/xml');

// Only iterate TOP-LEVEL folders (direct children of Document)
const documentEl = doc.getElementsByTagName('Document')[0];
const topFolders = [];
for (let i = 0; i < documentEl.childNodes.length; i++) {
  const child = documentEl.childNodes[i];
  if (child.nodeName === 'Folder') topFolders.push(child);
}

const eruvimData = [];
const crossingPoints = [];

function parseCoordinates(coordStr) {
  if (!coordStr) return [];
  return coordStr.trim().split(/\s+/).map(pair => {
    const parts = pair.split(',');
    if (parts.length >= 2) {
      return { lat: parseFloat(parts[1]), lng: parseFloat(parts[0]) };
    }
    return null;
  }).filter(Boolean);
}

// Collect only DIRECT Placemark children of a folder (not nested sub-folder placemarks)
function getDirectPlacemarks(folder) {
  const result = [];
  for (let i = 0; i < folder.childNodes.length; i++) {
    if (folder.childNodes[i].nodeName === 'Placemark') {
      result.push(folder.childNodes[i]);
    }
  }
  return result;
}

for (let i = 0; i < topFolders.length; i++) {
  const folder = topFolders[i];
  const nameNode = folder.getElementsByTagName('name')[0];
  if (!nameNode) continue;
  const folderName = nameNode.textContent.trim();

  // Skip the LABELS folder entirely
  if (folderName === 'LABELS') continue;

  // Handle Crossing Points
  if (folderName === 'Crossing Points') {
    const placemarks = getDirectPlacemarks(folder);
    for (let j = 0; j < placemarks.length; j++) {
      const pm = placemarks[j];
      const pmName = pm.getElementsByTagName('name')[0]?.textContent || 'Crossing';
      const point = pm.getElementsByTagName('Point')[0];
      const lineString = pm.getElementsByTagName('LineString')[0];
      if (point) {
        const coords = parseCoordinates(point.getElementsByTagName('coordinates')[0]?.textContent);
        if (coords.length > 0) crossingPoints.push({ name: pmName, pos: coords[0] });
      } else if (lineString) {
        const coords = parseCoordinates(lineString.getElementsByTagName('coordinates')[0]?.textContent);
        if (coords.length > 0) crossingPoints.push({ name: pmName, pos: coords[Math.floor(coords.length / 2)] });
      }
    }
    continue;
  }

  // Eruv folder — extract raw segments AND polygons
  const placemarks = getDirectPlacemarks(folder);
  const rawSegments = [];
  const polygonPaths = [];

  for (let j = 0; j < placemarks.length; j++) {
    const pm = placemarks[j];
    const lineString = pm.getElementsByTagName('LineString')[0];
    const polygon = pm.getElementsByTagName('Polygon')[0];

    if (lineString) {
      const coordNode = lineString.getElementsByTagName('coordinates')[0];
      if (coordNode) {
        const seg = parseCoordinates(coordNode.textContent);
        if (seg.length > 1) rawSegments.push(seg);
      }
    }
    if (polygon) {
      const outerRing = polygon.getElementsByTagName('outerBoundaryIs')[0];
      if (outerRing) {
        const coordNode = outerRing.getElementsByTagName('coordinates')[0];
        if (coordNode) {
          const poly = parseCoordinates(coordNode.textContent);
          if (poly.length > 2) polygonPaths.push(poly);
        }
      }
    }
  }

  if (rawSegments.length > 0 || polygonPaths.length > 0) {
    eruvimData.push({ name: folderName, rawSegments, polygonPaths });
  }
}

// Chaining algorithm — used ONLY for building containment polygons, not for rendering
function chainSegments(segments) {
  if (!segments || segments.length === 0) return [];
  let remaining = segments.map(s => [...s]);
  let currentChain = [...remaining.shift()];

  const close = (p1, p2) => Math.abs(p1.lat - p2.lat) < 0.0005 && Math.abs(p1.lng - p2.lng) < 0.0005;

  let maxIter = remaining.length * remaining.length + 10;
  while (remaining.length > 0 && maxIter-- > 0) {
    let last = currentChain[currentChain.length - 1];
    let first = currentChain[0];
    let found = false;

    for (let i = 0; i < remaining.length; i++) {
      let c = remaining[i];
      if (close(last, c[0])) {
        c.shift(); currentChain = currentChain.concat(c); remaining.splice(i, 1); found = true; break;
      } else if (close(last, c[c.length - 1])) {
        c.pop(); c.reverse(); currentChain = currentChain.concat(c); remaining.splice(i, 1); found = true; break;
      } else if (close(first, c[c.length - 1])) {
        c.pop(); currentChain = c.concat(currentChain); remaining.splice(i, 1); found = true; break;
      } else if (close(first, c[0])) {
        c.shift(); c.reverse(); currentChain = c.concat(currentChain); remaining.splice(i, 1); found = true; break;
      }
    }
    if (!found) break; // Don't force-append bad segments; just stop
  }

  // Close the loop
  if (currentChain.length > 2 && !close(currentChain[0], currentChain[currentChain.length - 1])) {
    currentChain.push(currentChain[0]);
  }
  return currentChain;
}

// Colors matching the Google My Maps reference
const COLORS = {
  'Edgware Eruv Area': '#e91e63',   // pink/red
  'Woodside Park Eruv': '#ff9800',  // orange
  'NW London Eruv': '#4caf50',      // green
  'Mill Hill': '#2196f3',           // blue
  'Borehamwood Eruv': '#3f51b5',    // indigo
  'Bushey Eruv': '#9c27b0',         // purple
  'Stanmore Eruv': '#795548',       // brown
  'Pinner Eruv': '#f44336',         // red
};
const DEFAULT_COLOR = '#607d8b';

const mappedEruvim = eruvimData.map(e => {
  // Build a containment polygon from polygonPaths OR chained segments
  let containmentPath = [];
  if (e.polygonPaths.length > 0) {
    containmentPath = e.polygonPaths[0]; // Use the first polygon boundary
  } else if (e.rawSegments.length > 0) {
    containmentPath = chainSegments(e.rawSegments);
  }

  return {
    name: e.name,
    color: COLORS[e.name] || DEFAULT_COLOR,
    rawSegments: e.rawSegments,       // For Polyline rendering (visual)
    polygonPaths: e.polygonPaths,     // For Polygon rendering (pre-closed areas)
    containmentPath: containmentPath, // For containsLocation() checks
  };
});

console.log(`Extracted ${mappedEruvim.length} Eruv boundaries.`);
mappedEruvim.forEach(e => console.log(`  ${e.name}: ${e.rawSegments.length} segments, ${e.polygonPaths.length} polygons, containment: ${e.containmentPath.length} pts`));
console.log(`Extracted ${crossingPoints.length} Crossing Points.`);

const outputFile = path.join(__dirname, '..', 'src', 'data', 'nwlondon_data.js');
const finalCode = `// AUTO-GENERATED from process_nwlondon_kml.js
export const NWLONDON_ERUVIM = ${JSON.stringify(mappedEruvim, null, 2)};
export const CROSSING_POINTS = ${JSON.stringify(crossingPoints, null, 2)};
`;

fs.writeFileSync(outputFile, finalCode, 'utf8');
console.log("-> Wrote", outputFile);
