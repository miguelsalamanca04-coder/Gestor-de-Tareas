// sensores.js — sensores de movimiento del Gestor de Tareas (Sesión 25):
// DeviceOrientation (hacia dónde apunta/cómo está inclinado el teléfono) y
// DeviceMotion (aceleración). En un computador de escritorio NO hay sensores:
// todo lo de este módulo es una mejora opcional, nunca la única forma de
// hacer algo.

/** iOS (Safari 13+) exige pedir permiso desde un gesto del usuario.
 *  Android/Chromium no tienen requestPermission: el permiso es implícito.
 *  Devuelve "granted" | "denied" | "no-necesario" | "no-soportado". */
export async function pedirPermisoSensores() {
  if (!("DeviceMotionEvent" in window)) return "no-soportado";
  if (typeof DeviceMotionEvent.requestPermission === "function") {
    try {
      return await DeviceMotionEvent.requestPermission();
    } catch {
      return "denied";
    }
  }
  return "no-necesario";
}

/** ¿Llegan lecturas reales? Un portátil dispara UN evento con todo en null,
 *  o ninguno. Esta función espera hasta timeoutMs a que llegue un valor real. */
export function hayLecturasReales(timeoutMs = 1000) {
  return new Promise((resolve) => {
    const alRecibir = (e) => {
      const a = e.accelerationIncludingGravity;
      if (a && a.x !== null) {
        limpiar();
        resolve(true);
      }
    };
    const limpiar = () => {
      window.removeEventListener("devicemotion", alRecibir);
      clearTimeout(t);
    };
    const t = setTimeout(() => {
      limpiar();
      resolve(false);
    }, timeoutMs);
    window.addEventListener("devicemotion", alRecibir);
  });
}

/** Orientación (inclinación) con limitación de frecuencia. Devuelve una función para detener. */
export function escucharOrientacion(callback, intervaloMs = 100) {
  let ultimo = 0;
  const manejador = (e) => {
    const ahora = performance.now();
    if (ahora - ultimo < intervaloMs) return;
    ultimo = ahora;
    if (e.beta === null) return; // sin sensor
    callback({ alfa: e.alpha, beta: e.beta, gamma: e.gamma });
  };
  window.addEventListener("deviceorientation", manejador);
  return () => window.removeEventListener("deviceorientation", manejador);
}

/** Detecta una sacudida: cuánto se aleja la magnitud total de la gravedad. */
export function detectarSacudida(onSacudida, { umbral = 12, enfriamientoMs = 1000 } = {}) {
  const GRAVEDAD = 9.81;
  let ultimaSacudida = 0;
  const manejador = (e) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x === null) return;
    const magnitud = Math.hypot(a.x, a.y, a.z);
    const desviacion = Math.abs(magnitud - GRAVEDAD);
    const ahora = performance.now();
    if (desviacion > umbral && ahora - ultimaSacudida > enfriamientoMs) {
      ultimaSacudida = ahora;
      onSacudida(Math.round(desviacion * 10) / 10);
    }
  };
  window.addEventListener("devicemotion", manejador);
  return () => window.removeEventListener("devicemotion", manejador);
}
