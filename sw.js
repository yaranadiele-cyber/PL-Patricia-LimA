const CACHE_NAME = "patricia-lima-v1";
const ARQUIVOS_CACHE = [
  "/","/index.html","/agendamento.html","/pre-atendimento.html",
  "/quem-sou.html","/style.css","/script.js","/agendamento.js",
  "/supabase.js","/manifest.json","/icons/icon-192.png","/icons/icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(ARQUIVOS_CACHE).catch(err => console.warn("Cache parcial:", err))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request).then(response => {
      if (response && response.status === 200 && e.request.method === "GET") {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      }
      return response;
    }).catch(() =>
      caches.match(e.request).then(cached => cached || caches.match("/index.html"))
    )
  );
});
