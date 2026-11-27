// notificaciones.js — Notification API y Push API del Gestor (Sesión 26).
// Regla de oro: NINGÚN permiso se pide al cargar la página; siempre dentro
// del clic de un botón, y explicando antes para qué sirve.

/** "granted" | "denied" | "default" | "no-soportado" */
export function estadoNotificaciones() {
  return "Notification" in window ? Notification.permission : "no-soportado";
}

/** Pedir permiso. Solo llamar desde un gesto del usuario. */
export async function pedirPermisoNotificaciones() {
  if (!("Notification" in window)) return "no-soportado";
  return Notification.requestPermission();
}

/** Notificación LOCAL (sin servidor): la muestra el propio SW.
 *  Se usa registration.showNotification y no `new Notification()` porque este
 *  último lanza TypeError en Chrome para Android. */
export async function mostrarAvisoLocal(titulo, cuerpo, url = "/index.html") {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification(titulo, {
    body: cuerpo,
    icon: "/icons/icon-192.png",
    tag: "gestor-aviso",
    data: { url },
  });
}

/** La clave pública VAPID llega en base64url; PushManager la quiere en bytes. */
export function urlBase64ABytes(base64url) {
  const relleno = "=".repeat((4 - (base64url.length % 4)) % 4);
  const b64 = (base64url + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(b64);
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

/** Suscribe este navegador a push y envía la suscripción al servidor. */
export async function suscribirAPush() {
  const reg = await navigator.serviceWorker.ready;
  if (!("pushManager" in reg)) throw new Error("push-no-soportado");
  const { clave } = await (await fetch("/api/clave-publica")).json();
  const suscripcion = await reg.pushManager.subscribe({
    userVisibleOnly: true, // obligatorio: cada push debe mostrar una notificación
    applicationServerKey: urlBase64ABytes(clave),
  });
  const resp = await fetch("/api/suscribir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(suscripcion.toJSON()),
  });
  if (!resp.ok) throw new Error("El servidor no guardó la suscripción (" + resp.status + ")");
  return suscripcion;
}

export async function suscripcionActual() {
  const reg = await navigator.serviceWorker.ready;
  if (!("pushManager" in reg)) return null;
  return reg.pushManager.getSubscription();
}

export async function cancelarSuscripcion() {
  const sub = await suscripcionActual();
  if (!sub) return false;
  await fetch("/api/desuscribir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  return sub.unsubscribe();
}

/** Traduce los errores típicos a mensajes comprensibles. */
export function describirErrorPush(err) {
  const n = err?.name;
  if (n === "NotAllowedError") return "Permiso de notificaciones denegado: sin él no hay push. Puedes cambiarlo en la configuración del sitio.";
  if (n === "AbortError") return "El servicio de push del navegador no respondió (¿sin red, o navegador sin servicio de push?).";
  if (err?.message === "push-no-soportado") return "Este navegador no soporta push.";
  if (n === "InvalidStateError") return "Necesitas un Service Worker activo: recarga la página e inténtalo de nuevo.";
  return "No se pudo suscribir: " + (err?.message ?? err);
}
