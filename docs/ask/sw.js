// 问志 Service Worker — scope 为 /ask/，与读志的 SW 互不干扰
const CACHE = "wenzhi-v1";
const ASSETS = [
  ".",
  "index.html",
  "app.js",
  "lenses.js",
  "storage.js",
  "midwife.js",
  "manifest.json",
  "icon.svg",
  "../styles.css",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ||
        fetch(e.request)
          .then((resp) => {
            if (resp.ok && new URL(e.request.url).origin === location.origin) {
              const clone = resp.clone();
              caches.open(CACHE).then((c) => c.put(e.request, clone));
            }
            return resp;
          })
          .catch(() => cached),
    ),
  );
});
