// Service worker SAPA RT — cache "app shell" statis agar aplikasi tetap terbuka
// (walau data dari Google Sheets butuh koneksi). PENTING: respons API (/api),
// Apps Script, dan pembacaan data TIDAK pernah di-cache; data selalu dari jaringan.
const CACHE = 'sapa-rt-static-v97';

// Berkas inti (app shell) yang di-precache saat instalasi.
const SHELL = [
  './',
  './index.html',
  './public.html',
  './tailwind.css',
  './fonts.css?v=3',
  './fonts/inter-latin.woff2?v=3',
  './fonts/fa-solid.woff2?v=3',
  './fonts/fa-regular.woff2?v=3',
  './fonts/fa-brands.woff2?v=3',
  './config.js',
  './rt-icon.png',
  './icon-192.png',
  './apple-touch-icon.png',
  './favicon.ico',
  './manifest.webmanifest',
  './manifest-public.webmanifest'
];

// Host aset statis lintas-situs yang aman di-cache (font/ikon).
// Ikon & font kini self-hosted (same-origin), sehingga tidak ada host CDN di sini.
const STATIC_HOSTS = [];
// Host yang harus selalu langsung ke jaringan (jangan pernah di-cache).
const BYPASS_HOSTS = ['script.google.com', 'script.googleusercontent.com'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.allSettled(SHELL.map((u) => cache.add(u))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // jangan campuri operasi tulis

  const url = new URL(req.url);
  if (BYPASS_HOSTS.indexOf(url.hostname) !== -1) return;

  // Same-origin
  if (url.origin === self.location.origin) {
    // API proxy: selalu jaringan, jangan di-cache.
    if (url.pathname === '/api' || url.pathname.indexOf('/api/') === 0) return;
    // Navigasi HTML: network-first, fallback app shell saat offline.
    if (req.mode === 'navigate') { event.respondWith(networkFirstNav(req)); return; }
    // Berkas versi/skrip SW: network-first supaya tidak basi.
    if (url.pathname === '/config.js' || url.pathname === '/version.json' || url.pathname === '/sw.js') {
      event.respondWith(networkFirst(req));
      return;
    }
    // Sisa aset statis: stale-while-revalidate.
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Aset statis lintas-situs (font/ikon): stale-while-revalidate.
  if (STATIC_HOSTS.indexOf(url.hostname) !== -1) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
  // Host lain: jangan campuri.
});

async function networkFirstNav(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const url = new URL(req.url);
    const fallback = url.pathname.indexOf('/public') === 0 ? './public.html' : './index.html';
    const cached = (await cache.match(req)) || (await cache.match(fallback));
    if (cached) return cached;
    throw e;
  }
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw e;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const network = fetch(req).then((res) => {
    // Respons opaque (no-cors) punya status 0; tetap boleh di-cache.
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return cached || network;
}
