import fs from 'fs';
import path from 'path';
import { SITE_TITLE, SITE_DESCRIPTION } from './siteMeta';

/**
 * The description lives in three places that can't share code: this module,
 * the static index.html every link-preview crawler reads, and the PWA
 * manifest. These tests are what keeps them saying the same thing.
 */

const PUBLIC = path.join(__dirname, '..', 'public');
const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'manifest.json'), 'utf8'));

const metaContent = (attr, name) => {
  const re = new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"`);
  const m = html.match(re);
  return m ? m[1] : null;
};

describe('site description', () => {
  it('is short enough not to be truncated in search results', () => {
    // Google cuts descriptions at roughly 155 characters.
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(155);
  });

  it.each([
    ['name', 'description'],
    ['property', 'og:description'],
    ['name', 'twitter:description'],
  ])('matches index.html <meta %s="%s">', (attr, name) => {
    expect(metaContent(attr, name)).toBe(SITE_DESCRIPTION);
  });

  it('matches the manifest', () => {
    expect(manifest.description).toBe(SITE_DESCRIPTION);
  });
});

describe('site title', () => {
  it('matches the <title> and the preview titles', () => {
    expect(html).toContain(`<title>${SITE_TITLE}</title>`);
    expect(metaContent('property', 'og:title')).toBe(SITE_TITLE);
    expect(metaContent('name', 'twitter:title')).toBe(SITE_TITLE);
    expect(manifest.name).toBe(SITE_TITLE);
  });
});
