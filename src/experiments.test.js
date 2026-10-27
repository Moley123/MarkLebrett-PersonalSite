import { EXPERIMENTS, PATHS } from './experiments';

// package.json sets `homepage: "."`, so the bundle loads by relative path; a
// route nested more than one segment deep fails to boot (see src/App.js).
it('keeps every path one segment deep', () => {
  Object.values(PATHS).forEach((path) => expect(path).toMatch(/^\/[^/]+$/));
});

it('lists each experiment once, with a badge and a description', () => {
  const paths = EXPERIMENTS.map((e) => e.path);
  expect(new Set(paths).size).toBe(paths.length);
  EXPERIMENTS.forEach((e) => {
    expect(['Lab', 'Beta', 'Preview']).toContain(e.badge);
    expect(e.description.length).toBeGreaterThan(20);
  });
});

it('marks only static files as external', () => {
  EXPERIMENTS.forEach((e) => expect(!!e.external).toBe(e.path.endsWith('.html')));
});
