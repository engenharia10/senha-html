/* ═══════════════════════════════════════════
   Alfatronic — Service Worker (PWA offline)
═══════════════════════════════════════════ */

const CACHE_NAME = 'alfatronic-v12';

const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon.svg',
    './app.js',
    './device-code-fallback.js'
];

/* Instala e pré-cacheia os arquivos essenciais */
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

/* Remove caches de versões anteriores */
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

/* Cache-first: responde do cache; se não houver, busca na rede */
self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});
