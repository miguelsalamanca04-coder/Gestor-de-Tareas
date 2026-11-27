module.exports = {
  globDirectory: '.',
  globPatterns: [
    'index.html',
    'manifest.json',
    'css/*.css',
    '*.js',
    'icons/*.png',
  ],
  globIgnores: ['node_modules/**/*', 'workbox-config.js', 'sw.js', 'workbox-????????.js', 'package*.json'],
  swDest: 'sw.js',
  clientsClaim: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /\/icons\//,
      handler: 'CacheFirst',
      options: {
        cacheName: 'imagenes',
        expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      urlPattern: /\/api\//,
      handler: 'NetworkFirst',
      options: { cacheName: 'api-tareas' },
    },
  ],
};
