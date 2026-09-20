# CELLCITTINE — guida per chi lavora sul codice (umani e agenti)

Party game di minigiochi per telefono. Pagina web installabile (PWA), vanilla JS senza build,
multiplayer P2P (PeerJS) con modello **host-arbitro**, hosting su GitHub Pages.
Online: https://jon1616.github.io/cellcittine/ — Repo: jon1616/cellcittine (branch `main`).

## Chi decide cosa

- L'utente è il **regista**: decide cosa fare, prova sul telefono, dà feedback. Non scrive codice né grafica.
- L'agente fa **tutto il lavoro pratico** e procede **a piccoli passi**: una cosa alla volta, pubblicata e verificabile.
- Ogni aggiunta futura va prima segnata in [ROADMAP.md](ROADMAP.md) e poi spuntata quando è online.

## Regole fisse

1. **Linguaggio neutro** in tutta l'interfaccia (niente "giocatrici", "da sola"…): "chi gioca", "da soli", "In stanza".
2. **Ogni minigioco ha i suoni**: usa `sfx.play("good"|"bad"|"hit"|…)` di `js/audio.js`, mai suoni propri.
3. **Ogni minigioco dice la prestazione**: `onFinish(score, detail)` con una frase breve, e `maxScore(params)` se esiste un massimo sensato.
4. **Parametri identici per tutti**: tutto ciò che è casuale nasce in `createParams(rng, difficulty)` dal seme dell'host; `mount` non usa `Math.random()` per nulla che influenzi il punteggio.
5. **Asset esterni solo con licenza libera e salvati nel progetto** (font in `fonts/`, immagini in `assets/`), sempre elencati in PRECACHE. Grafica dei minigiochi da codice; suoni sintetizzati. Stile immagini: flat cartoon, contorni scuri (#1B1A2E), tinte piene, palette del gioco.
6. **Nessuna manche può restare bloccata**: un minigioco deve finire da solo entro `maxSeconds` anche senza tocchi (timer, limiti per tentativo).
7. **Mai credenziali** in chat, file o commit.

## Struttura

```
index.html · manifest.webmanifest · sw.js (service worker, PRECACHE + CACHE_VERSION)
css/style.css
js/app.js            telaio: schermate, sfida, manche, punteggi, scelta minigiochi, pacchetti
js/net.js            P2P (PeerJS): host(), join(), broadcast(), sendToHost(), now() sincronizzato
js/audio.js          suoni sintetizzati (WebAudio), sfx.play(nome), sfx.pad(i), sfx.step(i,n), inflate*
js/storage.js        localStorage: config sfida, record {score,text}, pacchetti personali
js/packs.js          pacchetti integrati (alcuni calcolati dal catalogo) + utilità
js/games/catalog.js  CATALOGO: scheda di ogni minigioco + loadGame(id) con import() a richiesta
js/games/shell.js    cornice comune: createShell, runTimer, runStopwatch, shuffle, fitCanvas, canvasPoint
js/games/<id>.js     logica di un minigioco (vedi contratto in semaforo.js)
js/version.js        VERSION mostrata nell'angolo
js/tester.js + test.html   tester nel browser (struttura, ogni minigioco, allenamento completo)
tools/check.mjs      controllo da riga di comando (sintassi, catalogo ↔ file ↔ sw.js, versione)
.claude/serve.js + .claude/launch.json   server locale di sviluppo (porta 8765), fuori da Git
```

## Contratto di un minigioco (`js/games/<id>.js`)

```js
export default {
  id, order: "asc"|"desc", maxSeconds,
  createParams(rng, difficulty),   // tutto il caso qui, deterministico dal seme
  formatScore(score),              // testo per classifiche e record
  isValidScore(score),             // false se non conta per i record (es. falsa partenza, 0)
  maxScore(params),                // facoltativo: massimo ottenibile
  mount(container, ctx),           // ctx.params, ctx.difficulty, ctx.onFinish(score, detail)
  unmount(),                       // ferma timer/animazioni, rimuove tutto
};
```
La scheda descrittiva (titolo, icona, categoria, abilità, durata, ritmo, comando, tag, data…) sta
**solo** in `catalog.js`. Il gioco caricato è `{...scheda, ...modulo}`.

## Aggiungere un minigioco (checklist)

1. `js/games/<id>.js` con logica + suoni + `onFinish(score, detail)` (+ `maxScore` se ha senso).
2. Scheda completa in `js/games/catalog.js` (con `added: "AAAA-MM-GG"` per il badge NUOVO).
3. Riga in `PRECACHE` di `sw.js`.
4. Stili in `css/style.css` (sezione del minigioco).
5. `node tools/check.mjs` → 0 errori; poi `test.html?auto` nel browser → 0 errori, 0 avvisi.
6. Provare a mano nel browser (viewport telefono 375×812) almeno una manche.
7. Riga nella tabella del README, voce spuntata in ROADMAP.md.
8. Versione: alzare `VERSION` in `js/version.js` **e** `CACHE_VERSION` in `sw.js` (stesso numero).
9. Commit descrittivo, push su `main`. GitHub Pages pubblica in ~1 minuto; l'app sul telefono si
   aggiorna da sola alla riapertura.

## Versioni

`MAJOR.MINOR.PATCH`: MINOR per nuove funzioni/minigiochi, PATCH per correzioni e tarature.

## Sviluppo locale

Server: `node .claude/serve.js` (o il preview "cellcittine" da `.claude/launch.json`) →
http://localhost:8765/ · Tester: http://localhost:8765/test.html?auto · Il multiplayer si prova
con due schede (host + ospite) sullo stesso PC.

## Cose che NON si fanno (decise con l'utente)

- Non riproporre Roblox o Google Play: scartati per i tempi di attesa imposti agli account nuovi.
- Avatar rimandati: per ora solo il nome.
- Tutto sbloccato: niente monete/progressione finché non richiesto.
