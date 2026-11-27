    Gestor de Tareas — checkpoint al cierre de la Sesión 16
Electiva - PWA · UPTC

Qué es esto
-----------
El Gestor de Tareas ya con su manifest.json (Sesión 16): nombre, colores,
modo de visualización e íconos (192×192, 512×512 y 512×512 maskable) listos
y enlazados en index.html. Todavía NO tiene Service Worker — ese es el
trabajo de la Sesión 17. Es el punto de partida de hoy: no lo reemplaces,
cotéjalo contra tu propio proyecto si te quedaste atrás en la Sesión 16.

Cómo abrirlo
------------
Usa módulos de JavaScript (export/import), así que hace falta un servidor
local:

  1. VS Code + extensión "Live Server": clic derecho sobre index.html →
     "Open with Live Server".
  2. Terminal, parado en esta carpeta:
       python3 -m http.server 8080
     y abrir http://localhost:8080 en el navegador.

Estructura
----------
  index.html               interfaz + manifest enlazado
  manifest.json             el manifest de la Sesión 16
  icons/                    icon-192.png, icon-512.png, icon-512-maskable.png
  css/estilos.css           estilos
  app.js                    punto de entrada
  tareas.js                 lógica: crearTarea, renderizarTarea, cargarTareas
  referencia-typescript/    versión tipada de referencia (no se ejecuta)

UPTC · Facultad de Ingeniería · Electiva - PWA
