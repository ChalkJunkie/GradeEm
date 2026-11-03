/* Grade’Em – Service Worker
   Legt alle App-Dateien beim ersten Aufruf im Cache ab; danach läuft die App
   vollständig offline. Bei einer neuen Version CACHE_VERSION erhöhen. */

const CACHE_VERSION = 'gradeem-v1.3.0';

const APP_FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/grades.js',
  './js/rubric.js',
  './js/csv.js',
  './js/sheet-data.js',
  './js/print.js',
  './js/ui.js',
  './js/docx-export.js',
  './js/raster.js',
  './js/engine.js',
  './js/raster-builtin.js',
  './js/rate-view.js',
  './js/raster-ui.js',
  './raster/index.json',
  './raster/KI-PROMPT.md',
  './raster/biologie.md',
  './raster/chemie.md',
  './raster/deutsch.md',
  './raster/englisch-kl5-ankreuzbogen.md',
  './raster/englisch-kl5-bewertungsbogen.md',
  './raster/ethik.md',
  './raster/franzoesisch.md',
  './raster/geographie.md',
  './raster/geschichte.md',
  './raster/kunst.md',
  './raster/latein.md',
  './raster/musik.md',
  './raster/religion.md',
  './raster/spanisch.md',
  './vendor/docx.min.js',
  './vendor/fonts/atkinson-hyperlegible-latin-400-normal.woff2',
  './vendor/fonts/atkinson-hyperlegible-latin-700-normal.woff2',
  './icons/icon.svg',
  './icons/apple-touch-icon.png',
  './icons/favicon-64.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_FILES.map((u) => new Request(u, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => (k.startsWith('gradeem-') || k.startsWith('tardigrader-')) && k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // keine externen Anfragen

  // Seitenaufrufe: immer die App-Shell aus dem Cache (Hash-Navigation)
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) => cached || fetch(req)),
    );
    return;
  }

  // Cache zuerst, sonst Netz (und für das nächste Mal ablegen)
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      });
    }),
  );
});
