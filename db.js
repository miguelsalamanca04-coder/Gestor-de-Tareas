// db.js — envoltorio en promesas de IndexedDB para el Gestor de Tareas.
// Construido en la Sesión 22 (IndexedDB y Web Crypto API) sobre el patrón
// enseñado en la guía: abrir/versionar la base, CRUD envuelto en promesas,
// y un cursor con índice.

const NOMBRE_DB = "gestor-tareas-db";
// Versión 2 (Sesión 26): se agrega la bandeja de salida "outbox" para Background Sync.
const VERSION_DB = 2;

/** Abre (o crea) la base de datos. Sesión 22, sección 3. */
export function abrirBaseDeDatos() {
  return new Promise((resolve, reject) => {
    const peticion = indexedDB.open(NOMBRE_DB, VERSION_DB);

    peticion.onupgradeneeded = (event) => {
      const db = event.target.result;
      // Las migraciones se escriben por TRAMOS según la versión de la que se
      // viene (Sesión 22): quien ya tenía la v1 conserva sus tareas y solo
      // recibe lo nuevo; quien instala por primera vez ejecuta ambos tramos.
      if (event.oldVersion < 1) {
        const store = db.createObjectStore("tareas", { keyPath: "id", autoIncrement: true });
        store.createIndex("porPrioridad", "prioridad", { unique: false });
        store.createIndex("porTitulo", "titulo", { unique: true });
      }
      if (event.oldVersion < 2) {
        // La clave es un UUID que genera la app (no autoIncrement): el servidor
        // lo usa para no duplicar un cambio si el envío se reintenta.
        db.createObjectStore("outbox", { keyPath: "idCambio" });
      }
    };

    peticion.onsuccess = (event) => {
      const db = event.target.result;
      // Si otra pestaña (o una versión futura) necesita actualizar el esquema,
      // esta conexión debe cerrarse o la actualización queda bloqueada.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    peticion.onerror = (event) => reject(event.target.error);
  });
}

/** Inserta una tarea nueva. Sesión 22, sección 4. */
export function agregarTarea(db, tarea) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tareas", "readwrite");
    const peticion = tx.objectStore("tareas").add(tarea);
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Actualiza (o inserta) una tarea existente, identificada por su id. */
export function actualizarTarea(db, tarea) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tareas", "readwrite");
    const peticion = tx.objectStore("tareas").put(tarea);
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
  });
}

/** Elimina una tarea por su id. */
export function eliminarTareaDB(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tareas", "readwrite");
    const peticion = tx.objectStore("tareas").delete(id);
    peticion.onsuccess = () => resolve();
    peticion.onerror = () => reject(peticion.error);
  });
}

/** Trae todas las tareas guardadas. Suficiente para esta escala del proyecto. */
export function obtenerTodasLasTareas(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tareas", "readonly");
    const peticion = tx.objectStore("tareas").getAll();
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
  });
}

/**
 * Recorre con un cursor, por el índice porPrioridad, y marca como completadas
 * todas las tareas de una prioridad dada. Sesión 22, sección 5 — ejemplo real
 * de escritura por cursor (cursor.update()), no solo lectura.
 */
export function completarTareasPorPrioridad(db, prioridad) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tareas", "readwrite");
    const indice = tx.objectStore("tareas").index("porPrioridad");
    const cursor = indice.openCursor(IDBKeyRange.only(prioridad));
    let actualizadas = 0;

    cursor.onsuccess = (event) => {
      const c = event.target.result;
      if (!c) return resolve(actualizadas);
      const registro = c.value;
      registro.completada = true;
      c.update(registro);
      actualizadas++;
      c.continue();
    };
    cursor.onerror = () => reject(cursor.error);
  });
}
