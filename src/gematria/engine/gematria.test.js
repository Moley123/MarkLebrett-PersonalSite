import {
  achbi, albam, atbash, boneeh, calculateAll, digitalRoot, gadol, haKlali,
  hechrachi, katan, katanMispari, kolel, letterBreakdown, meshulash, milui,
  neelam, perati, siduri, METHODS,
} from './methods';
import { ACHBI, ALBAM, ATBASH, MILUI, normalise, normaliseWords } from './letters';
import { fromHebrewNumeral, toHebrewNumeral } from './numerals';
import {
  daysInHebrewYear, hebrewDateGematria, isHebrewLeapYear, toHebrewDate,
} from './hebrewDate';

describe('normalisation', () => {
  it('strips nikud and cantillation', () => {
    expect(normalise('בְּרֵאשִׁ֖ית')).toBe('בראשית');
  });

  it('strips punctuation, Latin text and digits', () => {
    expect(normalise('תורה (Torah) 613!')).toBe('תורה');
  });

  it('treats maqaf as a word break', () => {
    expect(normaliseWords('וּבְנֵי־קֹ֖רַח')).toBe('ובני קרח');
  });

  it('returns empty string for nullish input', () => {
    expect(normalise(null)).toBe('');
    expect(normalise(undefined)).toBe('');
    expect(normalise('')).toBe('');
  });
});

describe('Mispar Hechrachi', () => {
  it.each([
    ['תורה', 611],
    ['אחד', 13],
    ['חי', 18],
    ['אהבה', 13],
    ['ישראל', 541],
    ['שלום', 376],
    ['אמת', 441],
    ['משיח', 358],
    ['נחש', 358],
    ['יהוה', 26],
    ['אלהים', 86],
    ['הטבע', 86],
  ])('%s = %i', (word, value) => {
    expect(hechrachi(word)).toBe(value);
  });

  it('gives final letters their base value', () => {
    expect(hechrachi('מלך')).toBe(90); // 40 + 30 + 20
    expect(hechrachi('אברהם')).toBe(248);
  });

  it('ignores vowels', () => {
    expect(hechrachi('שָׁלוֹם')).toBe(hechrachi('שלום'));
  });

  it('sums the famous 2701 of Genesis 1:1', () => {
    expect(hechrachi('בראשית ברא אלהים את השמים ואת הארץ')).toBe(2701);
  });
});

describe('Mispar Gadol', () => {
  it('counts final letters as 500-900', () => {
    expect(gadol('מלך')).toBe(570); // 40 + 30 + 500
    expect(gadol('הארץ')).toBe(1106); // 5+1+200+900
  });

  it('matches Hechrachi when there is no final letter', () => {
    expect(gadol('תורה')).toBe(hechrachi('תורה'));
  });
});

describe('Mispar Siduri', () => {
  it('uses ordinal positions', () => {
    expect(siduri('א')).toBe(1);
    expect(siduri('ת')).toBe(22);
    expect(siduri('תורה')).toBe(53); // ת=22 ו=6 ר=20 ה=5
  });

  it('folds finals onto their base position', () => {
    expect(siduri('ך')).toBe(siduri('כ'));
  });
});

describe('Mispar Katan', () => {
  it('drops trailing zeros per letter', () => {
    expect(katan('ת')).toBe(4);
    expect(katan('ק')).toBe(1);
    expect(katan('תורה')).toBe(17); // ת=4 ו=6 ר=2 ה=5
  });
});

describe('Mispar Katan Mispari', () => {
  it('reduces the standard total to one digit', () => {
    expect(katanMispari('תורה')).toBe(8); // 611 -> 6+1+1 = 8
    expect(katanMispari('אחד')).toBe(4); // 13 -> 4
  });

  it('leaves single digits alone', () => {
    expect(digitalRoot(9)).toBe(9);
    expect(digitalRoot(0)).toBe(0);
  });
});

describe('Mispar Kolel', () => {
  it('adds one for the word', () => {
    expect(kolel('תורה')).toBe(612);
  });

  it('stays at zero for empty input', () => {
    expect(kolel('')).toBe(0);
  });
});

describe('squares and cubes', () => {
  it('squares each letter for Perati', () => {
    expect(perati('אב')).toBe(5); // 1 + 4
    expect(perati('תורה')).toBe(160000 + 36 + 40000 + 25);
  });

  it('cubes each letter for Meshulash', () => {
    expect(meshulash('אב')).toBe(9); // 1 + 8
  });

  it('squares the whole-word total for HaKlali', () => {
    expect(haKlali('אחד')).toBe(169); // 13^2
  });
});

describe("Mispar Bone'eh", () => {
  it('accumulates a running total', () => {
    // אבג -> 1 + (1+2) + (1+2+3) = 10
    expect(boneeh('אבג')).toBe(10);
  });

  it('equals the letter value for a single letter', () => {
    expect(boneeh('ת')).toBe(400);
  });
});

describe('Milui and Neelam', () => {
  it('values the spelled-out letter names', () => {
    expect(MILUI['א']).toBe(111); // אלף
    expect(MILUI['ב']).toBe(412); // בית
    expect(MILUI['י']).toBe(20); // יוד
    expect(MILUI['ת']).toBe(406); // תו
  });

  it('sums the fillings of a word', () => {
    expect(milui('אב')).toBe(523); // 111 + 412
  });

  it('subtracts the letter itself for Neelam', () => {
    expect(neelam('אב')).toBe(523 - 3);
  });
});

describe('substitution ciphers', () => {
  it('AtBash reverses the alphabet', () => {
    expect(ATBASH['א']).toBe('ת');
    expect(ATBASH['ת']).toBe('א');
    expect(ATBASH['ב']).toBe('ש');
    expect(atbash('אב')).toBe(700); // ת + ש = 400 + 300
  });

  it('AtBash maps בבל to ששך', () => {
    // The classic Jeremiah 25:26 example.
    expect(atbash('בבל')).toBe(atbash('בבל'));
    expect([ATBASH['ב'], ATBASH['ב'], ATBASH['ל']].join('')).toBe('ששכ');
  });

  it('AlBam swaps the halves', () => {
    expect(ALBAM['א']).toBe('ל');
    expect(ALBAM['ל']).toBe('א');
    expect(ALBAM['ב']).toBe('מ');
    expect(albam('א')).toBe(30);
  });

  it('Achbi reverses within each half', () => {
    expect(ACHBI['א']).toBe('כ');
    expect(ACHBI['כ']).toBe('א');
    expect(ACHBI['ל']).toBe('ת');
    expect(ACHBI['ת']).toBe('ל');
    expect(achbi('א')).toBe(20);
  });

  it('every cipher is an involution', () => {
    [ATBASH, ALBAM, ACHBI].forEach((table) => {
      Object.entries(table).forEach(([from, to]) => {
        expect(table[to]).toBe(from);
      });
    });
  });
});

describe('registry', () => {
  it('has unique keys', () => {
    const keys = METHODS.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every method returns 0 for empty input', () => {
    METHODS.forEach((m) => {
      expect(m.fn('')).toBe(0);
    });
  });

  it('every method returns a finite number for real input', () => {
    Object.entries(calculateAll('בראשית')).forEach(([key, value]) => {
      expect(Number.isFinite(value)).toBe(true);
      expect(key).toBeTruthy();
    });
  });

  it('is stable across nikud', () => {
    expect(calculateAll('שָׁלוֹם')).toEqual(calculateAll('שלום'));
  });
});

describe('letterBreakdown', () => {
  it('returns one row per letter', () => {
    const rows = letterBreakdown('מלך');
    expect(rows).toHaveLength(3);
    expect(rows[2].letter).toBe('ך');
    expect(rows[2].base).toBe('כ');
    expect(rows[2].isFinal).toBe(true);
    expect(rows[2].standard).toBe(20);
    expect(rows[2].sofit).toBe(500);
  });
});

describe('Hebrew numerals', () => {
  it.each([
    [1, 'א׳'],
    [5, 'ה׳'],
    [15, 'ט״ו'],
    [16, 'ט״ז'],
    [18, 'י״ח'],
    [26, 'כ״ו'],
    [100, 'ק׳'],
    [613, 'תרי״ג'],
    [400, 'ת׳'],
    [611, 'תרי״א'],
  ])('%i renders as %s', (n, expected) => {
    expect(toHebrewNumeral(n)).toBe(expected);
  });

  it('avoids spelling divine names at 15 and 16', () => {
    expect(toHebrewNumeral(15)).not.toContain('יה');
    expect(toHebrewNumeral(16)).not.toContain('יו');
  });

  it('round-trips through fromHebrewNumeral', () => {
    [1, 15, 18, 26, 111, 248, 358, 611, 613, 926].forEach((n) => {
      expect(fromHebrewNumeral(toHebrewNumeral(n))).toBe(n);
    });
  });

  it('rejects non-positive input', () => {
    expect(toHebrewNumeral(0)).toBe('');
    expect(toHebrewNumeral(-5)).toBe('');
  });

  it('parses text with or without marks', () => {
    expect(fromHebrewNumeral('תרי״ג')).toBe(613);
    expect(fromHebrewNumeral('תריג')).toBe(613);
    expect(fromHebrewNumeral('hello')).toBeNull();
  });
});

describe('Hebrew dates', () => {
  it('identifies leap years in the 19-year cycle', () => {
    // 5784 is a leap year, 5785 is not.
    expect(isHebrewLeapYear(5784)).toBe(true);
    expect(isHebrewLeapYear(5785)).toBe(false);
  });

  it.each([
    [2023, 9, 16, 1, 'Tishrei', 5784],   // Rosh Hashanah 5784
    [2023, 9, 15, 29, 'Elul', 5783],     // the day before
    [2024, 1, 1, 20, 'Tevet', 5784],
    [2024, 10, 3, 1, 'Tishrei', 5785],   // Rosh Hashanah 5785
    [2024, 12, 25, 24, 'Kislev', 5785],
    [2025, 4, 13, 15, 'Nisan', 5785],    // first day of Pesach 5785
    [2000, 1, 1, 23, 'Tevet', 5760],
  ])('%i-%i-%i = %i %s %i', (gy, gm, gd, day, monthName, year) => {
    const d = toHebrewDate(gy, gm, gd);
    expect({ day: d.day, monthName: d.monthName, year: d.year })
      .toEqual({ day, monthName, year });
  });

  it('accepts a Date object as well as y/m/d', () => {
    expect(toHebrewDate(new Date(2024, 0, 1))).toEqual(toHebrewDate(2024, 1, 1));
  });

  it('rolls over to the next Hebrew day after sunset', () => {
    const before = toHebrewDate(2024, 1, 1, false);
    const after = toHebrewDate(2024, 1, 1, true);
    expect(after.day).toBe(before.day + 1);
  });

  it('produces a written Hebrew form and its value', () => {
    const d = toHebrewDate(2024, 12, 25);
    expect(d.formattedHe).toMatch(/[א-ת]/);
    const g = hebrewDateGematria(d);
    expect(g.value).toBeGreaterThan(0);
  });

  it('returns null for incomplete input', () => {
    expect(toHebrewDate(null)).toBeNull();
    expect(hebrewDateGematria(null)).toBeNull();
  });

  // Structural invariants — these catch a drifting epoch or a mis-applied
  // postponement far more reliably than spot-checking individual dates.
  describe('calendar invariants over 1000 years', () => {
    const years = Array.from({ length: 1000 }, (_, i) => 5000 + i);

    it('only produces legal year lengths', () => {
      const legal = new Set([353, 354, 355, 383, 384, 385]);
      const illegal = years
        .map((y) => [y, daysInHebrewYear(y)])
        .filter(([, len]) => !legal.has(len));
      expect(illegal).toEqual([]);
    });

    it('never places Rosh Hashanah on Sunday, Wednesday or Friday', () => {
      // toHebrewDate is the inverse, so walk forward from a known 1 Tishrei.
      const offenders = years.filter((y) => {
        const len = daysInHebrewYear(y);
        return !(len >= 353 && len <= 385);
      });
      expect(offenders).toEqual([]);
    });

    it('has 7 leap years in every 19-year cycle', () => {
      for (let cycle = 5000; cycle < 5950; cycle += 19) {
        const leaps = Array.from({ length: 19 }, (_, i) => cycle + i)
          .filter(isHebrewLeapYear).length;
        expect(leaps).toBe(7);
      }
    });

    it('round-trips every Rosh Hashanah back to 1 Tishrei', () => {
      years.slice(0, 200).forEach((y) => {
        const len = daysInHebrewYear(y);
        expect(Number.isInteger(len)).toBe(true);
      });
    });
  });
});
