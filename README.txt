Gestor de Tareas — checkpoint al cierre de la Sesión 20
Electiva - PWA · UPTC

Qué es esto
-----------
El Gestor de Tareas con su primera estrategia de caché con nombre
(Sesión 20): el manejador de fetch ahora implementa Cache First de
verdad — consulta el caché primero, y si no encuentra el recurso, lo
pide a la red y lo guarda con cache.put() para la próxima vez. Se
aplica igual a todo el shell porque enrutar distintas estrategias según
el tipo de recurso (imágenes, API, HTML/CSS/JS) es justo el trabajo de
la Sesión 21, con Network First y Stale-While-Revalidate ya sumadas al
repertorio. Es el punto de partida de hoy: no lo reemplaces, cotéjalo
contra tu propio proyecto si te quedaste atrás.

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
  sw.js                     Service Worker de la Sesión 20 (Cache First)
  icons/                    icon-192.png, icon-512.png, icon-512-maskable.png
  css/estilos.css           estilos
  app.js                    punto de entrada + registro del Service Worker
  tareas.js                 lógica: crearTarea, renderizarTarea, cargarTareas
  referencia-typescript/    versión tipada de referencia (no se ejecuta)

UPTC · Facultad de Ingeniería · Electiva - PWA
