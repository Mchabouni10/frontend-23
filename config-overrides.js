// config-overrides.js
const webpack = require('webpack');

module.exports = {
  // ── Webpack overrides (same as before) ──────────────────────────────────
  webpack: function override(config) {
    // 1️⃣ Remove source-map-loader (causing those TSX warnings)
    config.module.rules = config.module.rules.map(rule => {
      if (rule.oneOf) {
        rule.oneOf = rule.oneOf.filter(subRule =>
          !(subRule.loader && subRule.loader.includes('source-map-loader'))
        );
      }
      return rule;
    });

    // 2️⃣ Enable source maps for production debugging
    config.devtool = 'source-map';

    // 3️⃣ Silence all Webpack deprecation warnings
    config.ignoreWarnings = [/Failed to parse source map/, /source-map-loader/];

    // 4️⃣ Suppress React-Datepicker and other vendor warnings
    config.plugins.push(
      new webpack.ContextReplacementPlugin(/.*/, data => {
        delete data.dependencies;
        return data;
      })
    );

    return config;
  },

  // ── Dev server proxy — forward all /api calls to Express on port 3001 ───
  devServer: function(configFunction) {
    return function(proxy, allowedHost) {
      const config = configFunction(proxy, allowedHost);

      config.proxy = {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      };

      return config;
    };
  },
};
