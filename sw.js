/* Офлайн-кэш. При смене VERSION старый кэш удаляется целиком. */
const VERSION = '1.0.0';
const CACHE = 'grammar-' + VERSION;
const FILES = ['./', 'index.html', 'app.js', 'topics.js', 'stock-a1.js', 'stock-a2.js', 'stock-b1.js', 'stock-b2.js', 'words.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-192.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('grammar-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Свои файлы: сразу из кэша, а в фоне подтягиваем свежую копию. Чужие адреса (Gemini) не трогаем.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await cache.match('index.html') : null);
    const net = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => { if (res && res.ok && res.type === 'basic') cache.put(req, res.clone()); return res; });
    if (hit) { e.waitUntil(net.catch(() => { })); return hit; }
    return net;
  }));
});
