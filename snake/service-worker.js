const CACHE_NAME = "snake-v3";
const ASSETS = [
  "/snake/",
  "/snake/index.html",
  "/snake/leaderboard.html",
  "/snake/manifest.json",
  "/snake/icon-192.png",
  "/snake/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  e.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((resp) => {
        if (req.method === "GET" && resp.ok && new URL(req.url).origin === location.origin) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return resp;
      }).catch(() => caches.match("/snake/index.html"))
    )
  );
});