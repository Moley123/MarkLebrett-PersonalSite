import { anagramsIn, letterKey, permutationCount, permutations } from './anagrams';
import {
  ATBACH, AVGAD, AYAK_BACHAR, TEMURAH_TABLES, allTemurot, applyFinalForms, applyTemurah,
} from './temurah';
import { hechrachi } from './methods';

describe('letterKey', () => {
  it('is order independent', () => {
    expect(letterKey('אבג')).toBe(letterKey('גבא'));
    expect(letterKey('אבג')).toBe(letterKey('בגא'));
  });

  it('folds final forms onto their base letter', () => {
    expect(letterKey('מלך')).toBe(letterKey('כלמ'));
  });

  it('ignores nikud and punctuation', () => {
    expect(letterKey('שָׁלוֹם!')).toBe(letterKey('שלום'));
  });

  it('separates genuinely different letter sets', () => {
    expect(letterKey('אבג')).not.toBe(letterKey('אבד'));
  });
});

describe('permutationCount', () => {
  it('is n! for distinct letters', () => {
    expect(permutationCount('אב')).toBe(2);
    expect(permutationCount('אבג')).toBe(6);
    expect(permutationCount('אבגד')).toBe(24);
  });

  it('divides out repeated letters', () => {
    // אאב -> 3!/2! = 3
    expect(permutationCount('אאב')).toBe(3);
    // אאבב -> 4!/(2!2!) = 6
    expect(permutationCount('אאבב')).toBe(6);
  });

  it('is 0 for empty input', () => {
    expect(permutationCount('')).toBe(0);
  });
});

describe('permutations', () => {
  it('lists every distinct ordering', () => {
    const { items, total, truncated } = permutations('אבג');
    expect(total).toBe(6);
    expect(items).toHaveLength(6);
    expect(new Set(items).size).toBe(6);
    expect(truncated).toBe(false);
  });

  it('does not repeat orderings when letters repeat', () => {
    const { items, total } = permutations('אאב');
    expect(total).toBe(3);
    expect(items).toHaveLength(3);
    expect(new Set(items).size).toBe(3);
  });

  it('respects the cap and reports truncation honestly', () => {
    const { items, total, truncated } = permutations('אבגדה', 10);
    expect(items).toHaveLength(10);
    expect(total).toBe(120);
    expect(truncated).toBe(true);
  });

  it('refuses to expand very long words', () => {
    const { items, truncated } = permutations('אבגדהוזחטי'); // 10 letters
    expect(items).toEqual([]);
    expect(truncated).toBe(true);
  });

  it('every permutation preserves the gematria value', () => {
    const { items } = permutations('שלום');
    const target = hechrachi('שלום');
    items.forEach((p) => expect(hechrachi(p)).toBe(target));
  });
});

describe('anagramsIn', () => {
  const bucket = {
    phrases: [
      { phrase: 'רעש', count: 3, occurrences: [] },
      { phrase: 'שער', count: 9, occurrences: [] },
      { phrase: 'ערש', count: 1, occurrences: [] },
      { phrase: 'שרע', count: 2, occurrences: [] },
      { phrase: 'אבגד', count: 5, occurrences: [] }, // different letters
    ],
  };

  it('keeps only true rearrangements', () => {
    const found = anagramsIn('שער', bucket).map((a) => a.phrase);
    expect(found).toContain('רעש');
    expect(found).toContain('ערש');
    expect(found).not.toContain('אבגד');
  });

  it('excludes the word itself by default', () => {
    expect(anagramsIn('שער', bucket).map((a) => a.phrase)).not.toContain('שער');
    expect(anagramsIn('שער', bucket, true).map((a) => a.phrase)).toContain('שער');
  });

  it('orders by how often each appears', () => {
    const counts = anagramsIn('שער', bucket).map((a) => a.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('is safe with no bucket', () => {
    expect(anagramsIn('שער', null)).toEqual([]);
    expect(anagramsIn('', bucket)).toEqual([]);
  });
});

describe('temurah tables', () => {
  it('Avgad steps forward and wraps', () => {
    expect(AVGAD['א']).toBe('ב');
    expect(AVGAD['ת']).toBe('א');
  });

  it('Atbach is the inverse of Avgad', () => {
    Object.entries(AVGAD).forEach(([from, to]) => {
      expect(ATBACH[to]).toBe(from);
    });
  });

  it('Ayak Bachar cycles each column of the 27 letters', () => {
    expect(AYAK_BACHAR['א']).toBe('י');
    expect(AYAK_BACHAR['י']).toBe('ק');
    expect(AYAK_BACHAR['ק']).toBe('א');
    expect(AYAK_BACHAR['ט']).toBe('צ');
    expect(AYAK_BACHAR['צ']).toBe('ץ');
    expect(AYAK_BACHAR['ץ']).toBe('ט');
  });

  it('Ayak Bachar covers all 27 letters', () => {
    expect(Object.keys(AYAK_BACHAR)).toHaveLength(27);
  });

  it('applying a table three times returns Ayak Bachar to the start', () => {
    const entry = TEMURAH_TABLES.find((t) => t.key === 'ayakBachar');
    const once = applyTemurah('אבג', entry);
    const thrice = applyTemurah(applyTemurah(once, entry), entry);
    expect(thrice).toBe('אבג');
  });

  it('AtBash applied twice is the identity', () => {
    const entry = TEMURAH_TABLES.find((t) => t.key === 'atbash');
    expect(applyTemurah(applyTemurah('שלום', entry), entry)).toBe('שלום');
  });

  it('preserves word boundaries', () => {
    const entry = TEMURAH_TABLES.find((t) => t.key === 'atbash');
    expect(applyTemurah('מזל טוב', entry)).toContain(' ');
  });

  it('turns בבל into ששך under AtBash, with the final kaf', () => {
    // Jeremiah 25:26 spells it ששך — the final form matters.
    const entry = TEMURAH_TABLES.find((t) => t.key === 'atbash');
    expect(applyTemurah('בבל', entry)).toBe('ששך');
  });

  it('puts final forms at the end of a word', () => {
    expect(applyFinalForms('שלומ')).toBe('שלום');
    expect(applyFinalForms('מלכ')).toBe('מלך');
    expect(applyFinalForms('מזל טובמ')).toBe('מזל טובם');
  });

  it('folds final forms found mid-word back to their base', () => {
    // Ayak Bachar maps onto the finals, so it can emit ן mid-word.
    expect(applyFinalForms('גןב')).toBe('גנב');
    expect(applyFinalForms('םים')).toBe('מים');
  });

  it('never leaves a final form anywhere but the last position', () => {
    const entry = TEMURAH_TABLES.find((t) => t.key === 'ayakBachar');
    ['שער', 'בראשית', 'מזל טוב', 'אלהים'].forEach((word) => {
      applyTemurah(word, entry).split(' ').forEach((w) => {
        const body = w.slice(0, -1);
        expect(body).not.toMatch(/[ךםןףץ]/);
      });
    });
  });

  it('allTemurot returns one row per table', () => {
    const rows = allTemurot('שלום');
    expect(rows).toHaveLength(TEMURAH_TABLES.length);
    rows.forEach((r) => expect(r.result).toMatch(/[א-ת]/));
  });

  it('allTemurot is empty for empty input', () => {
    expect(allTemurot('')).toEqual([]);
    expect(allTemurot('hello')).toEqual([]);
  });
});
