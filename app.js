// app.js — punto de entrada: conecta tareas.js con el DOM. Sesión 8 (módulos).
// Sesión 22: la persistencia ahora pasa por db.js (IndexedDB) en vez de
// localStorage, y se agregó el flujo de la nota privada cifrada (crypto.js).
import { crearTarea, renderizarTarea } from "./tareas.js";
import {
  abrirBaseDeDatos,
  agregarTarea,
  actualizarTarea,
  eliminarTareaDB,
  obtenerTodasLasTareas,
} from "./db.js";
import { derivarClaveDesdeContrasena, cifrarTexto, descifrarTexto, obtenerOCrearSal } from "./crypto.js";

let db;
let tareas = [];
// La clave derivada se guarda solo en memoria, mientras dure la pestaña — nunca
// en IndexedDB ni en localStorage (Sesión 22, sección 7-8). Se vuelve a pedir la
// contraseña si se recarga la página.
let claveSesion = null;

const listaEl = document.getElementById("lista-tareas");
const formEl = document.getElementById("form-tarea");
const inputTituloEl = document.getElementById("input-titulo");
const inputPrioridadEl = document.getElementById("input-prioridad");

const pintarTodo = () => {
  listaEl.innerHTML = "";
  tareas.forEach((tarea) =>
    renderizarTarea(tarea, listaEl, {
      onToggle: alternarCompletada,
      onEliminar: eliminarTarea,
      onGuardarNota: guardarNotaPrivada,
      onVerNota: verNotaPrivada,
    })
  );
};

/** Deriva (o reutiliza) la clave de esta sesión, pidiendo la contraseña una sola vez. */
async function obtenerClaveSesion() {
  if (claveSesion) return claveSesion;
  const contrasena = window.prompt(
    "Contraseña para cifrar/descifrar notas privadas (la misma cada vez — no se guarda en ningún lado):"
  );
  if (!contrasena) return null;
  const sal = obtenerOCrearSal();
  claveSesion = await derivarClaveDesdeContrasena(contrasena, sal);
  return claveSesion;
}

async function guardarNotaPrivada(id, textoPlano) {
  if (!textoPlano.trim()) return;
  const clave = await obtenerClaveSesion();
  if (!clave) return;
  const { cifrado, iv } = await cifrarTexto(clave, textoPlano);
  const tarea = tareas.find((t) => t.id === id);
  tarea.notaCifrada = cifrado;
  tarea.notaIv = iv;
  await actualizarTarea(db, tarea);
  pintarTodo();
}

async function verNotaPrivada(id) {
  const tarea = tareas.find((t) => t.id === id);
  if (!tarea.notaCifrada) return;
  const clave = await obtenerClaveSesion();
  if (!clave) return;
  try {
    const texto = await descifrarTexto(clave, { cifrado: tarea.notaCifrada, iv: tarea.notaIv });
    window.alert(`Nota privada de "${tarea.titulo}":\n\n${texto}`);
  } catch {
    window.alert("No se pudo descifrar — la contraseña ingresada no es la correcta.");
  }
}

async function alternarCompletada(id) {
  const tarea = tareas.find((t) => t.id === id);
  tarea.completada = !tarea.completada;
  await actualizarTarea(db, tarea);
  pintarTodo();
}

async function eliminarTarea(id) {
  await eliminarTareaDB(db, id);
  tareas = tareas.filter((t) => t.id !== id);
  pintarTodo();
}

formEl.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const titulo = inputTituloEl.value.trim();
  if (!titulo) return;
  const tareaNueva = crearTarea(titulo, inputPrioridadEl.value);
  const id = await agregarTarea(db, tareaNueva);
  tareaNueva.id = id;
  tareas.push(tareaNueva);
  pintarTodo();
  formEl.reset();
});

async function iniciar() {
  db = await abrirBaseDeDatos();
  tareas = await obtenerTodasLasTareas(db);
  if (tareas.length === 0) {
    const inicial = crearTarea("Aprender el Bloque 3: PWA", "alta");
    const id = await agregarTarea(db, inicial);
    inicial.id = id;
    tareas = [inicial];
  }
  pintarTodo();
}

iniciar();

// Registro del Service Worker — Sesión 17.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => console.log("SW registrado:", reg.scope))
    .catch((err) => console.error("Error al registrar SW:", err));
}
