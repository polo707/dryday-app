/**
 * DryDay service worker: lets the app be installed, open without a connection,
 * and receive daily reminders (Web Push).
 * Strategy: network first with a time limit; the saved copy is used offline or on a very slow connection.
 * When you publish big changes, bump VERSION to clear old copies.
 */
const VERSION = 'v5';
const NETWORK_TIMEOUT = 3500; // ms
const CACHE = `dryday-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './program.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // One by one: if a file fails, the rest is still saved.
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => null))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('dryday-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !isFont) return;
  if (sameOrigin && url.pathname.includes('/api/')) return;
  // The iPhone preview page (preview.html) is a dev tool: never cache it as the app page.
  if (sameOrigin && url.pathname.endsWith('/preview.html')) return;

  // Fonts: cache first (they don't change).
  if (isFont) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })),
    );
    return;
  }

  // App: network first, saved copy if offline or too slow.
  const isPage = req.mode === 'navigate';
  const key = isPage ? new URL('./', self.registration.scope).href : req;
  const fromCache = () => caches.match(key, { ignoreSearch: true });
  const fromNetwork = fetch(req).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(key, copy));
    }
    return res;
  });
  event.respondWith(new Promise((resolve) => {
    let done = false;
    const finish = (res) => { if (!done && res) { done = true; resolve(res); } };
    const timer = setTimeout(() => fromCache().then(finish), NETWORK_TIMEOUT);
    fromNetwork
      .then((res) => { clearTimeout(timer); finish(res); })
      .catch(() => { clearTimeout(timer); fromCache().then((hit) => finish(hit || Response.error())); });
  }));
});

// ── Daily reminders (Web Push) ──
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'DryDay', {
    body: data.body || 'Your 5-minute routine is ready',
    icon: new URL('icons/icon-192.png', self.registration.scope).href,
    badge: new URL('icons/icon-192.png', self.registration.scope).href,
    tag: data.tag || 'dryday-daily',
    data: { url: data.url || self.registration.scope },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || self.registration.scope, self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => new URL(c.url).origin === self.location.origin);
      if (open) return open.focus();
      return self.clients.openWindow(target);
    }),
  );
});
