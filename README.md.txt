Gestor de Tareas — checkpoint al cierre de la Sesión 21
Electiva - PWA · UPTC

Qué es esto
-----------
El Gestor de Tareas con las 5 estrategias de caché completas y
enrutadas por tipo de recurso (Sesión 21): Cache First para /icons/,
Network First para una futura ruta /api/ (todavía no existe en este
proyecto, queda preparada), y Stale-While-Revalidate para el resto del
shell. Es el punto de partida de la Sesión 22 (IndexedDB y Web Crypto
API) — el propio caché no cambia en esa sesión, lo que se agrega es
almacenamiento estructurado aparte, con IndexedDB. No lo reemplaces,
cotéjalo contra tu propio proyecto si te quedaste atrás.

Cómo abrirlo
------------
  1. VS Code + extensión "Live Server": clic derecho sobre index.html →
     "Open with Live Server".
  2. Terminal, parado en esta carpeta:
       python3 -m http.server 8080
     y abrir http://localhost:8080 en el navegador.

Estructura
----------
  index.html               interfaz + manifest enlazado
  manifest.json             el manifest de la Sesión 16
  sw.js                     Service Worker de la Sesión 21 (enrutado)
  icons/                    icon-192.png, icon-512.png, icon-512-maskable.png
  css/estilos.css           estilos
  app.js                    punto de entrada + registro del Service Worker
  tareas.js                 lógica: crearTarea, renderizarTarea, cargarTareas
  referencia-typescript/    versión tipada de referencia (no se ejecuta)

UPTC · Facultad de Ingeniería · Electiva - PWA
