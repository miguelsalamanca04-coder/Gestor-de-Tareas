// crypto.js — derivación de clave con PBKDF2 y cifrado AES-GCM.
// Construido en la Sesión 22 (IndexedDB y Web Crypto API), sección 7 y 8.
// Estas tres funciones se reutilizan SIN CAMBIOS en el Sub-bloque B
// (Sesión 33, nota de estudio del Atlas 3D) — es el mismo patrón
// aplicado a un campo distinto, no un segundo problema criptográfico.

/** Deriva una CryptoKey de AES-GCM reproducible a partir de una contraseña y una sal. */
export async function derivarClaveDesdeContrasena(contrasena, sal) {
  const materialBase = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(contrasena),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: sal, iterations: 100000, hash: "SHA-256" },
    materialBase,
    { name: "AES-GCM", length: 256 },
    false, // no exportable: se re-deriva cada vez, no se guarda
    ["encrypt", "decrypt"]
  );
}

/** Cifra un texto con AES-GCM. Devuelve el cifrado y el IV usado (ambos no secretos salvo el texto). */
export async function cifrarTexto(clave, texto) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const datos = new TextEncoder().encode(texto);
  const cifrado = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, clave, datos);
  return { cifrado, iv };
}

/** Descifra un texto cifrado con cifrarTexto(). Rechaza la promesa si la clave o el IV no coinciden. */
export async function descifrarTexto(clave, { cifrado, iv }) {
  const datos = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, clave, cifrado);
  return new TextDecoder().decode(datos);
}

/** Hash SHA-256 en hexadecimal — Sesión 22, sección 6. No se usa hoy en el Gestor de tareas,
 *  se deja aquí disponible porque la guía lo introduce como primitiva aparte del cifrado. */
export async function calcularHash(texto) {
  const datos = new TextEncoder().encode(texto);
  const buffer = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const CLAVE_SAL = "gestor-tareas-sal";

/**
 * La sal no es secreta, pero debe persistir entre sesiones del navegador para
 * que la misma contraseña siempre re-derive la misma clave. Se guarda en
 * localStorage (no en IndexedDB): es un único valor de configuración, sin
 * necesidad de índices ni consultas — justo el caso para el que localStorage
 * sí alcanza (ver la comparación de la sección 2).
 */
export function obtenerOCrearSal() {
  const guardada = localStorage.getItem(CLAVE_SAL);
  if (guardada) {
    return Uint8Array.from(atob(guardada), (c) => c.charCodeAt(0));
  }
  const sal = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(CLAVE_SAL, btoa(String.fromCharCode(...sal)));
  return sal;
}
