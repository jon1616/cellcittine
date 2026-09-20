# Cellcittine

Party game di minigiochi per telefono, giocabile da soli o in gruppo (2-6 persone)
tramite codice stanza. È una pagina web installabile (PWA): niente store, aggiornamenti istantanei.

**Gioco online:** https://jon1616.github.io/cellcittine/

## Struttura

```
index.html              pagina unica
manifest.webmanifest    installazione come app
sw.js                   funzionamento offline (aggiornare CACHE_VERSION a ogni release)
css/style.css
js/app.js               telaio: schermate, manche, punteggi
js/net.js               collegamento P2P (PeerJS), modello host-arbitro
js/games/registry.js    elenco minigiochi
js/games/<nome>.js      un file per minigioco
js/version.js           numero di versione mostrato nell'angolo
icons/                  icone dell'app
```

## Aggiungere un minigioco

1. Crea `js/games/<nome>.js` seguendo il contratto descritto in `semaforo.js`.
2. Importalo e aggiungilo alla lista in `js/games/registry.js`.
3. Aggiungilo alla lista `PRECACHE` in `sw.js`.
4. Alza la versione in `js/version.js` e `sw.js`, commit, push.

## Pubblicare

```bash
git add -A && git commit -m "..." && git push
```
GitHub Pages aggiorna il sito in circa un minuto. Sul telefono basta chiudere e riaprire l'app.

## Sul telefono

Apri il link in Chrome → menu ⋮ → "Aggiungi a schermata Home".
