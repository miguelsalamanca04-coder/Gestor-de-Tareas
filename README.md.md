# &#x20;   Gestor de Tareas — checkpoint al cierre de la Sesión 16

# Electiva - PWA · UPTC

# 

# Qué es esto

# \-----------

# El Gestor de Tareas ya con su manifest.json (Sesión 16): nombre, colores,

# modo de visualización e íconos (192×192, 512×512 y 512×512 maskable) listos

# y enlazados en index.html. Todavía NO tiene Service Worker — ese es el

# trabajo de la Sesión 17. Es el punto de partida de hoy: no lo reemplaces,

# cotéjalo contra tu propio proyecto si te quedaste atrás en la Sesión 16.

# 

# Cómo abrirlo

# \------------

# Usa módulos de JavaScript (export/import), así que hace falta un servidor

# local:

# 

# &#x20; 1. VS Code + extensión "Live Server": clic derecho sobre index.html →

# &#x20;    "Open with Live Server".

# &#x20; 2. Terminal, parado en esta carpeta:

# &#x20;      python3 -m http.server 8080

# &#x20;    y abrir http://localhost:8080 en el navegador.

# 

# Estructura

# \----------

# &#x20; index.html               interfaz + manifest enlazado

# &#x20; manifest.json             el manifest de la Sesión 16

# &#x20; icons/                    icon-192.png, icon-512.png, icon-512-maskable.png

# &#x20; css/estilos.css           estilos

# &#x20; app.js                    punto de entrada

# &#x20; tareas.js                 lógica: crearTarea, renderizarTarea, cargarTareas

# &#x20; referencia-typescript/    versión tipada de referencia (no se ejecuta)

# 

# UPTC · Facultad de Ingeniería · Electiva - PWA



