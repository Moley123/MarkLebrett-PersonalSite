const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');

console.log("---- NW London KML Parser ----");

const kmlSources = [
  {
    file: 'The Edgware Eruv & Surrounding Eruvin.kml',
    hasFolders: true,
    authority: 'LBD',
    isPrototype: false
  },
  {
    file: 'GGmap_v3.kml',
    hasFolders: false,
    forcedName: 'Golders Green Eruv',
    authority: 'KF',
    isPrototype: true
  },
  {
    file: 'SHmap_v1.kml',
    hasFolders: false,
    forcedName: 'Stamford Hill Eruv',
    authority: 'UOHC',
    isPrototype: true
  }
];

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

function getDirectPlacemarks(node) {
  const result = [];
  for (let i = 0; i < node.childNodes.length; i++) {
    if (node.childNodes[i].nodeName === 'Placemark') result.push(node.childNodes[i]);
  }
  return result;
}

kmlSources.forEach(source => {
  const kmlPath = path.join(__dirname, '..', source.file);
  if (!fs.existsSync(kmlPath)) {
    console.log(`Skipping missing file: ${source.file}`);
    return;
  }
  const kmlText = fs.readFileSync(kmlPath, 'utf8');
  const parser = new DOMParser();
  const doc = parser.parseFromString(kmlText, 'text/xml');
  const documentEl = doc.getElementsByTagName('Document')[0];

  let nodesToProcess = [];

  if (source.hasFolders) {
    for (let i = 0; i < documentEl.childNodes.length; i++) {
      const child = documentEl.childNodes[i];
      if (child.nodeName === 'Folder') nodesToProcess.push({ node: child, name: child.getElementsByTagName('name')[0]?.textContent.trim() });
    }
  } else {
    nodesToProcess.push({ node: documentEl, name: source.forcedName });
  }

  for (let i = 0; i < nodesToProcess.length; i++) {
    const { node, name } = nodesToProcess[i];
    if (!name) continue;

    if (name === 'LABELS') continue;

    // ── Crossing Points: store FULL LineString paths ──
    if (name === 'Crossing Points') {
      const placemarks = getDirectPlacemarks(node);
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
    const placemarks = getDirectPlacemarks(node);
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
      eruvimData.push({ 
        name, 
        rawSegments, 
        polygonPaths, 
        authority: source.authority, 
        isPrototype: source.isPrototype 
      });
    }
  }
});

/* ═══════════════════════════════════════════════════
   Robust multi-pass chaining for containment polygons
   ═══════════════════════════════════════════════════ */
function dist(a, b) {
  return Math.sqrt((a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2);
}

function chainSegments(segments) {
  if (!segments || segments.length === 0) return [];

  let remaining = segments.map(s => [...s]);
  let chains = [];
  const SEG_TOL = 0.001; // ~100m tolerance for snapping individual segments

  // Phase 1: Build multiple independent chains from segments
  while (remaining.length > 0) {
    let chain = [...remaining.shift()];
    let changed = true;
    while (changed && remaining.length > 0) {
      changed = false;
      let bestIdx = -1, bestDist = SEG_TOL, bestMode = '';
      const cH = chain[0], cT = chain[chain.length - 1];
      for (let i = 0; i < remaining.length; i++) {
        const s = remaining[i], sH = s[0], sT = s[s.length - 1];
        const d1 = dist(cT, sH), d2 = dist(cT, sT), d3 = dist(cH, sT), d4 = dist(cH, sH);
        const m = Math.min(d1, d2, d3, d4);
        if (m < bestDist) {
          bestDist = m; bestIdx = i;
          bestMode = m === d1 ? 'th' : m === d2 ? 'tt' : m === d3 ? 'ht' : 'hh';
        }
      }
      if (bestIdx >= 0) {
        const s = remaining.splice(bestIdx, 1)[0];
        if (bestMode === 'th') { s.shift(); chain = chain.concat(s); }
        else if (bestMode === 'tt') { s.pop(); s.reverse(); chain = chain.concat(s); }
        else if (bestMode === 'ht') { s.pop(); chain = s.concat(chain); }
        else { s.shift(); s.reverse(); chain = s.concat(chain); }
        changed = true;
      }
    }
    chains.push(chain);
  }

  // Phase 2: Merge chains together by connecting at nearest endpoints (~500m tolerance)
  const MERGE_TOL = 0.005;
  while (chains.length > 1) {
    let merged = false;
    for (let i = 0; i < chains.length && !merged; i++) {
      const cA = chains[i];
      let bestJ = -1, bestDist = MERGE_TOL, bestMode = '';
      for (let j = 0; j < chains.length; j++) {
        if (j === i) continue;
        const cB = chains[j];
        const d1 = dist(cA[cA.length - 1], cB[0]);      // A.tail → B.head
        const d2 = dist(cA[cA.length - 1], cB[cB.length - 1]); // A.tail → B.tail
        const d3 = dist(cA[0], cB[cB.length - 1]);      // A.head ← B.tail
        const d4 = dist(cA[0], cB[0]);                   // A.head ← B.head
        const m = Math.min(d1, d2, d3, d4);
        if (m < bestDist) {
          bestDist = m; bestJ = j;
          bestMode = m === d1 ? 'th' : m === d2 ? 'tt' : m === d3 ? 'ht' : 'hh';
        }
      }
      if (bestJ >= 0) {
        const cB = chains.splice(bestJ, 1)[0];
        if (bestMode === 'th') chains[i] = cA.concat(cB);
        else if (bestMode === 'tt') { cB.reverse(); chains[i] = cA.concat(cB); }
        else if (bestMode === 'ht') chains[i] = cB.concat(cA);
        else { cB.reverse(); chains[i] = cB.concat(cA); }
        merged = true;
        console.log(`    -> Merged chains (gap=${bestDist.toFixed(5)}), now ${chains[i].length} pts, ${chains.length} chains left`);
      }
    }
    if (!merged) break; // No more merges possible
  }

  // Use merged result (or longest if multiple remain)
  chains.sort((a, b) => b.length - a.length);
  const best = chains[0];
  if (chains.length > 1) {
    const otherPts = chains.slice(1).reduce((s, c) => s + c.length, 0);
    console.log(`    -> ${chains.length} chains remain. Using longest (${best.length} pts), dropped ${otherPts} pts`);
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
  'Golders Green Eruv': '#ef6c00', // distinct orange
  'Stamford Hill Eruv': '#8e24aa', // distinct purple
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
    authority: e.authority,
    isPrototype: !!e.isPrototype
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
