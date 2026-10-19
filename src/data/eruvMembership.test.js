import {
  resolveMembership,
  describeMembership,
  membershipMessage,
  UNRELIABLE_BOUNDARIES,
} from './eruvMembership';

const GG = 'Golders Green Eruv';
const NWL = 'NW London Eruv';
const BP = 'Brondesbury Park Eruv';
const SH = 'South Hampstead Eruv';

describe('resolveMembership', () => {
  it('passes through nothing and one', () => {
    expect(resolveMembership([])).toEqual([]);
    expect(resolveMembership([GG])).toEqual([GG]);
  });

  it('keeps every trustworthy match', () => {
    expect(resolveMembership([GG, NWL])).toEqual([GG, NWL]);
    expect(resolveMembership([GG, NWL, BP])).toEqual([GG, NWL, BP]);
  });

  it('preserves the order it was given', () => {
    expect(resolveMembership([NWL, GG])).toEqual([NWL, GG]);
  });

  it('drops South Hampstead when a verified boundary also matches', () => {
    // Its ring overlaps Brondesbury Park's, so reporting both would claim a
    // joint membership that the real eruv does not have.
    expect(resolveMembership([BP, SH])).toEqual([BP]);
    expect(resolveMembership([SH, BP])).toEqual([BP]);
    expect(resolveMembership([GG, NWL, SH])).toEqual([GG, NWL]);
  });

  it('still reports South Hampstead when it is the only match', () => {
    // Saying nothing would be worse than saying something provisional.
    expect(resolveMembership([SH])).toEqual([SH]);
  });

  it('falls back to the raw list if every match is unreliable', () => {
    expect(resolveMembership([SH, 'Another Bad Eruv'], [SH, 'Another Bad Eruv']))
      .toEqual([SH, 'Another Bad Eruv']);
  });

  it('takes an overridable unreliable list', () => {
    expect(resolveMembership([GG, NWL], [GG])).toEqual([NWL]);
  });

  it('survives bad input', () => {
    expect(resolveMembership(null)).toEqual([]);
    expect(resolveMembership(undefined)).toEqual([]);
  });

  it('names South Hampstead as the unreliable one', () => {
    expect(UNRELIABLE_BOUNDARIES).toContain(SH);
  });
});

describe('describeMembership', () => {
  it('formats a list the way a person would say it', () => {
    expect(describeMembership([GG])).toBe(GG);
    expect(describeMembership([GG, NWL])).toBe(`${GG} and ${NWL}`);
    expect(describeMembership([GG, NWL, BP])).toBe(`${GG}, ${NWL} and ${BP}`);
  });

  it('is empty for nothing', () => {
    expect(describeMembership([])).toBe('');
    expect(describeMembership(null)).toBe('');
  });
});

describe('membershipMessage', () => {
  it('is null when the address is in none of them', () => {
    expect(membershipMessage([])).toBeNull();
  });

  it('reads naturally for a single eruv', () => {
    expect(membershipMessage([GG])).toBe('Inside Golders Green Eruv!');
  });

  it('calls out the overlap for two', () => {
    expect(membershipMessage([GG, NWL]))
      .toBe('Inside Golders Green Eruv and NW London Eruv — this address is covered by both.');
  });

  it('counts them when there are more than two', () => {
    expect(membershipMessage([GG, NWL, BP]))
      .toBe('Inside Golders Green Eruv, NW London Eruv and Brondesbury Park Eruv — this address is covered by all 3.');
  });

  it('applies the South Hampstead rule before counting', () => {
    // Two raw matches, but only one worth reporting — so no "both".
    expect(membershipMessage([BP, SH])).toBe('Inside Brondesbury Park Eruv!');
  });
});
