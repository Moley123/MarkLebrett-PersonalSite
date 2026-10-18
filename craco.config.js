module.exports = {
  style: {
    postcss: {
      mode: 'file',
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

        // MapLibre 6 is ESM-only and needs WebGL, so Jest can neither resolve
        // nor run it. src/lab/testing/maplibreStub.js stands in; webpack is
        // unaffected and still bundles the real thing.
        '^maplibre-gl$': '<rootDir>/src/lab/testing/maplibreStub.js',
        '^maplibre-gl/dist/maplibre-gl\\.css$': '<rootDir>/src/lab/testing/emptyStyle.js',
      },
    },
  },
};
