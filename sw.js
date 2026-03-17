// ═══════════════════════════════════════════
//  SERVICE WORKER — Patricia Lima PWA v3
//  Funciona no Vercel com caminhos relativos
// ═══════════════════════════════════════════
const CACHE_NAME = "patricia-lima-v3";

// arquivos principais — caminhos relativos ao sw.js
const CORE = [
  "./index.html",
  "./style.css",
  "./manifest.json"
];

// instala: cacheia só o essencial, um por um sem travar
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const url of CORE) {
        try { await cache.add(url); } catch {}
      }
    })
  );
  self.skipWaiting();
});

// ativa: remove caches antigos
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// fetch: rede primeiro, cache como fallback offline
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // ignora requisições externas (Supabase, Google Fonts, CDN)
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // cacheia automaticamente toda resposta boa
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(e.request, clone))
            .catch(() => {});
        }
        return response;
      })
      .catch(() =>
        // sem internet: usa cache ou volta para index
        caches.match(e.request)
          .then(cached => cached || caches.match("./index.html"))
      )
  );
});
