/**
 * Test-only stand-in for MapLibre's stylesheet.
 *
 * `import 'maplibre-gl/dist/maplibre-gl.css'` is a side effect webpack
 * understands and Jest does not: the package's `exports` map has no condition
 * Jest's resolver follows, so the import fails to resolve before any transform
 * gets a chance to stub it. craco.config.js maps it here instead.
 */

module.exports = {};
