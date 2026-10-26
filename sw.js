/* RecipeBox Remix service worker: network-first for app files, per-file cache, offline fallback.
   Cross-origin requests (recipe photos, link imports) are not handled here. */
const CACHE = 'recipebox-remix-v1';
const ASSETS = ['./', './index.html', './styles.css', './core.js', './samples.js', './app.js', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', (e) => {
  self.skipWaiting();
  // Cache each file on its own so one failed request can't break install.
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(ASSETS.map((a) => c.add(new Request(a, { cache: 'reload' })).catch(() => {})))));
});
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('recipebox-remix-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req).then((res) => {
    if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true })
    .then((r) => r || (req.mode === 'navigate' ? caches.match('./index.html').then((i) => i || caches.match('./')) : undefined))
    .then((r) => r || Response.error())));
});
