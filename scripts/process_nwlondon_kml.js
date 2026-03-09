const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');

console.log("---- NW London KML Parser ----");

// 1. Read the raw KML file
const kmlPath = path.join(__dirname, '..', 'The Edgware Eruv & Surrounding Eruvin.kml');
const kmlText = fs.readFileSync(kmlPath, 'utf8');

const parser = new DOMParser();
const doc = parser.parseFromString(kmlText, 'text/xml');

const folders = doc.getElementsByTagName('Folder');

const eruvimData = [];
const crossingPoints = [];

// Helper: parse coordinates string "lng,lat,alt lng,lat,alt" into array of {lat, lng}
function parseCoordinates(coordStr) {
  if (!coordStr) return [];
  return coordStr.trim().split(/\s+/).map(pair => {
    const parts = pair.split(',');
    if (parts.length >= 2) {
      return {
        lat: parseFloat(parts[1]),
        lng: parseFloat(parts[0])
      };
    }
    return null;
  }).filter(Boolean);
}

// 2. Extract Data by Folder
for (let i = 0; i < folders.length; i++) {
  const folder = folders[i];
  const nameNode = folder.getElementsByTagName('name')[0];
  if (!nameNode) continue;
  
  const folderName = nameNode.textContent.trim();

  // Handle the specific Crossing Points folder
  if (folderName === 'Crossing Points') {
    const placemarks = folder.getElementsByTagName('Placemark');
    for (let j = 0; j < placemarks.length; j++) {
      const pm = placemarks[j];
      const pmName = pm.getElementsByTagName('name')[0]?.textContent || 'Crossing';
      
      // Some crossings might be Points, others might be short LineStrings
      const point = pm.getElementsByTagName('Point')[0];
      const lineString = pm.getElementsByTagName('LineString')[0];
      
      if (point) {
        const coords = parseCoordinates(point.getElementsByTagName('coordinates')[0]?.textContent);
        if (coords.length > 0) crossingPoints.push({ name: pmName, pos: coords[0] });
      } else if (lineString) {
        const coords = parseCoordinates(lineString.getElementsByTagName('coordinates')[0]?.textContent);
        if (coords.length > 0) crossingPoints.push({ name: pmName, pos: coords[Math.floor(coords.length / 2)] }); // Take midpoint
      }
    }
    continue; // Skip the rest, this isn't an Eruv boundary
  }

  // Not crossing points, so assume it's an Eruv folder
  const placemarks = folder.getElementsByTagName('Placemark');
  const segments = [];
  const preclosedPolygons = [];
  
  for (let j = 0; j < placemarks.length; j++) {
    const lineString = placemarks[j].getElementsByTagName('LineString')[0];
    const polygon = placemarks[j].getElementsByTagName('Polygon')[0];

    if (lineString) {
      const coordNode = lineString.getElementsByTagName('coordinates')[0];
      if (coordNode) {
         segments.push(parseCoordinates(coordNode.textContent));
      }
    }
    
    if (polygon) {
      const outerRing = polygon.getElementsByTagName('outerBoundaryIs')[0];
      if (outerRing) {
        const coordNode = outerRing.getElementsByTagName('coordinates')[0];
        if (coordNode) {
          preclosedPolygons.push(parseCoordinates(coordNode.textContent));
        }
      }
    }
  }

  if (segments.length > 0 || preclosedPolygons.length > 0) {
    eruvimData.push({
      name: folderName,
      segments: segments,
      polygons: preclosedPolygons
    });
  }
}

// 3. Simple Chaining Logic (borrowed from Zurich map logic)
function chainSegments(segments) {
  if (!segments || segments.length === 0) return [];

  let remaining = [...segments];
  let currentChain = [...remaining.shift()];

  // Helper to check if two points are close
  const pointsAreClose = (p1, p2) => {
    const diffLat = Math.abs(p1.lat - p2.lat);
    const diffLng = Math.abs(p1.lng - p2.lng);
    return diffLat < 0.0001 && diffLng < 0.0001; 
  };

  while (remaining.length > 0) {
    let lastPoint = currentChain[currentChain.length - 1];
    let firstPoint = currentChain[0];

    let foundMatch = false;

    for (let i = 0; i < remaining.length; i++) {
        let candidate = remaining[i];
        let cFirst = candidate[0];
        let cLast = candidate[candidate.length - 1];

        if (pointsAreClose(lastPoint, cFirst)) {
            candidate.shift();
            currentChain = currentChain.concat(candidate);
            remaining.splice(i, 1);
            foundMatch = true;
            break;
        } else if (pointsAreClose(lastPoint, cLast)) {
            candidate.pop();
            candidate.reverse();
            currentChain = currentChain.concat(candidate);
            remaining.splice(i, 1);
            foundMatch = true;
            break;
        } else if (pointsAreClose(firstPoint, cLast)) {
            candidate.pop();
            currentChain = candidate.concat(currentChain);
            remaining.splice(i, 1);
            foundMatch = true;
            break;
        } else if (pointsAreClose(firstPoint, cFirst)) {
            candidate.shift();
            candidate.reverse();
            currentChain = candidate.concat(currentChain);
            remaining.splice(i, 1);
            foundMatch = true;
            break;
        }
    }

    if (!foundMatch) {
       // Just append the next segment if we can't find a clean mathematical snap.
       currentChain = currentChain.concat(remaining.shift());
    }
  }

  // Ensure closed loop
  if (!pointsAreClose(currentChain[0], currentChain[currentChain.length - 1])) {
       currentChain.push(currentChain[0]); 
  }

  return currentChain;
}

// Colors for the distinct Eiruvim
const COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#06b6d4'  // cyan
];

const mappedEruvim = eruvimData.map((e, index) => {
  const allRings = e.polygons ? [...e.polygons] : [];
  if (e.segments && e.segments.length > 0) {
    allRings.push(chainSegments(e.segments));
  }
  
  return {
    name: e.name,
    color: COLORS[index % COLORS.length],
    paths: allRings.length === 1 ? allRings[0] : allRings // support single vs multi-polygon
  };
});

console.log(`Successfully extracted ${mappedEruvim.length} Eruv boundaries.`);
console.log(`Successfully extracted ${crossingPoints.length} Crossing Points.`);

const outputFile = path.join(__dirname, '..', 'src', 'data', 'nwlondon_data.js');

const finalCode = `// AUTO-GENERATED from process_nwlondon_kml.js

// 1. Array of all 9 Eruvin boundaries
export const NWLONDON_ERUVIM = ${JSON.stringify(mappedEruvim, null, 2)};

// 2. List of explicitly defined Crossing Points allowing transition between boundary zones
export const CROSSING_POINTS = ${JSON.stringify(crossingPoints, null, 2)};
`;

fs.writeFileSync(outputFile, finalCode, 'utf8');
console.log("-> Wrote", outputFile);
