# Cellcittine

Party game di 68 minigiochi per telefono, giocabile da soli o in gruppo (2-6 persone)
tramite codice stanza. È una pagina web installabile (PWA): niente store, aggiornamenti istantanei.

**Gioco online:** https://jon1616.github.io/cellcittine/

Documenti di lavoro: [CLAUDE.md](CLAUDE.md) (regole e checklist per chi lavora sul codice) · [ROADMAP.md](ROADMAP.md) (cosa è fatto e cosa viene dopo).

## Struttura

```
index.html              pagina unica
manifest.webmanifest    installazione come app
sw.js                   funzionamento offline (PRECACHE di tutti i file; CACHE_VERSION a ogni release)
css/base.css            carattere, colori, pagina, pulsanti e campi di base, icone, toast, coriandoli
css/menu.css            schermate dei menu (card, pulsanti con luce, stanza, scelta, classifiche, podio)
css/games.css           area di gioco, cornice comune e una sezione per minigioco
js/app.js               avvio (versione, tema, service worker, suono click)
js/state.js             stato condiviso dell'app
js/ui.js                mattoni dell'interfaccia (schermate, stato, toast, icone, righe)
js/nav.js               tasto indietro di Android
js/room.js              stanza: crea / entra / allenamento / esci
js/challenge.js         sfida e manche: avvio, conto alla rovescia, punteggi, classifiche, messaggi
js/screens/*.js         una schermata per file: home, join, lobby, picker, catalog, records, history, stats, results
js/net.js               collegamento P2P (PeerJS), modello host-arbitro
js/packs.js             pacchetti di minigiochi (integrati + personali)
js/storage.js           salvataggi: configurazione, record, pacchetti personali
js/games/catalog.js     CATALOGO: scheda di ogni minigioco + caricamento a richiesta
js/games/shell.js       cornice comune ai minigiochi (timer, cronometro, canvas)
js/games/<id>.js        codice di un minigioco (caricato solo quando serve)
js/rating.js            prestazione in percentuale per ogni minigioco (Sfida del giorno, statistiche)
js/daily.js             Sfida del giorno: stessi 5 minigiochi per tutti, primo tentativo, serie, condivisione
js/specials.js          manche speciali (punti doppi, tutto o niente, rimonta…) e difficoltà crescente
js/commentary.js        il commentatore (frasi dopo ogni manche)
js/stats.js             statistiche personali e traguardi
js/championship.js      campionato a giornate
js/awards.js            premi di fine sfida · js/teams.js squadre
js/audio.js             suoni sintetizzati (WebAudio) + musica di sottofondo, interruttori 🔊 e 🎵
js/theme.js             temi: sfondo illustrato dei menu, stagionali per data o a scelta
js/version.js           numero di versione mostrato nell'angolo
icons/                  icone dell'app (any + maskable, generate da assets/icon-source.png)
assets/music/           sottofondo.mp3 (brano generato con IA dall'autore del progetto, vedi LICENSE.txt); gli originali restano fuori da Git
assets/                 immagini: originali (PNG), versioni usate dall app (JPEG/WebP), icone dei minigiochi (assets/icons/<id>.webp)
fonts/                  carattere Fredoka (SIL OFL, licenza in fonts/OFL.txt)
vendor/                 PeerJS 1.5.4 (MIT, licenza in vendor/peerjs-LICENSE.txt): unica libreria esterna, copiata qui
test.html + js/tester.js  tester nel browser: struttura, ogni minigioco, allenamento, sfida del giorno, multiplayer
tools/tester.mjs        esegue il tester in Chrome headless da riga di comando
tools/check.mjs         controllo rapido da riga di comando (sintassi, catalogo, PRECACHE completa, versione)
CLAUDE.md · ROADMAP.md  guida per chi lavora sul codice · elenco di fatto / da fare
```

## Minigiochi

| | Abilità | Punteggio |
|---|---|---|
| 🚦 Semaforo | riflessi | ms (meno è meglio) |
| 🃏 Memory | memoria visiva | tempo |
| 🎵 Sequenza | memoria | passi |
| 🔢 Numeri | velocità | tempo (+1 s per errore) |
| 🎯 Bersagli | destrezza | colpiti in 20 s |
| ➕ Calcoli | calcolo | giuste − sbagliate in 25 s |
| 🎨 Colori | attenzione (Stroop) | giuste − sbagliate in 20 s |
| 🏹 Precisione | tempismo | 5 tiri, max 100 l'uno |
| 🦘 Salta | destrezza | ostacoli superati in 30 s |
| 🔍 Intruso | occhio | trovati in 20 s |
| 🧭 Frecce | riflessi + logica | giuste − sbagliate in 20 s |
| 🎈 Palloncini | controllo | gonfia fino alla riga: 5 palloncini, max 100 l'uno |
| ⚖️ Di più | stima | giuste − sbagliate in 20 s |
| 👆 Tocchi | velocità | tocchi in 10 s |
| 🥁 Ritmo | ritmo | precisione su 16 battiti (max 1600) |
| 🏗️ Torre | tempismo | blocchi impilati (max 20) |
| 🚗 Frenata | tempismo | 5 frenate, max 100 l'una |
| 🧺 Cesto | coordinazione | frutti presi su caduti in 20 s |
| 💡 Lampi | attenzione | conteggi giusti su 8 |
| 📏 Metà | stima | 5 barre, max 100 l'una |
| ⏱️ Cronometro cieco | senso del tempo | 3 tentativi, max 100 l'uno |
| 🪞 Copia | memoria visiva | schemi esatti su 6 |
| 🔤 Anagrammi | parole | parole ricomposte in 30 s |
| 🔟 Dieci | calcolo | coppie che fanno 10 in 25 s |
| 🌀 Labirinto | destrezza | tempo per uscire (+1 s per tocco al muro) |
| 🎹 Melodia | memoria uditiva | note giuste (max 52) |
| 🫧 Ordina | colpo d'occhio | tocchi giusti in 25 s |
| 🔠 Parola nascosta | parole | parole trovate in 40 s |
| ❌ Tris veloce | logica | 3 per vittoria, 1 per pareggio, in 30 s |
| 🎣 Pesca | riflessi | 5 pesci, max 100 l'uno |
| 🎯 Traiettoria | mira | 8 lanci, max 100 l'uno |
| 🌍 Capitali | cultura | giuste − sbagliate in 25 s |
| 🐹 Talpe | riflessi | talpe colpite − bombe in 20 s |
| 💡 Lampadine | riflessi | lampadine spente − errori in 20 s |
| 🏓 Sfuggente | riflessi | prese in 20 s |
| 🔔 Suoni | memoria uditiva | coppie di note trovate |
| 🔎 Cosa manca | memoria visiva | giuste su 8 |
| 🔢 Cifre | memoria | cifre ricordate |
| 🔺 Quanti | conteggio | giusti su 6 |
| 🪞 Gemelli | confronto | giuste − sbagliate in 20 s |
| 🥤 Bussolotti | attenzione | palline trovate su 6 |
| ⚖️ Equilibrio | controllo | secondi in equilibrio (max 30) |
| 🐍 Serpente | destrezza | frutti mangiati in 30 s |
| 🚙 Strada | controllo | metri percorsi (max 300) |
| 🧮 Bilancia | calcolo | giuste − sbagliate in 25 s |
| ➡️ Prossimo | logica | giuste − sbagliate in 25 s |
| 🕒 Orologio | lettura dell'ora | giuste − sbagliate in 25 s |
| ✏️ Ortografia | parole | giuste − sbagliate in 25 s |
| 🎤 Rime | parole | giuste − sbagliate in 25 s |
| ↔️ Contrari | parole | giuste − sbagliate in 25 s |
| 🪞 Specchio | attenzione | disegni ricopiati allo specchio in 30 s (su 12) |
| 🆚 Maggiore | calcolo | giuste − sbagliate in 25 s |
| 🔡 Sillabe | parole | parole ricomposte in 30 s |
| 🎛️ Manopola | destrezza | punti di precisione su 600 (6 tentativi) |
| 🟢 Al volo | riflessi | punti di tempismo su 800 (8 tentativi) |
| 🛤️ Percorso | memoria | percorsi ripetuti (fino a 12) |
| 💶 Resto | calcolo | giuste − sbagliate in 25 s |
| 🔍 Lettere | attenzione | frasi giuste su 8 |
| ⭕ Cerchi | riflessi | punti di tempismo su 800 (8 giri) |
| 🏓 Rimbalzo | destrezza | rimbalzi sulla racchetta in 30 s (3 palline) |
| 🎨 Abbinamenti | memoria | colori giusti su 9 |
| 🐑 Plurali | parole | giuste − sbagliate in 25 s |
| 🏎️ Corsa | destrezza | secondi di corsa su 30 |
| ✏️ Ricalco | destrezza | punti di somiglianza su 300 (3 forme) |
| 🥁 Battito | riflessi | punti di tempismo su 1600 (16 note) |
| 🔎 Differenze | attenzione | differenze trovate su 24 in 40 s |
| ✅ Vero o falso | parole | giuste − sbagliate in 25 s |
| 📏 Stima | calcolo | punti di precisione su 600 (6 domande) |

## Aggiungere un minigioco

1. Crea `js/games/<id>.js` seguendo il contratto descritto in `semaforo.js` (solo logica).
   Ogni minigioco deve avere i suoni: usa `sfx.play("good"|"bad"|…)` di `js/audio.js`.
2. Aggiungi la scheda in `js/games/catalog.js` (categoria, abilità, durata, tema, data…). Icona: `assets/icons/<id>.webp` 160×160 (campo `image`); senza, si usa l'emoji.
3. Aggiungi il file js e l'icona alla lista `PRECACHE` in `sw.js`; stili in una sezione nuova di `css/games.css`.
4. `node tools/check.mjs` e poi `test.html?auto` nel browser: 0 errori.
5. Riga nella tabella qui sopra, voce spuntata in ROADMAP.md.
6. Alza la versione in `js/version.js` e `sw.js`, commit, push.

## Provare il gioco (Tester)

- **Nel browser:** apri `test.html` (in locale `http://localhost:8765/test.html`, online
  https://jon1616.github.io/cellcittine/test.html) e premi "Avvia i test". In meno di un minuto
  controlla struttura e versione, carica ogni minigioco, ne simula una partita con tocchi a caso e
  orologio accelerato, e gioca una manche di allenamento nell'app vera. Con `?auto` parte da solo.
- **Da riga di comando** (per chi scrive codice, prima di ogni commit):
  ```bash
  node tools/check.mjs
  ```
  Sintassi di tutti i file, catalogo ↔ file ↔ `sw.js`, ogni file dell'app in PRECACHE, versione allineata. Un errore di sintassi in un
  minigioco blocca l'app sul conto alla rovescia: questo controllo lo trova in un secondo.

## Pubblicare

```bash
git add -A && git commit -m "..." && git push
```
GitHub Pages aggiorna il sito in circa un minuto. Sul telefono basta chiudere e riaprire l'app.

## Sul telefono

Apri il link in Chrome → menu ⋮ → "Aggiungi a schermata Home".

Per far entrare qualcuno in stanza: pulsante "📨 Invita" sotto il codice, che manda il link
`https://jon1616.github.io/cellcittine/?stanza=CODICE` (chi lo apre entra direttamente).
