// Service Worker — O Meu Logbook
//
// Regras:
//  • navegações  → rede primeiro, cai para o shell em cache quando não há rede;
//  • estáticos   → cache primeiro (os ficheiros do build têm hash no nome,
//                  por isso o que está em cache nunca é a versão errada);
//  • /api/*      → nunca passa por aqui, para a app perceber que está offline
//                  e usar os dados que guardou localmente.

const CACHE_VERSION = 'logbook-v5';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
];

// Instalação: pré-cacheia o app shell.
// Um a um e com allSettled — se um ficheiro faltar, os restantes ficam na
// mesma guardados (o cache.addAll antigo era tudo-ou-nada e falhava inteiro).
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.allSettled(CORE_ASSETS.map((asset) => cache.add(asset)))
    )
  );
  self.skipWaiting();
});

// Ativação: limpa versões antigas do cache.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Outros domínios (mapas, fontes, ficheiros do Base44) seguem sem interferência.
  if (url.origin !== self.location.origin) return;

  // Chamadas à API nunca são cacheadas nem servidas do cache: sem rede têm mesmo
  // de falhar, senão a app pensa que está online e não usa os dados locais.
  if (url.pathname.startsWith('/api/')) return;

  // Navegações: rede primeiro, shell em cache como rede de segurança.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put('/index.html', clone));
          }
          return res;
        })
        .catch(() =>
          caches.match('/index.html').then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  // Estáticos: cache primeiro, com atualização em segundo plano.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
