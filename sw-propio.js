// sw-propio.js — Service Worker ESCRITO A MANO (Sesión 26).
// Workbox ya no lo genera: solo inyecta, en el marcador de precaché (más abajo), la
// lista de archivos a precachear (estrategia "InjectManifest").
// El archivo que el navegador registra es sw.js (se produce con
//   npx workbox-cli injectManifest workbox-config.js ).
// ¡No edites sw.js! Edita ESTE archivo y vuelve a correr el comando.

// Workbox cargado desde archivos LOCALES (carpeta lib/), no desde un CDN:
// así el SW arranca igual sin conexión.
importScripts("lib/workbox-v7.4.1/workbox-sw.js");
workbox.setConfig({ modulePathPrefix: "lib/workbox-v7.4.1/", debug: false });

// IMPORTANTE: leer TODOS los módulos aquí, en el nivel superior. Cada acceso
// (workbox.precaching, workbox.routing…) dispara un importScripts, y
// importScripts solo se permite mientras el SW se está instalando/evaluando.
const { precacheAndRoute, cleanupOutdatedCaches } = workbox.precaching;
const { registerRoute } = workbox.routing;
const { CacheFirst, NetworkFirst } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;

self.skipWaiting();
workbox.core.clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST); // ← aquí Workbox inyecta la lista

registerRoute(
  ({ url }) => url.pathname.startsWith("/icons/"),
  new CacheFirst({
    cacheName: "imagenes",
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  })
);
registerRoute(({ url }) => url.pathname.startsWith("/api/"), new NetworkFirst({ cacheName: "api-tareas" }));

// ── Push: llega un mensaje del servidor aunque la app esté cerrada ─────────
self.addEventListener("push", (event) => {
  let datos = { titulo: "Gestor de Tareas", cuerpo: "Tienes novedades.", url: "/index.html" };
  try {
    if (event.data) datos = { ...datos, ...event.data.json() };
  } catch {
    if (event.data) datos.cuerpo = event.data.text(); // el mensaje no era JSON
  }
  // userVisibleOnly:true (al suscribir) OBLIGA a mostrar una notificación en
  // cada push; por eso va dentro de waitUntil, siempre.
  event.waitUntil(
    self.registration.showNotification(datos.titulo, {
      body: datos.cuerpo,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: datos.tag ?? "gestor-aviso", // misma etiqueta = reemplaza, no apila
      data: { url: datos.url },
    })
  );
});

// ── Clic en la notificación: enfocar la app abierta, o abrirla ─────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url ?? "/index.html", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const ventanas = await clients.matchAll({ type: "window", includeUncontrolled: true });
      const abierta = ventanas.find((v) => new URL(v.url).origin === self.location.origin);
      if (abierta) return abierta.focus();
      return clients.openWindow(destino);
    })()
  );
});

// ── Background Sync: enviar al servidor lo que quedó en la bandeja de salida ─
const NOMBRE_DB = "gestor-tareas-db";

// Un SW clásico no puede importar db.js (es un módulo ES), así que abre
// IndexedDB por su cuenta. Sin número de versión: abre la que ya existe.
function abrirDB() {
  return new Promise((resolve, reject) => {
    const p = indexedDB.open(NOMBRE_DB);
    p.onsuccess = () => resolve(p.result);
    p.onerror = () => reject(p.error);
  });
}
const pedir = (req) => new Promise((ok, mal) => { req.onsuccess = () => ok(req.result); req.onerror = () => mal(req.error); });

async function vaciarBandeja() {
  const db = await abrirDB();
  const pendientes = await pedir(db.transaction("outbox").objectStore("outbox").getAll());
  let enviados = 0;
  for (const cambio of pendientes) {
    const resp = await fetch("/api/tareas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambio),
    });
    // Si falla, lanzamos: el navegador reintentará (con espera creciente).
    if (!resp.ok) throw new Error("El servidor respondió " + resp.status);
    // Se borra cada entrada apenas se confirma, no al final: si el siguiente
    // falla, no se reenvía lo que ya llegó.
    await pedir(db.transaction("outbox", "readwrite").objectStore("outbox").delete(cambio.idCambio));
    enviados++;
  }
  db.close();
  return enviados;
}

async function avisarDeSincronizacion(enviados) {
  if (enviados === 0) return;
  const ventanas = await clients.matchAll({ type: "window" });
  ventanas.forEach((v) => v.postMessage({ tipo: "sync-completo", enviados }));
  // Si el usuario está mirando la app, basta el mensaje en pantalla.
  // Solo si NO hay ninguna ventana visible se justifica una notificación.
  if (!ventanas.some((v) => v.visibilityState === "visible")) {
    await self.registration.showNotification("Tareas sincronizadas", {
      body: enviados === 1 ? "1 tarea llegó al servidor." : enviados + " tareas llegaron al servidor.",
      icon: "/icons/icon-192.png",
      tag: "gestor-sync",
      data: { url: "/index.html" },
    });
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-tareas") {
    event.waitUntil(vaciarBandeja().then(avisarDeSincronizacion));
  }
});
