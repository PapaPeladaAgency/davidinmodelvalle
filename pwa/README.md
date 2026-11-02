# Instalación como app (PWA) — para dominio propio

Dentro de claude.ai los service workers no están permitidos, por eso la app no se puede instalar desde ese enlace.
Al publicarla en un dominio propio (por ejemplo `app.vallesansebastian.com`):

1. Copiar `dist/` completo al servidor junto con estos tres archivos (`manifest.webmanifest`, `sw.js`, `icon.svg`).
2. Agregar en el `<head>` de `index.html`:
   ```html
   <link rel="manifest" href="manifest.webmanifest">
   <meta name="theme-color" content="#2b3f8f">
   <link rel="icon" href="icon.svg">
   <script>if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');</script>
   ```
3. Servir por HTTPS. Chrome y Android ofrecerán "Instalar app"; en iPhone: Compartir → "Agregar a inicio".
