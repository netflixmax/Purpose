// Service Worker — 让读志可离线打开 / 加到主屏后像 native app
const CACHE = "duzhi-v1";
const ASSETS = [
  ".",
  "index.html",
  "styles.css",
  "app.js",
  "lenses.js",
  "storage.js",
  "midwife.js",
  "manifest.json",
  "icon.svg",
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
            // 同源资源运行时缓存
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
