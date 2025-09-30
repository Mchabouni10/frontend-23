const sharp = require('sharp');
sharp('./src/assets/CompanyLogo.png')
  .resize(1024, 1024, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  })
  .toFile('./square-icon.png')
  .then(() => console.log('Done!'))
  .catch(err => console.error(err));
