/**
 * Loader for the sharded Gematria dataset.
 *
 * Replaces the old "fetch a 58 MB JSON blob and hold it all in memory" model.
 * A lookup now needs the verse table (once) plus the single 100-value shard
 * that contains the target — typically a few tens of KB.
 *
 * Caches live at module scope so switching tabs or remounting never refetches.
 */

const BASE = `${process.env.PUBLIC_URL || ''}/gematria-data`;

const cache = {
  manifest: null,
  verses: null,
  shards: new Map(),
  inflight: new Map(),
};

/** Fetch + parse JSON once per URL, sharing concurrent callers. */
function fetchJson(url) {
  if (cache.inflight.has(url)) return cache.inflight.get(url);

  const promise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
      const type = res.headers.get('content-type') || '';
      if (!type.includes('json')) {
        // A SPA rewrite serving index.html for a missing file would otherwise
        // fail deep inside JSON.parse with a useless message.
        throw new Error(`Expected JSON but received "${type}" — ${url}`);
      }
      return res.json();
    })
    .finally(() => cache.inflight.delete(url));

  cache.inflight.set(url, promise);
  return promise;
}

export async function loadManifest() {
  if (!cache.manifest) cache.manifest = await fetchJson(`${BASE}/manifest.json`);
  return cache.manifest;
}

/**
 * The verse table: `[ref, hebrew, english, bookIndex, value, footnotes][]`.
 * Decorated into objects once, then reused.
 */
export async function loadVerses() {
  if (cache.verses) return cache.verses;
  const raw = await fetchJson(`${BASE}/verses.json`);
  cache.verses = raw.map((row, index) => ({
    index,
    ref: row[0],
    he: row[1],
    en: row[2],
    book: BOOKS[row[3]],
    bookIndex: row[3],
    value: row[4],
    footnotes: row[5] || [],
  }));
  return cache.verses;
}

export async function loadShardFor(value) {
  const manifest = await loadManifest();
  const shardId = Math.floor(value / manifest.shardSize);
  if (cache.shards.has(shardId)) return cache.shards.get(shardId);
  if (!manifest.shards.includes(shardId)) {
    cache.shards.set(shardId, {});
    return {};
  }
  const data = await fetchJson(`${BASE}/idx/${shardId}.json`);
  cache.shards.set(shardId, data);
  return data;
}

export const BOOKS = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'];

export const BOOKS_HE = {
  Genesis: 'Bereshit',
  Exodus: 'Shemot',
  Leviticus: 'Vayikra',
  Numbers: 'Bamidbar',
  Deuteronomy: 'Devarim',
};

/**
 * Look up everything indexed at `value`.
 *
 * @returns {Promise<{value:number, phrases:Array, verses:Array, total:number}>}
 */
export async function lookup(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return { value, phrases: [], verses: [], total: 0 };
  }

  const [verses, shard] = await Promise.all([loadVerses(), loadShardFor(value)]);
  const bucket = shard[String(value)];
  if (!bucket) return { value, phrases: [], verses: [], total: 0 };

  const phrases = (bucket.p || []).map(([phrase, occurrences]) => ({
    phrase,
    words: phrase.split(' ').length,
    count: occurrences.length,
    occurrences: occurrences.map((i) => verses[i]).filter(Boolean),
  }));

  const wholeVerses = (bucket.v || []).map((i) => verses[i]).filter(Boolean);

  return {
    value,
    phrases,
    verses: wholeVerses,
    total: phrases.length + wholeVerses.length,
  };
}

/** Warm the caches ahead of a search so the first lookup feels instant. */
export function prefetch(value) {
  loadVerses().catch(() => {});
  if (Number.isFinite(value) && value > 0) loadShardFor(value).catch(() => {});
}

/** Test seam — clears every cache. */
export function __resetCache() {
  cache.manifest = null;
  cache.verses = null;
  cache.shards.clear();
  cache.inflight.clear();
}
