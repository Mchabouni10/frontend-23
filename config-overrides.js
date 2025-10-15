// config-overrides.js
const webpack = require('webpack');

module.exports = function override(config) {
  // 1️⃣ Remove source-map-loader (causing those TSX warnings)
  config.module.rules = config.module.rules.map(rule => {
    if (rule.oneOf) {
      rule.oneOf = rule.oneOf.filter(subRule =>
        !(subRule.loader && subRule.loader.includes('source-map-loader'))
      );
    }
    return rule;
  });

  // 2️⃣ Disable source maps entirely (optional, but cleaner)
  config.devtool = false;

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
};
