// server.js — mini servidor del Gestor de Tareas (Sesión 26).
// Hace TRES cosas, sin framework (solo el módulo http de Node):
//   1. sirve los archivos del Gestor (la carpeta de arriba) en http://localhost:3000
//   2. guarda suscripciones push y envía mensajes push (librería web-push)
//   3. recibe las tareas que llegan por Background Sync (POST /api/tareas)
// Es código de ENSEÑANZA: sin autenticación, sin base de datos, sin HTTPS.
// No lo uses tal cual en producción.
const http = require("http");
const fs = require("fs");
const path = require("path");
const webpush = require("web-push");

const PUERTO = process.env.PORT || 3000;
const RAIZ = path.join(__dirname, ".."); // la carpeta del Gestor
const ARCHIVO_CLAVES = path.join(__dirname, "claves-vapid.json");
const ARCHIVO_DATOS = path.join(__dirname, "datos.json");

// ── Claves VAPID: identifican a TU servidor ante el servicio de push ────────
// Se generan una sola vez y se guardan. La PRIVADA no sale nunca de este
// archivo (y no se sube a Git); la PÚBLICA sí se entrega al navegador.
let claves;
if (fs.existsSync(ARCHIVO_CLAVES)) {
  claves = JSON.parse(fs.readFileSync(ARCHIVO_CLAVES, "utf8"));
} else {
  claves = webpush.generateVAPIDKeys();
  fs.writeFileSync(ARCHIVO_CLAVES, JSON.stringify(claves, null, 2));
  console.log("Claves VAPID generadas en claves-vapid.json");
}
// El "subject" debe ser un mailto: o una URL tuya; el servicio de push lo usa para contactarte.
webpush.setVapidDetails("mailto:tu-correo@ejemplo.com", claves.publicKey, claves.privateKey);

// ── "Base de datos" de juguete: un JSON en disco ────────────────────────────
function leerDatos() {
  try { return JSON.parse(fs.readFileSync(ARCHIVO_DATOS, "utf8")); }
  catch { return { suscripciones: [], tareas: [], idsRecibidos: [] }; }
}
function guardarDatos(d) { fs.writeFileSync(ARCHIVO_DATOS, JSON.stringify(d, null, 2)); }

const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8" };

function leerCuerpo(req) {
  return new Promise((ok, mal) => {
    let texto = "";
    req.on("data", (t) => { texto += t; if (texto.length > 1e6) req.destroy(); });
    req.on("end", () => { try { ok(texto ? JSON.parse(texto) : {}); } catch (e) { mal(e); } });
  });
}
function responder(res, codigo, objeto) {
  res.writeHead(codigo, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(objeto));
}

async function api(req, res, ruta) {
  const datos = leerDatos();

  if (req.method === "GET" && ruta === "/api/clave-publica") return responder(res, 200, { clave: claves.publicKey });

  if (req.method === "POST" && ruta === "/api/suscribir") {
    const sub = await leerCuerpo(req);
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return responder(res, 400, { error: "suscripción incompleta" });
    datos.suscripciones = datos.suscripciones.filter((s) => s.endpoint !== sub.endpoint).concat(sub);
    guardarDatos(datos);
    return responder(res, 201, { ok: true, total: datos.suscripciones.length });
  }

  if (req.method === "POST" && ruta === "/api/desuscribir") {
    const { endpoint } = await leerCuerpo(req);
    datos.suscripciones = datos.suscripciones.filter((s) => s.endpoint !== endpoint);
    guardarDatos(datos);
    return responder(res, 200, { ok: true, total: datos.suscripciones.length });
  }

  if (req.method === "POST" && ruta === "/api/enviar-prueba") {
    const { titulo = "Gestor de Tareas", cuerpo = "Mensaje de prueba desde el servidor", url = "/index.html" } = await leerCuerpo(req);
    const mensaje = JSON.stringify({ titulo, cuerpo, url });
    const resultado = { enviados: 0, fallidos: 0, eliminadas: 0 };
    for (const sub of [...datos.suscripciones]) {
      try {
        await webpush.sendNotification(sub, mensaje, { TTL: 60 });
        resultado.enviados++;
      } catch (err) {
        resultado.fallidos++;
        // 404/410: la suscripción ya no existe (el usuario revocó el permiso o
        // desinstaló). Hay que borrarla, o se acumulan suscripciones muertas.
        if (err.statusCode === 404 || err.statusCode === 410) {
          datos.suscripciones = datos.suscripciones.filter((s) => s.endpoint !== sub.endpoint);
          resultado.eliminadas++;
        } else {
          console.error("Error al enviar push:", err.statusCode ?? "", err.message);
        }
      }
    }
    guardarDatos(datos);
    return responder(res, 200, resultado);
  }

  if (req.method === "POST" && ruta === "/api/tareas") {
    const cambio = await leerCuerpo(req);
    if (!cambio.idCambio || !cambio.datos?.titulo) return responder(res, 400, { error: "cambio inválido" });
    // IDEMPOTENCIA: si el reintento reenvía un cambio que ya llegó, no se duplica.
    if (datos.idsRecibidos.includes(cambio.idCambio)) return responder(res, 200, { ok: true, duplicado: true });
    datos.idsRecibidos.push(cambio.idCambio);
    datos.tareas.push({ ...cambio.datos, idCambio: cambio.idCambio, recibidaEn: new Date().toISOString() });
    guardarDatos(datos);
    return responder(res, 201, { ok: true });
  }

  if (req.method === "GET" && ruta === "/api/tareas") return responder(res, 200, { tareas: datos.tareas });

  return responder(res, 404, { error: "ruta de API desconocida" });
}

http.createServer(async (req, res) => {
  try {
    const ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (ruta.startsWith("/api/")) return await api(req, res, ruta);

    // Archivos estáticos. Se impide salir de la carpeta (../) y se oculta la del propio servidor.
    let archivo = path.normalize(path.join(RAIZ, ruta === "/" ? "index.html" : ruta));
    if (!archivo.startsWith(RAIZ + path.sep) || archivo.startsWith(__dirname + path.sep)) { res.writeHead(403); return res.end("Prohibido"); }
    fs.readFile(archivo, (err, contenido) => {
      if (err) { res.writeHead(404); return res.end("No encontrado"); }
      // sw.js nunca debe quedar en caché HTTP, o las actualizaciones no llegan.
      const cabeceras = { "Content-Type": TIPOS[path.extname(archivo)] ?? "application/octet-stream" };
      if (path.basename(archivo) === "sw.js") cabeceras["Cache-Control"] = "no-cache";
      res.writeHead(200, cabeceras);
      res.end(contenido);
    });
  } catch (e) {
    responder(res, 500, { error: String(e.message ?? e) });
  }
}).listen(PUERTO, () => {
  console.log("Gestor de Tareas en http://localhost:" + PUERTO);
  console.log("Clave pública VAPID:", claves.publicKey);
});
