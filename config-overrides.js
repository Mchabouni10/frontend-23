module.exports = function override(config) {
    console.log('Overriding Webpack config...');
    const sourceMapRule = config.module.rules.find(
      (rule) => rule.enforce === 'pre' && rule.use && rule.use.includes('source-map-loader')
    );
    if (sourceMapRule) {
      console.log('Found source-map-loader rule:', sourceMapRule);
      sourceMapRule.exclude = [/node_modules\/react-datepicker/];
    } else {
      console.log('source-map-loader rule not found in config:', config.module.rules);
    }
    return config;
  };