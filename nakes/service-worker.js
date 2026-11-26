const CACHE_NAME = "nakes-v8-wide-arena";
const ASSETS = [
  "/assets/site-theme.css?v=20261116-sitewide-theme",
  "/assets/site-shell.js?v=20261116-sitewide-theme",
  "/nakes/",
  "/nakes/index.html",
  "/nakes/leaderboard.html",
  "/nakes/prize.js",
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
      Promise.all(keys.filter(k => k.startsWith("nakes-") && k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if(req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // Prefer the current deployment; keep the cached assets for offline play.
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    try {
      const response=await fetch(req, {cache:"no-cache"});
      if(response.ok) await cache.put(req,response.clone());
      return response;
    } catch {
      return (await cache.match(req)) || (req.mode==="navigate" && await cache.match("/nakes/index.html")) || Response.error();
    }
  })());
});
