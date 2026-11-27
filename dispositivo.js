// dispositivo.js — APIs de dispositivo del Gestor de Tareas (Sesión 24):
// cámara con getUserMedia y ubicación con Geolocation. Todo lo que toca
// hardware vive aquí, aparte de la interfaz, para poder probarlo y para que
// el resto de la app no dependa de cómo se pide cada permiso.

/** Estado de un permiso ("granted" | "denied" | "prompt" | "desconocido").
 *  Safari no soporta todos los nombres: por eso el try/catch. */
export async function estadoPermiso(nombre) {
  try {
    const r = await navigator.permissions.query({ name: nombre });
    return r.state;
  } catch {
    return "desconocido";
  }
}

/** Abre la cámara. facingMode "environment" = trasera, "user" = frontal.
 *  "ideal" no falla si el dispositivo no tiene esa cámara; "exact" sí. */
export function abrirCamara(facingMode = "environment") {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
}

/** Abre el micrófono. Mismo permiso, mismo getUserMedia: solo cambia audio/video. */
export function abrirMicrofono() {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: false,
  });
}

/** Mide el volumen del micrófono con Web Audio (0 = silencio, 1 = máximo).
 *  Llámalo dentro de un clic: los navegadores crean el AudioContext "suspendido"
 *  si no hubo gesto del usuario. */
export function crearMedidorDeNivel(stream) {
  const ctx = new AudioContext();
  ctx.resume();
  const analizador = ctx.createAnalyser();
  analizador.fftSize = 512;
  ctx.createMediaStreamSource(stream).connect(analizador);
  const datos = new Uint8Array(analizador.fftSize);
  return {
    leer() {
      analizador.getByteTimeDomainData(datos);
      let pico = 0;
      for (const v of datos) pico = Math.max(pico, Math.abs(v - 128));
      return pico / 128;
    },
    cerrar() {
      stream.getTracks().forEach((pista) => pista.stop());
      ctx.close();
    },
  };
}

/** Libera la cámara (o el micrófono): sin esto el LED queda encendido y otras apps no lo pueden usar. */
export function detenerCamara(stream) {
  stream?.getTracks().forEach((pista) => pista.stop());
}

/** Congela el fotograma actual del <video> en un Blob JPEG (máx. 640 px de ancho,
 *  para no llenar IndexedDB con fotos de varios megas). */
export function capturarFoto(video, anchoMax = 640) {
  const escala = Math.min(1, anchoMax / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * escala);
  canvas.height = Math.round(video.videoHeight * escala);
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
}

/** Traduce el error de getUserMedia a un mensaje que el usuario pueda entender. */
export function describirErrorCamara(err) {
  switch (err?.name) {
    case "NotAllowedError":
      return "Bloqueaste el permiso de cámara. Habilítalo desde el candado de la barra de direcciones.";
    case "NotFoundError":
      return "Este dispositivo no tiene cámara disponible.";
    case "NotReadableError":
      return "La cámara está siendo usada por otra aplicación.";
    case "OverconstrainedError":
      return "La cámara no soporta la configuración pedida.";
    case "TypeError":
      // En una página que NO es contexto seguro (HTTP), navigator.mediaDevices
      // es undefined y llamar a getUserMedia lanza TypeError.
      return "La cámara solo funciona en HTTPS o en localhost.";
    case "SecurityError":
      return "El navegador tiene la cámara deshabilitada para esta página.";
    default:
      return `No se pudo abrir la cámara (${err?.name ?? "error desconocido"}).`;
  }
}

/** Pide la ubicación una vez. Se resuelve con { lat, lon, precision, momento }. */
export function obtenerUbicacion({ altaPrecision = false, timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject({ code: 0, message: "Geolocation no disponible" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          precision: Math.round(pos.coords.accuracy),
          momento: new Date(pos.timestamp).toISOString(),
        }),
      reject,
      { enableHighAccuracy: altaPrecision, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}

/** Traduce el GeolocationPositionError (code 1, 2 o 3) a un mensaje claro. */
export function describirErrorUbicacion(err) {
  switch (err?.code) {
    case 1:
      return "Denegaste el permiso de ubicación. La tarea sigue funcionando sin ella.";
    case 2:
      return "No se pudo determinar la posición (sin señal GPS o de red).";
    case 3:
      return "La ubicación tardó demasiado en responder. Intenta de nuevo.";
    default:
      return "La ubicación no está disponible en este navegador.";
  }
}
