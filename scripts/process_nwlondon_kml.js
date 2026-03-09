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

function getDirectPlacemarks(folder) {
  const result = [];
  for (let i = 0; i < folder.childNodes.length; i++) {
    if (folder.childNodes[i].nodeName === 'Placemark') result.push(folder.childNodes[i]);
  }
  return result;
}

for (let i = 0; i < topFolders.length; i++) {
  const folder = topFolders[i];
  const nameNode = folder.getElementsByTagName('name')[0];
  if (!nameNode) continue;
  const folderName = nameNode.textContent.trim();

  if (folderName === 'LABELS') continue;

  // ── Crossing Points: store FULL LineString paths ──
  if (folderName === 'Crossing Points') {
    const placemarks = getDirectPlacemarks(folder);
    for (let j = 0; j < placemarks.length; j++) {
      const pm = placemarks[j];
      const pmName = pm.getElementsByTagName('name')[0]?.textContent || 'Crossing';
      const ls = pm.getElementsByTagName('LineString')[0];
      const pt = pm.getElementsByTagName('Point')[0];
      if (ls) {
        const coords = parseCoordinates(ls.getElementsByTagName('coordinates')[0]?.textContent);
        if (coords.length > 0) crossingPoints.push({ name: pmName, path: coords });
      } else if (pt) {
        const coords = parseCoordinates(pt.getElementsByTagName('coordinates')[0]?.textContent);
        if (coords.length > 0) crossingPoints.push({ name: pmName, path: coords });
      }
    }
    continue;
  }

  // ── Eruv folder ──
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

/* ═══════════════════════════════════════════════════
   Robust multi-pass chaining for containment polygons
   ═══════════════════════════════════════════════════ */
function dist(a, b) {
  return Math.sqrt((a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2);
}

function chainSegments(segments) {
  if (!segments || segments.length === 0) return [];

  // Work with copies
  let remaining = segments.map(s => [...s]);

  // Sort by length descending — start with the longest segment for best anchor
  remaining.sort((a, b) => b.length - a.length);

  let chain = [...remaining.shift()];

  // Multi-pass with increasing tolerance
  const tolerances = [0.0001, 0.0005, 0.001, 0.003, 0.008];
  
  for (const tol of tolerances) {
    let changed = true;
    while (changed && remaining.length > 0) {
      changed = false;
      let bestIdx = -1;
      let bestDist = tol;
      let bestMode = ''; // 'tail-head', 'tail-tail', 'head-tail', 'head-head'

      const chainHead = chain[0];
      const chainTail = chain[chain.length - 1];

      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        const segHead = seg[0];
        const segTail = seg[seg.length - 1];

        const d1 = dist(chainTail, segHead);  // append forward
        const d2 = dist(chainTail, segTail);  // append reversed
        const d3 = dist(chainHead, segTail);  // prepend forward
        const d4 = dist(chainHead, segHead);  // prepend reversed

        const minD = Math.min(d1, d2, d3, d4);
        if (minD < bestDist) {
          bestDist = minD;
          bestIdx = i;
          if (minD === d1) bestMode = 'tail-head';
          else if (minD === d2) bestMode = 'tail-tail';
          else if (minD === d3) bestMode = 'head-tail';
          else bestMode = 'head-head';
        }
      }

      if (bestIdx >= 0) {
        const seg = remaining.splice(bestIdx, 1)[0];
        switch (bestMode) {
          case 'tail-head': seg.shift(); chain = chain.concat(seg); break;
          case 'tail-tail': seg.pop(); seg.reverse(); chain = chain.concat(seg); break;
          case 'head-tail': seg.pop(); chain = seg.concat(chain); break;
          case 'head-head': seg.shift(); seg.reverse(); chain = seg.concat(chain); break;
        }
        changed = true;
      }
    }
  }

  // Force-append any remaining segments (they'll create a messy polygon but
  // it's better for containsLocation than missing them entirely)
  while (remaining.length > 0) {
    chain = chain.concat(remaining.shift());
  }

  // Close the loop
  if (chain.length > 2 && dist(chain[0], chain[chain.length - 1]) > 0.00001) {
    chain.push({ ...chain[0] });
  }

  return chain;
}

// Colors matching the Google My Maps reference
const COLORS = {
  'Edgware Eruv Area': '#e91e63',
  'Woodside Park Eruv': '#ff9800',
  'NW London Eruv': '#4caf50',
  'Mill Hill': '#2196f3',
  'Borehamwood Eruv': '#3f51b5',
  'Bushey Eruv': '#9c27b0',
  'Stanmore Eruv': '#795548',
  'Pinner Eruv': '#f44336',
};
const DEFAULT_COLOR = '#607d8b';

const mappedEruvim = eruvimData.map(e => {
  let containmentPath = [];
  if (e.polygonPaths.length > 0) {
    containmentPath = e.polygonPaths[0];
  } else if (e.rawSegments.length > 0) {
    containmentPath = chainSegments(e.rawSegments);
  }

  return {
    name: e.name,
    color: COLORS[e.name] || DEFAULT_COLOR,
    rawSegments: e.rawSegments,
    polygonPaths: e.polygonPaths,
    containmentPath: containmentPath,
  };
});

console.log(`Extracted ${mappedEruvim.length} Eruv boundaries.`);
mappedEruvim.forEach(e => {
  const totalRaw = e.rawSegments.reduce((s, seg) => s + seg.length, 0);
  console.log(`  ${e.name}: ${e.rawSegments.length} segs(${totalRaw}pts), ${e.polygonPaths.length} polys, containment=${e.containmentPath.length}pts`);
});
console.log(`Extracted ${crossingPoints.length} Crossing Points (as LineStrings).`);

const outputFile = path.join(__dirname, '..', 'src', 'data', 'nwlondon_data.js');
const finalCode = `// AUTO-GENERATED from process_nwlondon_kml.js
export const NWLONDON_ERUVIM = ${JSON.stringify(mappedEruvim, null, 2)};
export const CROSSING_POINTS = ${JSON.stringify(crossingPoints, null, 2)};
`;

fs.writeFileSync(outputFile, finalCode, 'utf8');
console.log("-> Wrote", outputFile);
