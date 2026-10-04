// ---------------------------------------------------------------------------
// Gera o service worker depois da construção.
//
// O problema que isto resolve: os ficheiros de código produzidos pelo Vite
// têm um código aleatório no nome, que muda a cada publicação. Um service
// worker escrito à mão não os pode nomear, e por isso nunca os guardava —
// sem rede, a página abria e ficava à espera de um ficheiro que não estava
// em lado nenhum. Ecrã branco.
//
// Aqui lemos a pasta dist já construída, juntamos a lista real dos ficheiros
// e escrevemos o service worker com essa lista lá dentro.
// ---------------------------------------------------------------------------

import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = 'dist';

// Ficheiros que não vale a pena guardar em cache.
const IGNORAR = new Set(['sw.js', '_headers', '_redirects']);

function listar(dir) {
  const out = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      out.push(...listar(caminho));
    } else {
      out.push('/' + relative(DIST, caminho).split('\\').join('/'));
    }
  }
  return out;
}

const ficheiros = listar(DIST)
  .filter((f) => !IGNORAR.has(f.slice(1)))
  .sort();

// A versão muda sempre que a lista de ficheiros muda, o que faz o browser
// descartar a cache antiga e guardar a nova.
const versao = 'logbook-' + Buffer.from(ficheiros.join('|'))
  .toString('base64')
  .replace(/[^a-z0-9]/gi, '')
  .slice(-12);

const sw = `// Service Worker — O Meu Logbook
// GERADO AUTOMATICAMENTE por scripts/gerar-sw.mjs. Não editar à mão.
//
// Guarda todos os ficheiros da aplicação no momento da instalação, para que
// ela abra sem rede mesmo depois de uma publicação nova.

const CACHE_VERSION = '${versao}';

const CORE_ASSETS = ${JSON.stringify(['/', ...ficheiros], null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.allSettled(CORE_ASSETS.map((asset) => cache.add(asset)))
    )
  );
  self.skipWaiting();
});

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

  // Outros domínios seguem sem interferência.
  if (url.origin !== self.location.origin) return;

  // Navegações: tenta a rede, mas com paciência curta.
  //
  // Sem rede, o pedido falha logo e servimos a cópia local. O caso mau é a
  // rede meia-ligada — telemóvel agarrado à antena mas sem dados a passar —
  // em que o pedido não falha, fica pendurado, e a app fica em branco à
  // espera dele. Daí o limite de dois segundos: passado esse tempo servimos
  // o que temos guardado e deixamos a rede continuar em segundo plano.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const daRede = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('/index.html', clone));
        }
        return res;
      });

      const daCache = caches.match('/index.html').then((c) => c || caches.match('/'));

      const limite = new Promise((resolve) => setTimeout(() => resolve('demorou'), 2000));

      try {
        const corrida = await Promise.race([daRede, limite]);
        if (corrida !== 'demorou') return corrida;
      } catch {
        // A rede falhou: segue para a cópia local.
      }

      const guardada = await daCache;
      if (guardada) return guardada;

      // Sem cópia local não há alternativa senão esperar pela rede.
      return daRede;
    })());
    return;
  }

  // Ficheiros: cache primeiro. Os nomes têm código próprio, por isso o que
  // está em cache nunca é a versão errada.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
        }
        return res;
      });
    })
  );
});
`;

writeFileSync(join(DIST, 'sw.js'), sw);

console.log(`Service worker gerado: ${ficheiros.length + 1} ficheiros em cache (${versao})`);
