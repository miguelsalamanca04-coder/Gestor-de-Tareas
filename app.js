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
import { pedirPermisoSensores, hayLecturasReales, escucharOrientacion, detectarSacudida } from "./sensores.js";
import {
  estadoNotificaciones,
  pedirPermisoNotificaciones,
  mostrarAvisoLocal,
  suscribirAPush,
  suscripcionActual,
  cancelarSuscripcion,
  describirErrorPush,
} from "./notificaciones.js";
import { encolarCambio, contarPendientes, pedirSincronizacion, haySyncEnSegundoPlano } from "./sync.js";
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

// ── Sesión 25: deshacer la última eliminación (botón, o agitando el teléfono) ──
let ultimaEliminada = null;
const btnDeshacer = document.getElementById("btn-deshacer");

async function deshacerEliminacion() {
  if (!ultimaEliminada) return;
  const { id, ...resto } = ultimaEliminada; // IndexedDB asigna un id nuevo
  const nuevoId = await agregarTarea(db, resto);
  tareas.push({ ...resto, id: nuevoId });
  avisar(`Se restauró «${resto.titulo}».`);
  ultimaEliminada = null;
  btnDeshacer.disabled = true;
  pintarTodo();
}
btnDeshacer.addEventListener("click", deshacerEliminacion);

let detenerSacudida = null;
let detenerOrientacion = null;
const btnSensores = document.getElementById("btn-sensores");
const lecturaEl = document.getElementById("lectura-sensores");

btnSensores.addEventListener("click", async () => {
  if (detenerSacudida) {
    // Segundo clic: apagar los sensores (ahorra batería y es lo que espera el usuario).
    detenerSacudida();
    detenerOrientacion?.();
    detenerSacudida = detenerOrientacion = null;
    lecturaEl.textContent = "";
    btnSensores.textContent = "📳 Activar agitar para deshacer";
    return;
  }
  // En iOS el permiso se pide AQUÍ, dentro del clic.
  const permiso = await pedirPermisoSensores();
  if (permiso === "denied") {
    avisar("Denegaste el acceso a los sensores. Puedes seguir usando el botón «Deshacer».");
    return;
  }
  if (permiso === "no-soportado" || !(await hayLecturasReales())) {
    avisar("Este dispositivo no tiene sensores de movimiento. Usa el botón «Deshacer eliminación».");
    return;
  }
  avisar("");
  detenerSacudida = detectarSacudida(() => deshacerEliminacion());
  detenerOrientacion = escucharOrientacion(({ beta, gamma }) => {
    lecturaEl.textContent = `inclinación β ${Math.round(beta)}° · γ ${Math.round(gamma)}°`;
  });
  btnSensores.textContent = "📳 Agitar para deshacer: ACTIVO";
});

async function eliminarTarea(id) {
  ultimaEliminada = tareas.find((t) => t.id === id) ?? null;
  btnDeshacer.disabled = !ultimaEliminada;
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
  // Sesión 26: la tarea ya está guardada en el dispositivo. Ahora se anota para
  // enviarla al servidor cuando se pueda — sin bloquear al usuario.
  await encolarCambio(db, "crear-tarea", { titulo: tareaNueva.titulo, prioridad: tareaNueva.prioridad });
  await actualizarEstadoSync();
  try {
    await pedirSincronizacion(db);
  } catch (err) {
    console.warn("No se pudo sincronizar todavía:", err.message);
  }
  await actualizarEstadoSync();
});

// ── Sesión 26: estado de sincronización ──────────────────────────────────
const estadoSyncEl = document.getElementById("estado-sync");
async function actualizarEstadoSync() {
  const n = await contarPendientes(db);
  const via = haySyncEnSegundoPlano() ? "" : " (este navegador no tiene Background Sync: se envía con la pestaña abierta)";
  estadoSyncEl.textContent = n === 0 ? "☁ Todo sincronizado con el servidor." : `☁ ${n} cambio(s) pendiente(s) de enviar${via}.`;
  estadoSyncEl.classList.toggle("pendiente", n > 0);
}

// El SW avisa cuando termina de sincronizar en segundo plano.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", async (e) => {
    if (e.data?.tipo === "sync-completo") {
      await actualizarEstadoSync();
      avisar(`Se sincronizaron ${e.data.enviados} cambio(s) con el servidor.`);
    }
  });
}
// Plan B para navegadores sin Background Sync: al volver la red, reintentar desde la página.
window.addEventListener("online", async () => {
  if (db && (await contarPendientes(db)) > 0) {
    try { await pedirSincronizacion(db); } catch { /* sigue pendiente */ }
    await actualizarEstadoSync();
  }
});

// ── Sesión 26: avisos y push ─────────────────────────────────────────────
const btnAvisos = document.getElementById("btn-avisos");
const btnPush = document.getElementById("btn-push");
const btnPushPrueba = document.getElementById("btn-push-prueba");
const estadoAvisosEl = document.getElementById("estado-avisos");

async function pintarEstadoAvisos() {
  const permiso = estadoNotificaciones();
  const sub = permiso === "granted" ? await suscripcionActual().catch(() => null) : null;
  btnAvisos.disabled = permiso === "granted" || permiso === "denied" || permiso === "no-soportado";
  btnPush.disabled = permiso !== "granted";
  btnPush.textContent = sub ? "📡 Cancelar suscripción push" : "📡 Suscribir a push";
  btnPushPrueba.disabled = !sub;
  estadoAvisosEl.textContent =
    permiso === "no-soportado" ? "Este navegador no soporta notificaciones."
    : permiso === "denied" ? "Avisos bloqueados (cámbialo en la configuración del sitio)."
    : permiso === "default" ? "Avisos sin activar."
    : sub ? "Avisos activos · push suscrito." : "Avisos activos · push sin suscribir.";
}

btnAvisos.addEventListener("click", async () => {
  // Permiso pedido AQUÍ, dentro del clic — y el usuario ya sabe para qué lo pulsó.
  const permiso = await pedirPermisoNotificaciones();
  if (permiso === "granted") {
    await mostrarAvisoLocal("Avisos activados", "Así se verán las notificaciones del Gestor.");
  } else {
    avisar("No se activaron los avisos. La app sigue funcionando igual.");
  }
  await pintarEstadoAvisos();
});

btnPush.addEventListener("click", async () => {
  avisar("");
  try {
    if (await suscripcionActual()) {
      await cancelarSuscripcion();
    } else {
      await suscribirAPush();
    }
  } catch (err) {
    avisar(describirErrorPush(err));
  }
  await pintarEstadoAvisos();
});

btnPushPrueba.addEventListener("click", async () => {
  try {
    const resp = await fetch("/api/enviar-prueba", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: "Recordatorio", cuerpo: "Tienes tareas pendientes en el Gestor." }),
    });
    const r = await resp.json();
    avisar(`Servidor: ${r.enviados} enviado(s), ${r.fallidos} fallido(s).`);
  } catch {
    avisar("No se pudo contactar al servidor (¿está corriendo node server.js?).");
  }
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
  await actualizarEstadoSync();
  await pintarEstadoAvisos();
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

// Registro del Service Worker — Sesión 17. Desde la Sesión 26, sw.js sale de
// sw-propio.js (escrito a mano) + la lista de precaché que inyecta Workbox.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => console.log("SW registrado:", reg.scope))
    .catch((err) => console.error("Error al registrar SW:", err));
}
