const CACHE = "pdf-lib-v1";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./pdfs.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// cache-first dla apki, network dla pdfs.json (żeby łatwo aktualizować listę)
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null))))
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // zawsze próbuj pobrać świeżą listę, a jak brak neta to z cache
  if (url.pathname.endsWith("/pdfs.json")) {
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // reszta cache-first
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
