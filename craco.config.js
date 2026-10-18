const path = require('path');
const webpack = require('webpack');

/**
 * Lab pages (src/lab/*) are sandbox copies and must not reach the public site.
 *
 * Guarding the route with `process.env.REACT_APP_LAB === '1'` is NOT enough on
 * its own: webpack walks `import()` expressions while building the module graph
 * and emits a chunk for them even when the branch that reaches the import is
 * dead. The lab source — and the URL token in it — would still ship.
 *
 * So unless the flag is set we rewrite every `./lab/<Page>` import to a stub
 * that renders nothing. The real source never enters the graph, and the public
 * bundle contains no trace of it.
 *
 * `labDisabled` itself is excluded from the rewrite, or it would replace itself.
 */
const LAB_ENABLED = process.env.REACT_APP_LAB === '1';

module.exports = {
  style: {
    postcss: {
      mode: 'file',
    },
  },
  webpack: {
    plugins: {
      add: LAB_ENABLED ? [] : [
        new webpack.NormalModuleReplacementPlugin(
          /[\\/]lab[\\/](?!labDisabled)[A-Za-z0-9_-]+$/,
          path.resolve(__dirname, 'src/lab/labDisabled.js'),
        ),
      ],
    },
  },
  jest: {
    configure: {
      moduleNameMapper: {
        // react-router v7 ships an `exports` map that CRA5's Jest resolver
        // can't follow, so point it straight at the CommonJS builds.
        '^react-router-dom$': '<rootDir>/node_modules/react-router-dom/dist/index.js',
        '^react-router$': '<rootDir>/node_modules/react-router/dist/development/index.js',
        '^react-router/dom$': '<rootDir>/node_modules/react-router/dist/development/dom-export.js',
      },
    },
  },
};
