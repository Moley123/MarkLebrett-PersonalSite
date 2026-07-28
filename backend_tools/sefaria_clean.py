"""
Shared text-cleaning helpers for the Sefaria-derived Gematria data.

Historically each builder rolled its own regex, which is how raw ``<big>`` /
``<span>`` markup and duplicated footnote text ended up baked into
``torah_index.json``. Everything now goes through this module.

Two distinct Hebrew cleaners:

  * ``clean_hebrew_display`` — strips markup but KEEPS nikud and cantillation.
    Use for anything shown to the reader.
  * ``clean_hebrew_plain``   — strips markup, nikud, cantillation and
    punctuation, and normalises maqaf to a space. Use for matching/indexing.
"""

import html
import re

# ── Prefixes ────────────────────────────────────────────────────────────────
# Canonical list, shared by the Trend Tracker, Word Race and the builders.
# Previously the frontend list omitted ה (the definite article) entirely,
# which systematically under-counted every definite noun.
VALID_PREFIXES = [
    # single letters
    "ו", "ה", "ב", "כ", "ל", "מ", "ש",
    # vav + X
    "וה", "וב", "וכ", "ול", "ומ", "וש",
    # she + X
    "שב", "שה", "שכ", "של", "שמ",
    # X + he (preposition + definite article)
    "בה", "כה", "לה", "מה",
    # misc compounds
    "כש", "מש", "בש", "ובה", "ולה", "וכה", "ומה",
]

# ── HTML ────────────────────────────────────────────────────────────────────

_FOOTNOTE_EL = re.compile(
    r'<(sup|i)\b[^>]*class="[^"]*footnote[^"]*"[^>]*>.*?</\1>',
    re.IGNORECASE | re.DOTALL,
)
_TAG = re.compile(r"<[^>]+>")
_WS = re.compile(r"\s+")


def strip_html(text, drop_footnotes=False):
    """Remove markup and decode entities.

    ``drop_footnotes`` removes footnote elements *including their contents*.
    The old ``clean_html`` only removed the tags, so the footnote body was
    left inline — the source of the duplicated ``create*When God began to
    create`` artefacts.
    """
    if not text:
        return ""
    if drop_footnotes:
        text = _FOOTNOTE_EL.sub("", text)
    text = _TAG.sub("", text)
    text = html.unescape(text)
    text = text.replace(" ", " ")
    return _WS.sub(" ", text).strip()


# ── Hebrew ──────────────────────────────────────────────────────────────────

MAQAF = "־"
_NIKUD = re.compile(r"[֑-ׇ]")
_NON_HEBREW = re.compile(r"[^א-ת\s]")


def clean_hebrew_display(text):
    """Reader-facing Hebrew: markup gone, vowels and cantillation kept."""
    if not text:
        return ""
    text = strip_html(text)
    # Sefaria marks open/closed paragraphs with {פ} / {ס} braces — noise here.
    text = re.sub(r"\{[פסש]\}", "", text)
    return _WS.sub(" ", text).strip()


def clean_hebrew_plain(text):
    """Matching-facing Hebrew: letters and spaces only."""
    if not text:
        return ""
    text = strip_html(text)
    text = text.replace(MAQAF, " ").replace("-", " ")
    text = _NIKUD.sub("", text)
    text = _NON_HEBREW.sub(" ", text)
    return _WS.sub(" ", text).strip()


# ── English footnotes ───────────────────────────────────────────────────────
#
# When the source markup is available, ``strip_html(..., drop_footnotes=True)``
# removes footnotes cleanly. The already-built index no longer has the markup,
# so ``repair_footnotes`` reconstructs the split from the flattened text.
#
# Sefaria's flattened form is:  ``<lemma>*<lemma> <explanation><main text>``
# The lemma repeat pins the start exactly. The end is found by locating the
# first sentence terminator that is followed by a *lowercase* continuation or
# an em-dash — i.e. where the verse resumes mid-sentence — while skipping the
# abbreviations that pepper JPS notes.

_ABBREV = {
    "lit.", "cf.", "v.", "vv.", "ch.", "chs.", "heb.", "aram.", "akk.", "ugar.",
    "gen.", "exod.", "ex.", "lev.", "num.", "deut.", "josh.", "judg.", "sam.",
    "kgs.", "isa.", "jer.", "ezek.", "hos.", "obad.", "mic.", "nah.", "hab.",
    "zeph.", "hag.", "zech.", "mal.", "ps.", "pss.", "prov.", "eccl.", "lam.",
    "esth.", "dan.", "neh.", "chron.", "trad.", "i.e.", "e.g.", "etc.",
    "sept.", "targ.", "syr.", "vulg.", "ms.", "mss.", "mt.", "sing.", "pl.",
    "masc.", "fem.", "st.", "approx.", "no.", "nos.", "pp.", "p.",
}

_TERMINATOR = re.compile(r'[.!?]["”\'’)\]]?\s+')
_RESUMES = re.compile(r'[a-z—–-]')


def _find_footnote_end(text, start):
    """Index just past the footnote body, or None if it can't be pinned down."""
    for m in _TERMINATOR.finditer(text, start):
        end = m.end()
        if end >= len(text):
            return None
        if not _RESUMES.match(text[end]):
            continue
        # Guard against abbreviations ("cf. v. 18") and numeric refs ("32.7").
        head = text[start:m.start() + 1]
        last = head.rsplit(" ", 1)[-1].lower()
        if last in _ABBREV:
            continue
        if re.search(r"\d$", head) and text[end].isdigit():
            continue
        return end
    return None


def repair_footnotes(text):
    """Split flattened Sefaria English into ``(clean_text, [footnotes])``.

    Falls back to returning the input untouched when the footnote boundary
    cannot be determined confidently — better a little noise than a mangled
    verse.
    """
    if not text or "*" not in text:
        return text, []

    notes = []
    out = text
    guard = 0

    while "*" in out and guard < 8:
        guard += 1
        star = out.index("*")
        before, after = out[:star], out[star + 1:]

        # A leading '*' is a verse-level note with no lemma to anchor on.
        if star == 0:
            end = _find_footnote_end(after, 0)
            if end is None:
                return out, notes
            notes.append(after[:end].strip())
            out = after[end:].lstrip()
            continue

        # The footnote opens by repeating the words just before the '*'.
        lemma = None
        words = before.rstrip().split(" ")
        for n in range(min(8, len(words)), 0, -1):
            candidate = " ".join(words[-n:]).strip(" ,;:—-“”\"'’")
            if candidate and after.startswith(candidate):
                lemma = candidate
                break

        if lemma is None:
            # Not the known pattern — leave this marker alone and stop.
            return out, notes

        body_start = len(lemma)
        end = _find_footnote_end(after, body_start)
        if end is None:
            return out, notes

        notes.append(after[body_start:end].strip())
        # The terminator regex swallows the trailing whitespace, so re-insert a
        # separator rather than fusing "forbidden" onto "for you".
        tail = after[end:]
        if before and not before[-1].isspace() and tail and not tail[0].isspace():
            out = before + " " + tail
        else:
            out = before + tail

    return _WS.sub(" ", out).strip(), notes


def clean_english(text, has_markup=False):
    """Normalise an English verse, removing footnotes where possible."""
    if not text:
        return "", []
    if has_markup:
        return strip_html(text, drop_footnotes=True), []
    return repair_footnotes(strip_html(text))
