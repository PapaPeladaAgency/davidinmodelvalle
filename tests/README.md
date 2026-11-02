# Pruebas automatizadas (Playwright)

Requiere `npm i playwright three@0.165.0 jspdf@2.5.1` en esta carpeta y Chromium.
Las pruebas sirven `../dist` localmente y redirigen las librerías de los CDN a `node_modules`.

- `test8.js [m]` — experiencia web app completa (portada, pestañas, ficha, cuota, favoritos, contacto, cita, apartado, PDF, compartir, inglés, panel). `m` = teléfono.
- `test5.js [m]` — explorador por etapa/manzana, encuadres, áreas comunes, reserva y presentación guiada.
- `test6.js` / `test7.js` — capturas de realismo y del Modo foto.
- `ktx2png.mjs` — convierte texturas KTX2 (Basis) a imágenes, usado para preparar `dist/tex/`.
