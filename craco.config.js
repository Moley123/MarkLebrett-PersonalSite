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
      },
    },
  },
};
