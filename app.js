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
import {
  abrirCamara,
  detenerCamara,
  capturarFoto,
  describirErrorCamara,
  obtenerUbicacion,
  describirErrorUbicacion,
} from "./dispositivo.js";
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

const mensajeEl = document.getElementById("mensaje-dispositivo");
const dlgCamara = document.getElementById("dlg-camara");
const videoEl = document.getElementById("video-camara");
let streamActual = null;
let tareaDeFoto = null;

function avisar(texto) {
  mensajeEl.textContent = texto;
  mensajeEl.hidden = !texto;
}

const pintarTodo = () => {
  // Libera las URLs de miniaturas de la pintada anterior (si no, quedan en memoria).
  listaEl.querySelectorAll("img.miniatura").forEach((img) => URL.revokeObjectURL(img.src));
  listaEl.innerHTML = "";
  tareas.forEach((tarea) =>
    renderizarTarea(tarea, listaEl, {
      onToggle: alternarCompletada,
      onEliminar: eliminarTarea,
      onGuardarNota: guardarNotaPrivada,
      onVerNota: verNotaPrivada,
      onFoto: abrirDialogoCamara,
      onUbicacion: adjuntarUbicacion,
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

// ── Sesión 24: cámara ────────────────────────────────────────────────────
async function abrirDialogoCamara(id) {
  avisar("");
  tareaDeFoto = id;
  try {
    // El permiso se pide AQUÍ, dentro del clic del usuario — no al cargar la página.
    streamActual = await abrirCamara("environment");
  } catch (err) {
    avisar(describirErrorCamara(err));
    return;
  }
  videoEl.srcObject = streamActual;
  dlgCamara.showModal();
}

function cerrarDialogoCamara() {
  detenerCamara(streamActual);
  streamActual = null;
  videoEl.srcObject = null;
  if (dlgCamara.open) dlgCamara.close();
}

document.getElementById("btn-cancelar-camara").addEventListener("click", cerrarDialogoCamara);
// Si el usuario cierra con Esc, el stream también debe detenerse.
dlgCamara.addEventListener("close", () => {
  if (streamActual) cerrarDialogoCamara();
});

document.getElementById("btn-capturar").addEventListener("click", async () => {
  const blob = await capturarFoto(videoEl);
  const tarea = tareas.find((t) => t.id === tareaDeFoto);
  cerrarDialogoCamara();
  if (!tarea || !blob) return;
  tarea.foto = blob;
  await actualizarTarea(db, tarea);
  pintarTodo();
});

// ── Sesión 24: ubicación ─────────────────────────────────────────────────
async function adjuntarUbicacion(id) {
  avisar("Obteniendo ubicación…");
  try {
    const ubicacion = await obtenerUbicacion();
    const tarea = tareas.find((t) => t.id === id);
    tarea.ubicacion = ubicacion;
    await actualizarTarea(db, tarea);
    avisar("");
    pintarTodo();
  } catch (err) {
    avisar(describirErrorUbicacion(err));
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

// Indicador de conexión — Sesión 23 (UX/UI).
const estadoEl = document.getElementById("estado-conexion");
function actualizarEstadoConexion() {
  const enLinea = navigator.onLine;
  estadoEl.textContent = enLinea ? "● En línea" : "● Sin conexión — los datos se guardan en tu dispositivo";
  estadoEl.className = "estado " + (enLinea ? "en-linea" : "sin-conexion");
}
window.addEventListener("online", actualizarEstadoConexion);
window.addEventListener("offline", actualizarEstadoConexion);
actualizarEstadoConexion();

// Botón de instalación propio — Sesión 23 (UX/UI). Solo Chromium dispara
// beforeinstallprompt; en Safari/iOS el botón nunca aparece (ver la guía).
let promptInstalacion = null;
const btnInstalar = document.getElementById("btn-instalar");
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  promptInstalacion = e;
  btnInstalar.hidden = false;
});
btnInstalar.addEventListener("click", async () => {
  if (!promptInstalacion) return;
  promptInstalacion.prompt();
  await promptInstalacion.userChoice;
  promptInstalacion = null;
  btnInstalar.hidden = true;
});
window.addEventListener("appinstalled", () => { btnInstalar.hidden = true; });

// Registro del Service Worker — Sesión 17 (el sw.js, desde la Sesión 23, lo genera Workbox).
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => console.log("SW registrado:", reg.scope))
    .catch((err) => console.error("Error al registrar SW:", err));
}
