/**
 * Renders a shareable result card to a canvas.
 *
 * Drawn with the plain Canvas 2D API rather than an HTML-to-image library:
 * it avoids a dependency, produces identical output across browsers, and the
 * card is a fixed layout that gains nothing from DOM rasterisation.
 *
 * Output is 1200x630 — the standard Open Graph ratio, so it also previews
 * correctly if the image is ever shared as a link.
 */

const W = 1200;
const H = 630;
const PAD = 72;

const FONT_LATIN = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_HE = '"Frank Ruhl Libre", "Times New Roman", "David", serif';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * @param {object} data
 * @param {string} data.text        the Hebrew word or phrase
 * @param {number} data.value       headline value
 * @param {string} data.numeral     Hebrew numeral form
 * @param {string} data.methodName  which method produced the value
 * @param {Array<{label:string,value:number}>} [data.methods] secondary values
 * @param {number} [scale=1]        2 for a retina-density export
 * @returns {HTMLCanvasElement}
 */
export function drawShareCard(data, scale = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // ── Background ──
  ctx.fillStyle = '#080b10';
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createLinearGradient(0, 0, W, H);
  glow.addColorStop(0, 'rgba(59, 130, 246, 0.16)');
  glow.addColorStop(0.55, 'rgba(99, 102, 241, 0.06)');
  glow.addColorStop(1, 'rgba(8, 11, 16, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
  ctx.lineWidth = 2;
  roundRect(ctx, 16, 16, W - 32, H - 32, 24);
  ctx.stroke();

  // ── Header ──
  ctx.textBaseline = 'top';
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = `700 20px ${FONT_LATIN}`;
  ctx.fillText('GEMATRIA EXPLORER', PAD, PAD - 8);

  ctx.fillStyle = '#3b82f6';
  ctx.font = `600 18px ${FONT_LATIN}`;
  ctx.textAlign = 'right';
  ctx.fillText(data.methodName || 'Mispar Hechrachi', W - PAD, PAD - 6);

  // ── The word ──
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';

  let heSize = 104;
  ctx.font = `700 ${heSize}px ${FONT_HE}`;
  // Shrink long phrases until they fit the content width.
  while (ctx.measureText(data.text).width > W - PAD * 2 && heSize > 40) {
    heSize -= 4;
    ctx.font = `700 ${heSize}px ${FONT_HE}`;
  }
  ctx.fillText(data.text, W - PAD, 150);

  // ── Value ──
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = `700 18px ${FONT_LATIN}`;
  ctx.fillText('VALUE', PAD, 300);

  const valueGradient = ctx.createLinearGradient(PAD, 320, PAD + 420, 440);
  valueGradient.addColorStop(0, '#ffffff');
  valueGradient.addColorStop(1, '#3b82f6');
  ctx.fillStyle = valueGradient;
  ctx.font = `800 130px ${FONT_LATIN}`;
  ctx.fillText(String(data.value), PAD, 324);

  // ── Numeral ──
  if (data.numeral) {
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.font = `600 62px ${FONT_HE}`;
    ctx.fillText(data.numeral, W - PAD, 350);

    ctx.direction = 'ltr';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#475569';
    ctx.font = `700 16px ${FONT_LATIN}`;
    ctx.fillText('IN LETTERS', W - PAD, 424);
  }

  // ── Secondary methods ──
  const methods = (data.methods || []).slice(0, 4);
  if (methods.length) {
    const boxW = (W - PAD * 2 - 18 * (methods.length - 1)) / methods.length;
    methods.forEach((m, i) => {
      const x = PAD + i * (boxW + 18);
      const y = 448;
      ctx.fillStyle = 'rgba(22, 28, 38, 0.75)';
      roundRect(ctx, x, y, boxW, 78, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#64748b';
      ctx.font = `700 13px ${FONT_LATIN}`;
      ctx.fillText(m.label.toUpperCase(), x + 16, y + 14);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = `700 30px ${FONT_LATIN}`;
      ctx.fillText(String(m.value), x + 16, y + 34);
    });
  }

  // ── Footer ──
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = `500 17px ${FONT_LATIN}`;
  ctx.fillText('marklebrett.co.uk/gematria', PAD, H - PAD - 6);

  return canvas;
}

/** Promise-wrapped `canvas.toBlob`. */
export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode the image.'));
    }, 'image/png');
  });
}

/** Is clipboard image write available in this browser/context? */
export function canCopyImages() {
  return (
    typeof window !== 'undefined'
    && typeof window.ClipboardItem !== 'undefined'
    && !!navigator.clipboard?.write
  );
}

/**
 * Copy the card to the clipboard, falling back to a download.
 * @returns {Promise<'copied'|'downloaded'>}
 */
export async function shareCard(data, filename = 'gematria.png') {
  const canvas = drawShareCard(data, 2);
  const blob = await canvasToBlob(canvas);

  if (canCopyImages()) {
    try {
      await navigator.clipboard.write([
        new window.ClipboardItem({ 'image/png': blob }),
      ]);
      return 'copied';
    } catch {
      // Safari and Firefox reject this outside a user gesture, and some
      // browsers refuse PNG writes entirely — fall through to a download.
    }
  }

  downloadBlob(blob, filename);
  return 'downloaded';
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
