// db.js — envoltorio en promesas de IndexedDB para el Gestor de Tareas.
// Construido en la Sesión 22 (IndexedDB y Web Crypto API) sobre el patrón
// enseñado en la guía: abrir/versionar la base, CRUD envuelto en promesas,
// y un cursor con índice.

const NOMBRE_DB = "gestor-tareas-db";
const VERSION_DB = 1;

/** Abre (o crea) la base de datos. Sesión 22, sección 3. */
export function abrirBaseDeDatos() {
  return new Promise((resolve, reject) => {
    const peticion = indexedDB.open(NOMBRE_DB, VERSION_DB);

    peticion.onupgradeneeded = (event) => {
      const db = event.target.result;
      const store = db.createObjectStore("tareas", { keyPath: "id", autoIncrement: true });
      store.createIndex("porPrioridad", "prioridad", { unique: false });
      store.createIndex("porTitulo", "titulo", { unique: true });
    };

    peticion.onsuccess = (event) => resolve(event.target.result);
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
