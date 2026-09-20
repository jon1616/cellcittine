# Cellcittine

Party game di minigiochi per telefono, giocabile da soli o in gruppo (2-6 persone)
tramite codice stanza. È una pagina web installabile (PWA): niente store, aggiornamenti istantanei.

**Gioco online:** https://jon1616.github.io/cellcittine/

Documenti di lavoro: [CLAUDE.md](CLAUDE.md) (regole e checklist per chi lavora sul codice) · [ROADMAP.md](ROADMAP.md) (cosa è fatto e cosa viene dopo).

## Struttura

```
index.html              pagina unica
manifest.webmanifest    installazione come app
sw.js                   funzionamento offline (aggiornare CACHE_VERSION a ogni release)
css/style.css
js/app.js               telaio: schermate, sfida, manche, punteggi, scelta minigiochi
js/net.js               collegamento P2P (PeerJS), modello host-arbitro
js/packs.js             pacchetti di minigiochi (integrati + personali)
js/storage.js           salvataggi: configurazione, record, pacchetti personali
js/games/catalog.js     CATALOGO: scheda di ogni minigioco + caricamento a richiesta
js/games/shell.js       cornice comune ai minigiochi (timer, cronometro)
js/games/<id>.js        codice di un minigioco (caricato solo quando serve)
js/audio.js             suoni sintetizzati (WebAudio), interruttore 🔊/🔇
js/version.js           numero di versione mostrato nell'angolo
icons/                  icone dell'app (any + maskable, generate da assets/icon-source.png)
assets/                 immagini: originali (PNG), versioni usate dall'app (JPEG), icone dei minigiochi (assets/icons/<id>.webp)
fonts/                  carattere Fredoka (SIL OFL, licenza in fonts/OFL.txt)
test.html + js/tester.js  tester nel browser: prova tutto il gioco in meno di un minuto
tools/check.mjs         controllo rapido da riga di comando (sintassi, catalogo, sw.js, versione)
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
| 🎈 Palloncini | azzardo | 5 palloncini, max 100 l'uno |
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
| 🎴 Alto o basso | azzardo | giuste − sbagliate in 20 s |
| 🔟 Dieci | calcolo | coppie che fanno 10 in 25 s |

## Aggiungere un minigioco

1. Crea `js/games/<id>.js` seguendo il contratto descritto in `semaforo.js` (solo logica).
   Ogni minigioco deve avere i suoni: usa `sfx.play("good"|"bad"|…)` di `js/audio.js`.
2. Aggiungi la scheda in `js/games/catalog.js` (categoria, abilità, durata, tema, data…). Icona: `assets/icons/<id>.webp` 160×160 (campo `image`); senza, si usa l'emoji.
3. Aggiungi il file alla lista `PRECACHE` in `sw.js`.
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
  Sintassi di tutti i file, catalogo ↔ file ↔ `sw.js`, versione allineata. Un errore di sintassi in un
  minigioco blocca l'app sul conto alla rovescia: questo controllo lo trova in un secondo.

## Pubblicare

```bash
git add -A && git commit -m "..." && git push
```
GitHub Pages aggiorna il sito in circa un minuto. Sul telefono basta chiudere e riaprire l'app.

## Sul telefono

Apri il link in Chrome → menu ⋮ → "Aggiungi a schermata Home".
