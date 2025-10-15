module.exports = function override(config) {
  console.log('Overriding Webpack config...');
  
  // Find the oneOf rule (CRA uses this structure)
  const oneOfRule = config.module.rules.find(rule => rule.oneOf);
  
  if (oneOfRule) {
    // Find the source-map-loader within oneOf
    const sourceMapRule = oneOfRule.oneOf.find(
      rule => rule.use && Array.isArray(rule.use) && 
      rule.use.some(loader => loader.loader && loader.loader.includes('source-map-loader'))
    );
    
    if (sourceMapRule) {
      console.log('Found source-map-loader rule, excluding node_modules');
      sourceMapRule.exclude = /node_modules/;
    } else {
      console.log('source-map-loader not found');
    }
  }
  
  return config;
};