// service-worker.js — Bolinha da Copa
//
// Estratégia:
// - Página principal (navegação): tenta a rede primeiro, pra sempre pegar a
//   versão mais nova do site quando o celular está online. Se estiver
//   offline, usa a última cópia salva.
// - Arquivos locais do app (manifest, ícones): cache-first, raramente mudam.
// - Tudo que é de outro domínio (Firebase, Google Fonts, CDN do Tesseract
//   etc.) NUNCA é interceptado — passa direto pra rede, sem cache. Isso evita
//   quebrar a sincronização em tempo real do Firebase.

const CACHE_NAME = 'bolinha-da-copa-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ---- Instalação: guarda o "esqueleto" do app no cache ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ---- Ativação: limpa caches de versões antigas ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// ---- Busca de recursos ----
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Nunca mexer em requisições de outros domínios (Firebase, fontes, CDNs).
  // Deixa o navegador cuidar normalmente, sem cache nem interceptação.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Só lidamos com GET — POST/PUT (ex: chamadas internas) seguem direto.
  if (req.method !== 'GET') {
    return;
  }

  // Navegação (abrir/recarregar a página): network-first.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Demais arquivos locais (ícones, manifest): cache-first.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      });
    })
  );
});
