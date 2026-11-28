const CACHE = 'efel-prod09';
const ROOT = new URL(self.registration.scope).pathname;
const CORE = ['./', 'index.html', 'config.js', 'logo.jpg', 'icon-192.png',
  'app.js?v=efel-prod09', 'assets/ui/economy-model.js?v=efel-prod09', 'assets/ui/league.css?v=efel-prod09', 'assets/ui/v5.css?v=efel-prod09'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('efel-') && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin || !url.pathname.startsWith(ROOT)) return;
  const media = /\.(webp|jpg|png)$/i.test(url.pathname);
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (media) {
      const hit = await cache.match(request);
      if (hit) return hit;
    }
    try {
      const response = await fetch(request);
      if (response.ok && response.status === 200) {
        await cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (error) {
      const hit = await cache.match(request);
      if (hit) return hit;
      throw error;
    }
  })());
});
