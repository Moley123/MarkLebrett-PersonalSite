import { parshaStatsFor } from './useSearch';

describe('parshaStatsFor', () => {
  it('finds Parshiyot whose verse count equals the value', () => {
    // Noach has 153 verses.
    const stats = parshaStatsFor(153);
    expect(stats.map((s) => s.name)).toContain('Noach');
  });

  it('respects the Parsha filter', () => {
    // Filtering to Bereshit must not keep showing Noach's structure match.
    expect(parshaStatsFor(153, 'Bereshit')).toEqual([]);
    expect(parshaStatsFor(153, 'Noach').map((s) => s.name)).toEqual(['Noach']);
  });

  it('returns nothing for a non-positive value', () => {
    expect(parshaStatsFor(0)).toEqual([]);
    expect(parshaStatsFor(-1)).toEqual([]);
    expect(parshaStatsFor(NaN)).toEqual([]);
  });
});
