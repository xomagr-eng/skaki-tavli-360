/* ΣΚΑΚΙ & ΤΑΒΛΙ 360° — Service Worker (offline PWA) */
const CACHE = "skakitavli-v15";
const ASSETS = [
  "./", "./index.html", "./manifest.webmanifest",
  "./css/style.css",
  "./js/sfx.js", "./js/pieces.js", "./js/chess-engine.js", "./js/chess-ui.js",
  "./js/content.js", "./js/tavli.js", "./js/app.js",
  "./assets/grain.svg", "./assets/icon-192.png", "./assets/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Ο νέος SW ενεργοποιείται μόνο όταν ο χρήστης πατήσει «Ανανέωση»
self.addEventListener("message", (e) => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached || fetch(e.request).then((resp) => {
        try {
          if (resp.ok && new URL(e.request.url).origin === location.origin) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
        } catch (err) {}
        return resp;
      }).catch(() => caches.match("./index.html"))
    )
  );
});
