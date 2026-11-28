const CACHE = 'efel-prod38';
const MEDIA_CACHE = 'efel-media-v1';
const MEDIA_LIMIT = 200;
const ROOT = new URL(self.registration.scope).pathname;
const CORE = ['./', 'index.html', 'config.js', 'logo.jpg', 'icon-192.png',
  'app.js?v=efel-prod38', 'assets/ui/economy-model.js?v=efel-prod38', 'assets/ui/league.css?v=efel-prod38', 'assets/ui/v5.css?v=efel-prod38'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('efel-') && key !== CACHE && key !== MEDIA_CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin || !url.pathname.startsWith(ROOT)) return;
  // Player photos and card sprite sheets survive app releases. Only public static assets are stored here.
  const playerMedia = /\/(?:assets\/players|sp)\/[a-zA-Z0-9_-]+\.(?:webp|jpg|png)$/i.test(url.pathname);
  if (playerMedia) {
    event.respondWith((async () => {
      const cache = await caches.open(MEDIA_CACHE);
      const hit = await cache.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      if (response.ok && response.status === 200) {
        await cache.put(request, response.clone()).catch(() => {});
        const keys = await cache.keys();
        await Promise.all(keys.slice(0, Math.max(0, keys.length - MEDIA_LIMIT)).map(key => cache.delete(key)));
      }
      return response;
    })());
    return;
  }
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
