// Service worker para la versión publicada en dominio propio (no aplica dentro de claude.ai)
const CACHE = 'vss-v1';
const CORE = ['./', './index.html', './plano-original.jpg', './icon.svg', './manifest.webmanifest'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// Texturas y librerías: primero caché, luego red (rápido al volver); página: primero red, luego caché (siempre actualizada)
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const isAsset = u.pathname.includes('/tex/') || u.hostname.includes('jsdelivr') || u.hostname.includes('cdnjs');
  e.respondWith(isAsset
    ? caches.match(e.request).then(r => r || fetch(e.request).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return res; }))
    : fetch(e.request).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return res; }).catch(() => caches.match(e.request)));
});
