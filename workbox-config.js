// Sesión 26: InjectManifest. A diferencia de generateSW (Sesión 23), aquí
// NO se describe el comportamiento del SW: se indica cuál es TU archivo
// (swSrc) y cuáles archivos entran en la lista de precaché.
module.exports = {
  globDirectory: '.',
  globPatterns: [
    'index.html',
    'manifest.json',
    'css/*.css',
    '*.js',
    'icons/*.png',
  ],
  // sw-propio.js es el CÓDIGO FUENTE del SW: no debe precachearse a sí mismo.
  globIgnores: ['node_modules/**/*', 'servidor/**/*', 'lib/**/*', 'workbox-config.js', 'sw.js', 'sw-propio.js', 'package*.json'],
  swSrc: 'sw-propio.js',
  swDest: 'sw.js',
};
