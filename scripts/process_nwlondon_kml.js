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

  let remaining = segments.map(s => [...s]);
  const allChains = [];
  const TOL = 0.001; // ~100m tolerance for snapping

  // Build multiple independent chains
  while (remaining.length > 0) {
    let chain = [...remaining.shift()];

    // Keep extending this chain as long as we find matching segments
    let changed = true;
    while (changed && remaining.length > 0) {
      changed = false;
      let bestIdx = -1;
      let bestDist = TOL;
      let bestMode = '';

      const chainHead = chain[0];
      const chainTail = chain[chain.length - 1];

      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        const segHead = seg[0];
        const segTail = seg[seg.length - 1];

        const d1 = dist(chainTail, segHead);
        const d2 = dist(chainTail, segTail);
        const d3 = dist(chainHead, segTail);
        const d4 = dist(chainHead, segHead);

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

    allChains.push(chain);
  }

  // Sort chains by length — pick the longest as the containment polygon
  allChains.sort((a, b) => b.length - a.length);
  const best = allChains[0];

  if (allChains.length > 1) {
    const otherPts = allChains.slice(1).reduce((s, c) => s + c.length, 0);
    console.log(`    -> Built ${allChains.length} chains. Using longest (${best.length} pts), dropped ${otherPts} pts in ${allChains.length - 1} smaller chains`);
  }

  // Close the loop
  if (best.length > 2 && dist(best[0], best[best.length - 1]) > 0.00001) {
    best.push({ ...best[0] });
  }

  return best;
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

/* ═══════════════════════════════════════════════════
   Gap-closing pass: borrow neighbor boundary segments
   to close large gaps in containment polygons.
   ═══════════════════════════════════════════════════ */
const GAP_THRESHOLD = 0.005; // ~500m — anything larger is a shared boundary gap

for (const eruv of mappedEruvim) {
  const cp = eruv.containmentPath;
  if (cp.length < 3) continue;

  // Measure gap (head to the point before the closing copy)
  const head = cp[0];
  const tail = cp[cp.length - 2]; // -2 because -1 is a copy of head from close-loop
  const gapDist = dist(head, tail);

  if (gapDist < GAP_THRESHOLD) continue;
  console.log(`  ${eruv.name}: gap = ${gapDist.toFixed(4)} (${(gapDist * 111000).toFixed(0)}m) — searching neighbors...`);

  // Search other Eruvin for a chain that can bridge the gap
  for (const neighbor of mappedEruvim) {
    if (neighbor.name === eruv.name) continue;
    const nc = neighbor.containmentPath;
    if (nc.length < 10) continue;

    // Find the point on the neighbor's chain closest to our HEAD
    let bestHeadIdx = -1, bestHeadDist = Infinity;
    // Find the point closest to our TAIL
    let bestTailIdx = -1, bestTailDist = Infinity;

    for (let i = 0; i < nc.length; i++) {
      const dh = dist(nc[i], head);
      const dt = dist(nc[i], tail);
      if (dh < bestHeadDist) { bestHeadDist = dh; bestHeadIdx = i; }
      if (dt < bestTailDist) { bestTailDist = dt; bestTailIdx = i; }
    }

    // Both endpoints must be reasonably close to the neighbor's chain
    if (bestHeadDist > 0.02 || bestTailDist > 0.02) continue;

    console.log(`    -> Found neighbor "${neighbor.name}": headDist=${bestHeadDist.toFixed(5)}, tailDist=${bestTailDist.toFixed(5)}, indices=[${bestHeadIdx}, ${bestTailIdx}]`);

    // Extract the bridge segment from the neighbor's chain
    let bridge;
    if (bestHeadIdx <= bestTailIdx) {
      // head comes before tail in neighbor chain
      bridge = nc.slice(bestHeadIdx, bestTailIdx + 1);
    } else {
      // head comes after tail — reverse direction
      bridge = nc.slice(bestTailIdx, bestHeadIdx + 1).reverse();
    }

    // Check: is bridge a reasonable length? (should not be longer than 2x the gap)
    let bridgeLen = 0;
    for (let i = 1; i < bridge.length; i++) bridgeLen += dist(bridge[i - 1], bridge[i]);
    if (bridgeLen > gapDist * 5) {
      // Try the other direction around the neighbor's chain
      if (bestHeadIdx <= bestTailIdx) {
        const part1 = nc.slice(bestTailIdx);
        const part2 = nc.slice(0, bestHeadIdx + 1);
        bridge = [...part1, ...part2].reverse();
      } else {
        const part1 = nc.slice(bestHeadIdx);
        const part2 = nc.slice(0, bestTailIdx + 1);
        bridge = [...part1, ...part2];
      }
      bridgeLen = 0;
      for (let i = 1; i < bridge.length; i++) bridgeLen += dist(bridge[i - 1], bridge[i]);
    }

    console.log(`    -> Bridge: ${bridge.length} pts, len=${bridgeLen.toFixed(4)}`);

    // Remove the old closing point and insert the bridge
    cp.pop(); // remove the closing copy-of-head
    // Append bridge from head-end to tail-end (connects our head → neighbor → our tail)
    // Actually we need: chain goes head→...→tail, then bridge goes tail→...→head
    const reverseBridge = bridge.reverse();
    for (const pt of reverseBridge) cp.push(pt);
    // Re-close
    cp.push({ ...cp[0] });

    console.log(`    -> ${eruv.name} containment now ${cp.length} pts (was ${cp.length - reverseBridge.length})`);
    break; // Only use first matching neighbor
  }
}

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
