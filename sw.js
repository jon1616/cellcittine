/*
  Service worker: rende il gioco installabile e apribile anche senza rete.
  Strategia "prima la rete": se c'è connessione prende sempre la versione
  nuova (così gli aggiornamenti arrivano subito); se non c'è, usa la copia
  salvata l'ultima volta.
*/

const CACHE_VERSION = "0.15.0"; // tenere allineato a js/version.js
const CACHE = `cellcittine-${CACHE_VERSION}`;

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./vendor/peerjs.min.js",
  "./css/base.css",
  "./css/menu.css",
  "./css/games.css",
  "./js/app.js",
  "./js/state.js",
  "./js/ui.js",
  "./js/nav.js",
  "./js/room.js",
  "./js/challenge.js",
  "./js/screens/home.js",
  "./js/screens/join.js",
  "./js/screens/lobby.js",
  "./js/screens/picker.js",
  "./js/screens/catalog.js",
  "./js/screens/records.js",
  "./js/screens/results.js",
  "./js/net.js",
  "./js/utils.js",
  "./js/version.js",
  "./js/storage.js",
  "./js/packs.js",
  "./js/audio.js",
  "./js/theme.js",
  "./js/games/catalog.js",
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
  "./js/games/tocchi.js",
  "./js/games/ritmo.js",
  "./js/games/torre.js",
  "./js/games/frenata.js",
  "./js/games/cesto.js",
  "./js/games/lampi.js",
  "./js/games/meta.js",
  "./js/games/cinquesecondi.js",
  "./js/games/copia.js",
  "./js/games/anagrammi.js",
  "./js/games/altobasso.js",
  "./js/games/dieci.js",
  "./fonts/fredoka-latin.woff2",
  "./fonts/fredoka-latin-ext.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./assets/home-hero.jpg",
  "./assets/bg-base.webp",
  "./assets/bg-halloween.webp",
  "./assets/bg-natale.webp",
  "./assets/bg-estate.webp",
  "./assets/music/sottofondo.mp3",
  "./assets/icons/semaforo.webp",
  "./assets/icons/memory.webp",
  "./assets/icons/sequenza.webp",
  "./assets/icons/numeri.webp",
  "./assets/icons/bersagli.webp",
  "./assets/icons/calcoli.webp",
  "./assets/icons/colori.webp",
  "./assets/icons/precisione.webp",
  "./assets/icons/salta.webp",
  "./assets/icons/intruso.webp",
  "./assets/icons/frecce.webp",
  "./assets/icons/palloncini.webp",
  "./assets/icons/dipiu.webp",
  "./assets/icons/tocchi.webp",
  "./assets/icons/ritmo.webp",
  "./assets/icons/torre.webp",
  "./assets/icons/frenata.webp",
  "./assets/icons/cesto.webp",
  "./assets/icons/lampi.webp",
  "./assets/icons/meta.webp",
  "./assets/icons/cinquesecondi.webp",
  "./assets/icons/copia.webp",
  "./assets/icons/anagrammi.webp",
  "./assets/icons/altobasso.webp",
  "./assets/icons/dieci.webp",
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
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // Offline e non in cache: la pagina di partenza per le navigazioni,
          // "non trovato" per tutto il resto (mai HTML al posto di uno script).
          if (request.mode === "navigate") return caches.match("./index.html");
          return new Response("", { status: 404, statusText: "Offline" });
        })
      )
  );
});
