// sync.js — bandeja de salida + Background Sync (Sesión 26).
// Idea: toda tarea nueva se anota PRIMERO en la bandeja "outbox" (IndexedDB) y
// luego se le pide al navegador que la envíe cuando haya red. Así la acción
// del usuario nunca depende de la conexión.

const ETIQUETA = "sync-tareas";

/** Anota un cambio pendiente. Devuelve el idCambio (UUID). */
export function encolarCambio(db, tipo, datos) {
  const cambio = { idCambio: crypto.randomUUID(), tipo, datos, creadoEn: Date.now() };
  return new Promise((resolve, reject) => {
    const tx = db.transaction("outbox", "readwrite");
    tx.objectStore("outbox").add(cambio);
    tx.oncomplete = () => resolve(cambio.idCambio);
    tx.onerror = () => reject(tx.error);
  });
}

export function contarPendientes(db) {
  return new Promise((resolve, reject) => {
    const peticion = db.transaction("outbox").objectStore("outbox").count();
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
  });
}

/** ¿Este navegador tiene Background Sync? Safari y Firefox: no. */
export function haySyncEnSegundoPlano() {
  return "serviceWorker" in navigator && "SyncManager" in window;
}

/** Pide la sincronización. Devuelve "segundo-plano" si el navegador se encargará
 *  (aunque cierres la pestaña) o "desde-la-pagina" si hubo que enviarla aquí
 *  (puede lanzar si el servidor no responde: la entrada sigue en la bandeja). */
export async function pedirSincronizacion(db) {
  if (haySyncEnSegundoPlano()) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register(ETIQUETA); // registrar dos veces la misma etiqueta = una sola tarea
      return "segundo-plano";
    } catch {
      // Tener SyncManager no basta: register() falla (NotAllowedError) si el
      // usuario bloqueó la sincronización en segundo plano para este sitio.
    }
  }
  // Plan B (Safari, Firefox, o permiso bloqueado): solo funciona mientras la pestaña siga abierta.
  await vaciarDesdeLaPagina(db);
  return "desde-la-pagina";
}

/** Misma lógica que el SW pero dentro de la página. Lanza si el servidor falla. */
export async function vaciarDesdeLaPagina(db) {
  const pendientes = await new Promise((ok, mal) => {
    const p = db.transaction("outbox").objectStore("outbox").getAll();
    p.onsuccess = () => ok(p.result);
    p.onerror = () => mal(p.error);
  });
  let enviados = 0;
  for (const cambio of pendientes) {
    const resp = await fetch("/api/tareas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambio),
    });
    if (!resp.ok) throw new Error("El servidor respondió " + resp.status);
    await new Promise((ok, mal) => {
      const tx = db.transaction("outbox", "readwrite");
      tx.objectStore("outbox").delete(cambio.idCambio);
      tx.oncomplete = ok;
      tx.onerror = () => mal(tx.error);
    });
    enviados++;
  }
  return enviados;
}
