const CACHE_VERSION = "v12";
const CACHE_NAME = `manuale-cache-${CACHE_VERSION}`;

const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./pdfs.json",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

// Network-first dla app.js i pdfs.json (żeby nie trzymał starego)
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  const isSameOrigin = url.origin === self.location.origin;
  if (!isSameOrigin) return;

  const path = url.pathname;

  const networkFirst = (
    path.endsWith("/app.js") ||
    path.endsWith("/pdfs.json") ||
    path.endsWith("/index.html") ||
    path.endsWith("/") ||
    path.endsWith("/styles.css")
  );

  if (networkFirst) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(event.request);
        return cached || Response.error();
      }
    })());
    return;
  }

  // default: cache-first
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    const fresh = await fetch(event.request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(event.request, fresh.clone());
    return fresh;
  })());
});
