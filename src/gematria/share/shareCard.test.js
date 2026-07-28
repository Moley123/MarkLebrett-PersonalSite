import { canCopyImages, drawShareCard } from './shareCard';

/**
 * jsdom has no 2D canvas implementation and pulling in the native `canvas`
 * package purely for tests isn't worth it. This stub records everything the
 * renderer draws, which lets the tests assert on the actual content of the
 * card rather than merely that it didn't throw.
 */
function stubCanvas() {
  const texts = [];
  const calls = [];
  const ctx = new Proxy(
    {
      texts,
      calls,
      fillText: (text, x, y) => texts.push({ text: String(text), x, y }),
      measureText: (text) => ({ width: String(text).length * 20 }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      scale: () => {},
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        // Everything else (fillRect, arcTo, stroke, font, direction…) is a
        // no-op recorder so the renderer runs end to end.
        return typeof prop === 'string' ? () => calls.push(prop) : undefined;
      },
      set() { return true; },
    },
  );

  const original = window.HTMLCanvasElement.prototype.getContext;
  window.HTMLCanvasElement.prototype.getContext = () => ctx;
  return {
    ctx,
    restore: () => { window.HTMLCanvasElement.prototype.getContext = original; },
    drawn: () => texts.map((t) => t.text).join('\n'),
  };
}

const SAMPLE = {
  text: 'תורה',
  value: 611,
  numeral: 'תרי״א',
  methodName: 'Mispar Hechrachi',
  methods: [
    { label: 'Large', value: 611 },
    { label: 'Ordinal', value: 53 },
    { label: 'Reduced', value: 17 },
  ],
};

describe('drawShareCard', () => {
  let stub;
  beforeEach(() => { stub = stubCanvas(); });
  afterEach(() => stub.restore());

  it('produces a 1200x630 canvas at scale 1', () => {
    const canvas = drawShareCard(SAMPLE);
    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(630);
  });

  it('doubles the pixel dimensions at scale 2', () => {
    const canvas = drawShareCard(SAMPLE, 2);
    expect(canvas.width).toBe(2400);
    expect(canvas.height).toBe(1260);
  });

  it('draws the word, the value and the numeral', () => {
    drawShareCard(SAMPLE);
    const drawn = stub.drawn();
    expect(drawn).toContain('תורה');
    expect(drawn).toContain('611');
    expect(drawn).toContain('תרי״א');
  });

  it('labels the method and brands the footer', () => {
    drawShareCard(SAMPLE);
    const drawn = stub.drawn();
    expect(drawn).toContain('Mispar Hechrachi');
    expect(drawn).toContain('GEMATRIA EXPLORER');
    expect(drawn).toContain('marklebrett.co.uk/gematria');
  });

  it('includes the secondary method values', () => {
    drawShareCard(SAMPLE);
    const drawn = stub.drawn();
    expect(drawn).toContain('ORDINAL');
    expect(drawn).toContain('53');
  });

  it('caps the secondary method boxes at four', () => {
    const many = {
      ...SAMPLE,
      methods: Array.from({ length: 9 }, (_, i) => ({ label: `LBL${i}`, value: i })),
    };
    drawShareCard(many);
    const drawn = stub.drawn();
    expect(drawn).toContain('LBL0');
    expect(drawn).toContain('LBL3');
    expect(drawn).not.toContain('LBL4');
  });

  it('shrinks an over-long phrase to fit', () => {
    const long = { ...SAMPLE, text: 'בראשית ברא אלהים את השמים ואת הארץ' };
    expect(() => drawShareCard(long)).not.toThrow();
    expect(stub.drawn()).toContain(long.text);
  });

  it('survives missing optional fields', () => {
    expect(() => drawShareCard({ text: 'חי', value: 18 })).not.toThrow();
    expect(() => drawShareCard({ text: '', value: 0, methods: [] })).not.toThrow();
  });
});

describe('canCopyImages', () => {
  it('reports false when ClipboardItem is unavailable', () => {
    // jsdom provides neither ClipboardItem nor clipboard.write.
    expect(canCopyImages()).toBe(false);
  });
});
