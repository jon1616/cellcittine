/*
  Service worker: rende il gioco installabile e apribile anche senza rete.
  Strategia "prima la rete": se c'è connessione prende sempre la versione
  nuova (così gli aggiornamenti arrivano subito); se non c'è, usa la copia
  salvata l'ultima volta.
*/

const CACHE_VERSION = "0.5.1"; // tenere allineato a js/version.js
const CACHE = `cellcittine-${CACHE_VERSION}`;

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/app.js",
  "./js/net.js",
  "./js/utils.js",
  "./js/version.js",
  "./js/games/catalog.js",
  "./js/packs.js",
  "./js/audio.js",
  "./js/games/shell.js",
  "./js/games/semaforo.js",
  "./js/games/memory.js",
  "./js/games/sequenza.js",
  "./js/games/numeri.js",
  "./js/games/bersagli.js",
  "./js/games/calcoli.js",
  "./js/games/colori.js",
  "./js/games/precisione.js",
  "./js/games/salta.js",
  "./js/games/intruso.js",
  "./js/games/frecce.js",
  "./js/games/palloncini.js",
  "./js/games/dipiu.js",
  "./js/storage.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // "reload": ignora la cache HTTP del browser, prende i file freschi dal server
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // "no-cache": chiede sempre al server se il file è cambiato (risposta
  // minuscola se non lo è), invece di fidarsi della cache HTTP per 10 minuti.
  event.respondWith(
    fetch(request, { cache: "no-cache" })
      .then((response) => {
        if (response.ok && new URL(request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
  );
});
