/*
  Service worker: rende il gioco installabile e apribile anche senza rete.
  Strategia "prima la rete": se c'è connessione prende sempre la versione
  nuova (così gli aggiornamenti arrivano subito); se non c'è, usa la copia
  salvata l'ultima volta.
*/

const CACHE_VERSION = "0.43.0"; // tenere allineato a js/version.js
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
  "./js/awards.js",
  "./js/teams.js",
  "./js/relay.js",
  "./js/rating.js",
  "./js/daily.js",
  "./js/specials.js",
  "./js/commentary.js",
  "./js/stats.js",
  "./js/championship.js",
  "./js/screens/stats.js",
  "./js/screens/home.js",
  "./js/screens/join.js",
  "./js/screens/lobby.js",
  "./js/screens/picker.js",
  "./js/screens/catalog.js",
  "./js/screens/records.js",
  "./js/screens/history.js",
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
  "./js/games/dieci.js",
  "./js/games/labirinto.js",
  "./js/games/melodia.js",
  "./js/games/ordina.js",
  "./js/games/parola.js",
  "./js/games/tris.js",
  "./js/games/pesca.js",
  "./js/games/traiettoria.js",
  "./js/games/capitali.js",
  "./js/games/talpe.js",
  "./js/games/lampadine.js",
  "./js/games/sfuggente.js",
  "./js/games/suoni.js",
  "./js/games/cosamanca.js",
  "./js/games/cifre.js",
  "./js/games/quanti.js",
  "./js/games/gemelli.js",
  "./js/games/bussolotti.js",
  "./js/games/equilibrio.js",
  "./js/games/serpente.js",
  "./js/games/strada.js",
  "./js/games/bilancia.js",
  "./js/games/prossimo.js",
  "./js/games/orologio.js",
  "./js/games/ortografia.js",
  "./js/games/rime.js",
  "./js/games/contrari.js",
  "./js/games/specchio.js",
  "./js/games/maggiore.js",
  "./js/games/sillabe.js",
  "./js/games/manopola.js",
  "./js/games/alvolo.js",
  "./js/games/percorso.js",
  "./js/games/resto.js",
  "./js/games/lettere.js",
  "./js/games/cerchi.js",
  "./js/games/rimbalzo.js",
  "./js/games/abbinamenti.js",
  "./js/games/plurali.js",
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
  "./assets/icons/dieci.webp",
  "./assets/icons/labirinto.webp",
  "./assets/icons/melodia.webp",
  "./assets/icons/ordina.webp",
  "./assets/icons/parola.webp",
  "./assets/icons/tris.webp",
  "./assets/icons/pesca.webp",
  "./assets/icons/traiettoria.webp",
  "./assets/icons/capitali.webp",
  "./assets/icons/talpe.webp",
  "./assets/icons/lampadine.webp",
  "./assets/icons/sfuggente.webp",
  "./assets/icons/suoni.webp",
  "./assets/icons/cosamanca.webp",
  "./assets/icons/cifre.webp",
  "./assets/icons/quanti.webp",
  "./assets/icons/gemelli.webp",
  "./assets/icons/bussolotti.webp",
  "./assets/icons/equilibrio.webp",
  "./assets/icons/serpente.webp",
  "./assets/icons/strada.webp",
  "./assets/icons/bilancia.webp",
  "./assets/icons/prossimo.webp",
  "./assets/icons/orologio.webp",
  "./assets/icons/ortografia.webp",
  "./assets/icons/rime.webp",
  "./assets/icons/contrari.webp",
  "./assets/icons/specchio.webp",
  "./assets/icons/maggiore.webp",
  "./assets/icons/sillabe.webp",
  "./assets/icons/manopola.webp",
  "./assets/icons/alvolo.webp",
  "./assets/icons/percorso.webp",
  "./assets/icons/resto.webp",
  "./assets/icons/lettere.webp",
  "./assets/icons/cerchi.webp",
  "./assets/icons/rimbalzo.webp",
  "./assets/icons/abbinamenti.webp",
  "./assets/icons/plurali.webp",
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
