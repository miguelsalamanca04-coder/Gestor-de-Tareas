const CACHE_ACTUAL = 'gestor-tareas-v2';
const CORE_ASSETS = [
  '/index.html',
  '/css/estilos.css',
  '/app.js',
  '/tareas.js',
  '/manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_ACTUAL).then(cache => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(nombres =>
      Promise.all(nombres.filter(n => n !== CACHE_ACTUAL).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Cache First (Sesión 20): se prueba primero en el caché; si falta, se
// pide a la red y la respuesta se guarda para la próxima vez. Enrutar
// esta y otras estrategias por tipo de recurso es el trabajo de la
// Sesión 21 — por ahora se aplica igual a todo el shell.
function cacheFirst(peticion) {
  return caches.match(peticion).then(enCache => {
    if (enCache) return enCache;
    return fetch(peticion).then(respuesta => {
      const clon = respuesta.clone();
      caches.open(CACHE_ACTUAL).then(cache => cache.put(peticion, clon));
      return respuesta;
    });
  });
}

self.addEventListener('fetch', event => {
  event.respondWith(cacheFirst(event.request));
});
