// tareas.js — lógica del Gestor de Tareas.
// Construida en las Sesiones 3 a 8 (objetos, funciones, arrow functions, DOM
// y eventos, asincronía, módulos) y tipada en las Sesiones 9 a 14 — ver la
// versión de referencia en referencia-typescript/tareas.ts.
//
// Sesión 22: la persistencia pasó de localStorage (texto plano, síncrono) a
// IndexedDB vía db.js — y se agregó un campo "notaPrivada" que, a diferencia
// de título y prioridad, se cifra con AES-GCM antes de guardarse (crypto.js).
// localStorage no desaparece del todo: la sal de cifrado sigue viviendo ahí
// (ver crypto.js), porque es un único valor de configuración sin necesidad
// de índices.

/**
 * @typedef {"baja"|"media"|"alta"} Prioridad
 * @typedef {{ id?: number, titulo: string, prioridad: Prioridad, completada: boolean,
 *             fechaCreacion: string, notaCifrada: ArrayBuffer|null, notaIv: Uint8Array|null }} Tarea
 */

/** Crea una tarea nueva. El id ya no se genera aquí — IndexedDB lo asigna con autoIncrement. */
export const crearTarea = (titulo, prioridad = "media") => ({
  titulo,
  prioridad,
  completada: false,
  fechaCreacion: new Date().toISOString(),
  notaCifrada: null,
  notaIv: null,
});

/** Crea el <li> de una tarea y lo agrega al contenedor. Sesión 6 (DOM y eventos),
 *  ampliado en la Sesión 22 con los controles de la nota privada cifrada. */
export const renderizarTarea = (tarea, contenedor, { onToggle, onEliminar, onGuardarNota, onVerNota }) => {
  const li = document.createElement("li");
  li.className = `tarea tarea--${tarea.prioridad}` + (tarea.completada ? " tarea--completada" : "");
  li.dataset.id = tarea.id;

  const fila = document.createElement("div");
  fila.className = "tarea-fila";

  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = tarea.completada;
  check.addEventListener("change", () => onToggle(tarea.id));

  const texto = document.createElement("span");
  texto.textContent = tarea.titulo;

  const borrar = document.createElement("button");
  borrar.textContent = "Eliminar";
  borrar.className = "btn-eliminar";
  borrar.addEventListener("click", () => onEliminar(tarea.id));

  fila.append(check, texto, borrar);

  const notaFila = document.createElement("div");
  notaFila.className = "nota-fila";

  const notaInput = document.createElement("input");
  notaInput.type = "text";
  notaInput.placeholder = "Nota privada...";
  notaInput.className = "nota-input";

  const guardarNota = document.createElement("button");
  guardarNota.textContent = "🔒 Guardar";
  guardarNota.className = "btn-nota";
  guardarNota.addEventListener("click", () => onGuardarNota(tarea.id, notaInput.value));

  const verNota = document.createElement("button");
  verNota.textContent = "👁 Ver nota";
  verNota.className = "btn-nota";
  verNota.disabled = !tarea.notaCifrada;
  verNota.addEventListener("click", () => onVerNota(tarea.id));

  notaFila.append(notaInput, guardarNota, verNota);

  li.append(fila, notaFila);
  contenedor.append(li);
};
