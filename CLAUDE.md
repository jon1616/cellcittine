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
5. **Asset e librerie esterne solo con licenza libera e salvati nel progetto** (font in `fonts/`, immagini in `assets/`, librerie in `vendor/` con il testo della licenza; mai da CDN), sempre elencati in PRECACHE. Grafica dei minigiochi da codice; suoni sintetizzati. Stile immagini: flat cartoon, contorni scuri (#1B1A2E), tinte piene, palette del gioco.
6. **Nessuna manche può restare bloccata**: un minigioco deve finire da solo entro `maxSeconds` anche senza tocchi (timer, limiti per tentativo).
7. **Mai credenziali** in chat, file o commit.
8. **Ogni file nuovo dell'app va in PRECACHE** (`sw.js`): `node tools/check.mjs` lo segnala se manca.

## Struttura

```
index.html · manifest.webmanifest · sw.js (service worker: PRECACHE + CACHE_VERSION)

css/base.css         carattere, colori (--accent segue il tema), pagina, pulsanti/campi di base, icone, toast, coriandoli
css/menu.css         schermate dei menu: card in vetro, pulsanti con luce, chip, stanza, scelta, scheda, record, classifiche, podio
css/games.css        area di gioco, cornice comune e UNA sezione per minigioco (in ordine di catalogo)

js/app.js            avvio: versione, tema, service worker, suono click, showHome()
js/state.js          stato condiviso (state.screen, net, config, challenge, round, picker…)
js/ui.js             mattoni: show(), statusLine/setStatus, toast, confetti, gameIcon/gameRow, segmented
js/nav.js            tasto indietro (guardia nella cronologia, doppia pressione per uscire)
js/room.js           stanza: createRoom, joinRoom, playSolo, leaveRoom, exitButton; collega Net alle schermate
js/challenge.js      sfida e manche: startChallenge, nextRound, conto alla rovescia, mount, punteggi, classifiche, handleMessage
js/rating.js         prestazione in percentuale (0–100) per ogni minigioco: maxScore o riferimento in REFS
js/daily.js          Sfida del giorno: piano dalla data (5 minigiochi, semi), primo tentativo, serie, testo da condividere
js/specials.js       manche speciali (punti doppi, tutto o niente, rimonta, difficile/facile, finale doppia) e difficoltà "crescente"
js/stats.js          statistiche per minigioco (recordRound a ogni manche), totali, punti forti, titolo, traguardi (ACHIEVEMENTS, checkAchievements a fine sfida)
js/commentary.js     il commentatore: frasi dopo ogni manche (commentRound) e in allenamento (commentSolo), calcolate da tutti senza rete
js/awards.js         premi di fine sfida (computeAwards dallo storico delle manche; inviati nel messaggio "final")
js/championship.js   campionato: giornate (addDay dalla classifica finale), tabella (snapshot), chiusura (endChampionship); messaggi "final.championship" e "champion"
js/teams.js          squadre: TEAMS, assegnazione bilanciata, classifica di squadra per manche (media dei membri)
js/screens/home.js   home (nome, pulsanti, collegamenti, temi)
js/screens/join.js   entra con un codice
js/screens/lobby.js  stanza + configurazione della sfida (pacchetti, manche, difficoltà; riquadro "In più": squadre, modalità, manche speciali, campionato; updateConfig/broadcastConfig)
js/screens/picker.js scelta dei minigiochi (ricerca, filtri, categorie)
js/screens/catalog.js  catalogo, scheda di un minigioco, elenco dei minigiochi della sfida
js/screens/records.js  i miei record
js/screens/history.js  storico delle sfide giocate (storage.getHistory)
js/screens/stats.js  statistiche personali e traguardi (stats.js)
js/screens/results.js  risultati di manche e podio finale
js/relay.js          server STUN + ponte TURN (Open Relay/metered.ca) se RELAY.app/apiKey sono impostati; iceServers() con credenziali temporanee
js/net.js            P2P (PeerJS): host(), join(), broadcast(), sendToHost(), now() sincronizzato; id stabile per telefono, ricollegamento automatico degli ospiti (30 s), ultimo messaggio di fase rimandato a chi rientra; server ICE da relay.js, ?rete=ponte per forzare il ponte
js/audio.js          effetti sintetizzati (sfx.play/pad/step/inflate*) + musica (sfx.setScene("menu"|"game"))
js/storage.js        localStorage: config sfida, record {score,text}, pacchetti personali, getClientId() (id stabile), storico, minigiochi già visti, risultati della Sfida del giorno
js/packs.js          pacchetti integrati (alcuni calcolati dal catalogo) + utilità
js/theme.js          temi: sfondo dei menu (assets/bg-<id>.webp), stagionali per data, scelta manuale
js/games/catalog.js  CATALOGO: scheda di ogni minigioco + loadGame(id) con import() a richiesta
js/games/shell.js    cornice comune: createShell, runTimer, runStopwatch, shuffle, fitCanvas, canvasPoint
js/games/<id>.js     logica di un minigioco (vedi contratto in semaforo.js)
js/utils.js          el(), seededRandom(), sleep(), vibrate()
js/version.js        VERSION mostrata nell'angolo
vendor/peerjs.min.js PeerJS 1.5.4 (MIT): unica libreria esterna, copiata nel progetto (niente CDN)
js/tester.js + test.html   tester nel browser (struttura, ogni minigioco, allenamento completo)
tools/check.mjs      controllo da riga di comando (sintassi, catalogo ↔ file ↔ sw.js, PRECACHE completa, versione)
tools/tester.mjs     esegue test.html in Chrome headless e stampa il rapporto (node tools/tester.mjs, --solo=<id>, --no-giochi)
.claude/serve.js + .claude/launch.json   server locale di sviluppo (porta 8765), fuori da Git
```

Difficoltà: `config.difficulty` può essere anche "crescente"; la difficoltà VERA di una manche per chi guarda è `state.round.difficulty` = `msg.difficulties[me]` (handicap personale, campo `handicap` nei partecipanti, impostato dall'host in stanza) oppure `msg.difficulty` del messaggio "start", da usare per mount, record e "Il tuo record". Le manche speciali viaggiano come `msg.special` (id in SPECIALS) e l'host applica `applySpecial` ai punti in `publishResults`.

Modalità: `config.mode` = "punti" | "eliminazione" (challenge.mode; `ch.eliminated` Map id → manche di uscita; nei messaggi "start" viaggiano `mode` e `out`, in "results" `eliminated`/`alive`; `standingsArray` mette in fondo chi è fuori con il campo `out`).

Rete: i partecipanti sono identificati dall'id stabile del telefono (`getClientId`), mai dall'id PeerJS; i messaggi di fase (start/results/final/lobby) devono poter arrivare due volte senza effetti (guardie in `handleMessage`). In locale `window.cellcittine.state` espone lo stato per le prove.

Regole di dipendenza tra i moduli: le schermate importano `state`, `ui`, i dati (catalog, storage,
packs) e le altre schermate a cui portano; nessun modulo esegue codice al caricamento che usi
un'altra schermata (i cicli di import sono ammessi solo tra funzioni). Nuova schermata = nuovo file in
`js/screens/`, una voce in `state.screen`, un caso in `goBack()` di `nav.js`, riga in PRECACHE.
Messaggi "leggeri" (non di fase, non rimandati a chi rientra): `ready` (ospite → host → tutti, chi ha il conto alla rovescia a schermo), `presence` (ospite → host, app in secondo piano → campo `away` nei partecipanti), `progress` (host → tutti a ogni punteggio ricevuto: chi ha finito, mostrato nella schermata "In attesa degli altri…" dei minigiochi con createShell), `react` (ospite → host → tutti: faccina che vola sulla riga con `data-id`).
Nuovo messaggio di fase (host → tutti, da rimandare a chi rientra): aggiungerlo a PHASE_MESSAGES in `net.js` e un caso con guardia in `handleMessage`.

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
2. Scheda completa in `js/games/catalog.js` (con `added: "AAAA-MM-GG"` per il badge NUOVO). Icona disegnata in `assets/icons/<id>.webp` (160×160, sfondo #1E1F34, stesso stile delle altre: prompt in ROADMAP/chat) e campo `image`; se manca, l'emoji `icon` fa da riserva.
3. Righe in `PRECACHE` di `sw.js`: il file js e l'icona.
4. Sezione del minigioco in fondo a `css/games.css` (prefisso di classe proprio, es. `.ten-`).
5. `node tools/check.mjs` → 0 errori; poi `node tools/tester.mjs` (test.html in Chrome headless, ~90 s) → 0 errori. Il tester aperto in una scheda del riquadro del browser nascosto è inaffidabile: Chrome rallenta i timer delle schede non visibili.
6. Provare a mano nel browser (viewport telefono 375×812) almeno una manche.
7. Riga nella tabella del README, voce spuntata in ROADMAP.md.
8. Versione: alzare `VERSION` in `js/version.js` **e** `CACHE_VERSION` in `sw.js` (stesso numero).
9. Commit descrittivo, push su `main`. GitHub Pages pubblica in ~1 minuto; l'app sul telefono si
   aggiorna da sola alla riapertura.

## Versioni

`MAJOR.MINOR.PATCH`: MINOR per nuove funzioni/minigiochi, PATCH per correzioni, tarature e manutenzione.

## Sviluppo locale

Server: `node .claude/serve.js` (o il preview "cellcittine" da `.claude/launch.json`) →
http://localhost:8765/ · Tester: `node tools/tester.mjs` (Chrome headless, consigliato) oppure
http://localhost:8765/test.html?auto in una scheda visibile (viewport desktop; non provare l'app in
un'altra scheda nel frattempo, condividono il localStorage) · Il multiplayer si prova con due schede
(host + ospite) sullo stesso PC: nella scheda ospite impostare prima `localStorage.clientId` a un
valore diverso (altrimenti l'host la scambia per sé stesso che rientra) e, se il riquadro è nascosto,
sostituire `requestAnimationFrame` con `setTimeout` in entrambe.

## Cose che NON si fanno (decise con l'utente)

- Non riproporre Roblox o Google Play: scartati per i tempi di attesa imposti agli account nuovi.
- Avatar rimandati: per ora solo il nome.
- Tutto sbloccato: niente monete/progressione finché non richiesto.
- Niente minigiochi di fortuna: la categoria Azzardo è stata eliminata (21/09/2026); in ogni minigioco deve contare un'abilità (riflessi, controllo, memoria…), mai il caso.
- Niente ponte di rete (TURN) con account esterno: deciso il 21/09/2026 per non mettere una chiave nel codice pubblico. `js/relay.js` resta predisposto e spento; non riproporlo salvo richiesta.
