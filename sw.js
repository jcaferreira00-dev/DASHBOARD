// Suba o número da versão sempre que fizer deploy de mudanças —
// isso força o navegador a descartar o cache antigo.
const CACHE = "carteira-v3";

const ASSETS = [
  "./", "./index.html", "./manifest.json", "./cloud-sync.js",
  "./icon-192.png", "./icon-512.png",
  "./icon-192-maskable.png", "./icon-512-maskable.png",
  "./apple-touch-icon.png", "./favicon-32x32.png", "./favicon-16x16.png", "./favicon.ico"
];

// Arquivos que mudam com frequência (código do app) — sempre busca da rede primeiro.
const NETWORK_FIRST = [".html", ".js", ".json"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting(); // ativa a nova versão imediatamente, sem esperar todas as abas fecharem
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim(); // assume o controle das abas já abertas
});

function isNetworkFirst(url) {
  return NETWORK_FIRST.some((ext) => url.pathname.endsWith(ext)) || url.pathname.endsWith("/");
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  if (isNetworkFirst(url)) {
    // REDE PRIMEIRO: tenta buscar a versão mais nova; só usa o cache se estiver offline.
    e.respondWith(
      fetch(e.request, { cache: "no-store" })
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // CACHE PRIMEIRO: ícones e outros arquivos estáticos que raramente mudam.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Permite forçar a atualização a partir da própria página, se necessário
// (ex: chamar navigator.serviceWorker.controller.postMessage('SKIP_WAITING')).
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});
