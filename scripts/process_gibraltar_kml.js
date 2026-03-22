const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');

console.log("---- Gibraltar KML Parser ----");

const kmlPath = path.join(__dirname, '..', 'Gibraltar Eruv V2.0.kml');
if (!fs.existsSync(kmlPath)) {
  console.log(`Skipping missing file: Gibraltar Eruv V2.0.kml`);
  process.exit(1);
}

const kmlText = fs.readFileSync(kmlPath, 'utf8');
const parser = new DOMParser();
const doc = parser.parseFromString(kmlText, 'text/xml');
const documentEl = doc.getElementsByTagName('Document')[0];

const eruvimData = [];

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

const placemarks = doc.getElementsByTagName('Placemark');
const polygonPaths = [];

for (let j = 0; j < placemarks.length; j++) {
  const pm = placemarks[j];
  // Some KMLs use LineString for borders, some use Polygon
  const lineString = pm.getElementsByTagName('LineString')[0];
  const polygon = pm.getElementsByTagName('Polygon')[0];
  
  if (lineString) {
    const coordNode = lineString.getElementsByTagName('coordinates')[0];
    if (coordNode) {
      const seg = parseCoordinates(coordNode.textContent);
      if (seg.length > 1) polygonPaths.push(seg);
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

// Gibraltar has a simple line/polygon
const mappedEruvim = [{
  name: 'Gibraltar Eruv',
  color: '#e91e63', // distinct color
  polygonPaths: polygonPaths,
  containmentPath: polygonPaths[0] || []
}];

const outputFile = path.join(__dirname, '..', 'src', 'data', 'gibraltar_data.js');
const finalCode = `// AUTO-GENERATED from process_gibraltar_kml.js
export const GIBRALTAR_ERUV = ${JSON.stringify(mappedEruvim, null, 2)};
`;

fs.writeFileSync(outputFile, finalCode, 'utf8');
console.log("-> Wrote", outputFile);
