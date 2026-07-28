"""
Build the normalised, sharded Gematria dataset.

The legacy ``public/torah_index.json`` was a single 58 MB file that repeated the
full English verse on every one of its 223,408 phrase entries — 5,846 verses
duplicated ~38x, roughly 36 MB of pure redundancy. Every user who ticked
"Search" downloaded all of it, uncompressed, before seeing a single result.

This script rewrites it as:

    public/gematria-data/manifest.json   tiny  — shard map + counts
    public/gematria-data/verses.json     ~3 MB — each verse exactly once
    public/gematria-data/idx/<n>.json    small — values [n*100, n*100+99]

so a lookup pulls one shard (tens of KB) instead of the whole corpus. Verse text
is fetched lazily and only for the results actually on screen.

This supersedes build_index.py and build_torah_text.py — it is the single
pipeline for the Gematria dataset.

    # fetch fresh from Sefaria (default)
    python3 backend_tools/build_gematria_data.py

    # rebuild from the pre-2024 torah_index.json / torah_text.json pair,
    # if you still have them lying around
    python3 backend_tools/build_gematria_data.py --source legacy

The generated files are committed to the repo, so a deploy does not need to
run this or reach Sefaria.
"""

import argparse
import json
import os
import re
import shutil
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sefaria_clean import (
    clean_english, clean_hebrew_display, clean_hebrew_plain, repair_footnotes,
)

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
PUBLIC = os.path.join(ROOT, "public")
OUT = os.path.join(PUBLIC, "gematria-data")

SHARD_SIZE = 100  # values per shard file
MAX_PHRASE_LENGTH = 3  # sliding window width, matches the original index

GEMATRIA = {
    "א": 1, "ב": 2, "ג": 3, "ד": 4, "ה": 5, "ו": 6, "ז": 7, "ח": 8, "ט": 9,
    "י": 10, "כ": 20, "ל": 30, "מ": 40, "נ": 50, "ס": 60, "ע": 70, "פ": 80, "צ": 90,
    "ק": 100, "ר": 200, "ש": 300, "ת": 400,
    "ך": 20, "ם": 40, "ן": 50, "ף": 80, "ץ": 90,
}

BOOK_ORDER = ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"]


BOOK_CHAPTERS = {
    "Genesis": 50, "Exodus": 40, "Leviticus": 27, "Numbers": 36, "Deuteronomy": 34,
}


def value_of(text):
    return sum(GEMATRIA.get(c, 0) for c in re.sub(r"[^א-ת]", "", text or ""))


def _get(url, attempts=5):
    import requests

    for attempt in range(attempts):
        try:
            response = requests.get(url, timeout=30)
            if response.status_code == 200:
                return response.json()
        except Exception:  # noqa: BLE001 — retry on anything transient
            pass
        time.sleep(2 ** attempt)
    raise RuntimeError(f"Could not fetch {url}")


def read_from_sefaria():
    """Fetch Hebrew + English chapter by chapter, cleaning as we go."""
    verses_raw = []
    english = {}
    notes = {}

    for book, chapters in BOOK_CHAPTERS.items():
        print(f"  {book} ", end="", flush=True)
        for chapter in range(1, chapters + 1):
            data = _get(f"https://www.sefaria.org/api/texts/{book}.{chapter}?context=0")
            he_chapter = data.get("he") or []
            en_chapter = data.get("text") or []
            for i, he_verse in enumerate(he_chapter):
                ref = f"{book} {chapter}:{i + 1}"
                verses_raw.append({"b": book, "r": ref, "o": he_verse})
                raw_en = en_chapter[i] if i < len(en_chapter) else ""
                # Markup is intact here, so footnotes come out cleanly.
                clean, fn = clean_english(raw_en, has_markup=True)
                english[ref] = clean
                if fn:
                    notes[ref] = fn
            sys.stdout.write(".")
            sys.stdout.flush()
        print()

    return verses_raw, english, notes


def read_from_legacy():
    """Rebuild from the old torah_index.json / torah_text.json pair."""
    with open(os.path.join(PUBLIC, "torah_text.json"), encoding="utf-8") as f:
        torah_text = json.load(f)
    with open(os.path.join(PUBLIC, "torah_index.json"), encoding="utf-8") as f:
        legacy = json.load(f)

    english = {}
    notes = {}
    for entries in legacy.values():
        for it in entries:
            ref = it["ref"]
            if ref in english:
                continue
            # The markup is long gone from this file, so reconstruct the split.
            clean, fn = repair_footnotes(it.get("context_en", "") or "")
            english[ref] = clean
            if fn:
                notes[ref] = fn

    return torah_text, english, notes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source", choices=("sefaria", "legacy"), default="sefaria",
        help="where to read the text from (default: sefaria)",
    )
    args = parser.parse_args()

    # ── 1. Read the source text ─────────────────────────────────────────────
    if args.source == "legacy":
        print("Reading legacy torah_index.json / torah_text.json…")
        torah_text, english, notes = read_from_legacy()
    else:
        print("Fetching from Sefaria…")
        torah_text, english, notes = read_from_sefaria()

    resolved = sum(1 for v in english.values() if "*" not in v)
    print(f"  {len(english)} verses, {resolved} free of footnote artefacts")

    # ── 2. Verse table — every verse exactly once ───────────────────────────
    #
    # The legacy `t` field kept Sefaria's {פ}/{ס} paragraph markers as bare
    # words, so 662 verses carried a phantom +80/+60 in their gematria and the
    # markers themselves were indexed as one-letter "phrases". Deriving the
    # plain text from the cleaned display form drops them.
    print("Building verse table…")
    verses = []
    plain_text = []
    for v in torah_text:
        display = clean_hebrew_display(v.get("o") or v.get("t", ""))
        plain = clean_hebrew_plain(display)
        plain_text.append(plain)
        verses.append([
            v["r"],                     # 0 reference
            display,                    # 1 Hebrew with nikud, markup stripped
            english.get(v["r"], ""),    # 2 English
            BOOK_ORDER.index(v["b"]),   # 3 book ordinal
            value_of(plain),            # 4 gematria of the whole verse
            notes.get(v["r"], []),      # 5 extracted footnotes (usually empty)
        ])
    print(f"  {len(verses)} verses")

    # ── 3. Value index — regenerated from the cleaned text ──────────────────
    #
    # Built fresh rather than transcribed from the legacy index, so none of the
    # marker pollution above survives. Same 3-word sliding window as before.
    print("Building value index…")
    phrases = {}   # value -> phrase -> [verseIdx, ...]
    whole = {}     # value -> [verseIdx, ...]

    for idx, plain in enumerate(plain_text):
        verse_val = verses[idx][4]
        if verse_val > 0:
            whole.setdefault(verse_val, []).append(idx)

        words = plain.split()
        for i in range(len(words)):
            for j in range(i, min(i + MAX_PHRASE_LENGTH, len(words))):
                phrase = " ".join(words[i:j + 1])
                val = value_of(phrase)
                if val <= 0:
                    continue
                occ = phrases.setdefault(val, {}).setdefault(phrase, [])
                if not occ or occ[-1] != idx:
                    occ.append(idx)

    # ── 4. Rank: single words first, then by how often they occur ───────────
    def rank_key(item):
        phrase, occurrences = item
        words = phrase.count(" ") + 1
        return (words, -len(occurrences), phrase)

    values = sorted(set(list(phrases.keys()) + list(whole.keys())))
    shards = {}
    for value in values:
        ranked = sorted(phrases.get(value, {}).items(), key=rank_key)
        payload = {}
        if ranked:
            payload["p"] = [[p, occ] for p, occ in ranked]
        if value in whole:
            payload["v"] = sorted(set(whole[value]))
        shards.setdefault(value // SHARD_SIZE, {})[str(value)] = payload

    # ── 5. Write ────────────────────────────────────────────────────────────
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, "idx"), exist_ok=True)

    def write(path, data):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        return os.path.getsize(path)

    verses_bytes = write(os.path.join(OUT, "verses.json"), verses)

    shard_sizes = {}
    total_shard_bytes = 0
    for shard_id, data in sorted(shards.items()):
        size = write(os.path.join(OUT, "idx", f"{shard_id}.json"), data)
        shard_sizes[str(shard_id)] = size
        total_shard_bytes += size

    total_phrases = sum(len(b) for b in phrases.values())
    total_occurrences = sum(len(o) for b in phrases.values() for o in b.values())

    manifest = {
        "shardSize": SHARD_SIZE,
        "shards": sorted(int(s) for s in shard_sizes),
        "verseCount": len(verses),
        "valueCount": len(values),
        "minValue": values[0] if values else 0,
        "maxValue": values[-1] if values else 0,
        "uniquePhrases": total_phrases,
        "phraseOccurrences": total_occurrences,
    }
    manifest_bytes = write(os.path.join(OUT, "manifest.json"), manifest)

    legacy_path = os.path.join(PUBLIC, "torah_index.json")
    legacy_bytes = os.path.getsize(legacy_path) if os.path.exists(legacy_path) else 0
    new_bytes = verses_bytes + total_shard_bytes + manifest_bytes

    def mb(b):
        return f"{b / 1_000_000:.1f} MB"

    print()
    print("── Result ──────────────────────────────────")
    if legacy_bytes:
        print(f"  legacy torah_index.json : {mb(legacy_bytes)}")
    print(f"  verses.json             : {mb(verses_bytes)}")
    print(f"  {len(shard_sizes)} shards            : {mb(total_shard_bytes)}"
          f"  (largest {mb(max(shard_sizes.values()))})")
    print(f"  manifest.json           : {manifest_bytes / 1000:.0f} KB")
    saving = f"   ({100 - new_bytes * 100 // legacy_bytes}% smaller)" if legacy_bytes else ""
    print(f"  TOTAL                   : {mb(new_bytes)}{saving}")
    print(f"  unique phrases          : {total_phrases:,}"
          f" (from {total_occurrences:,} occurrences)")
    print("────────────────────────────────────────────")
    print("Typical first search now downloads verses.json + one shard.")


if __name__ == "__main__":
    main()
