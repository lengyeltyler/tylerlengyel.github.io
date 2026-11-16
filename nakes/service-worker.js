const CACHE_NAME = "nakes-v5-sitewide-theme";
const ASSETS = [
  "/assets/site-theme.css?v=20261116-sitewide-theme",
  "/assets/site-shell.js?v=20261116-sitewide-theme",
  "/nakes/",
  "/nakes/index.html",
  "/nakes/leaderboard.html",
  "/nakes/manifest.json",
  "/nakes/icon-192.png",
  "/nakes/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
  self.skipWaiting(); // take over immediately
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
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
      }).catch(() => caches.match("/nakes/index.html"))
    )
  );
});