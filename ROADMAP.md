# ROADMAP — CELLCITTINE

Qui si segna ogni aggiunta futura **prima** di farla, e la si spunta quando è online.
Una riga per idea: `- [ ] cosa` → `- [x] cosa (vX.Y.Z)`. Le decisioni prese stanno in CLAUDE.md.

## Fatto

- [x] Telaio: stanze con codice, P2P host-arbitro, manche sincronizzate, PWA installabile (v0.1.0)
- [x] Sfida configurabile: minigiochi, manche, difficoltà; punti per posizione; allenamento con record (v0.2.0)
- [x] 13 minigiochi disegnati da codice (v0.2.0–v0.3.0)
- [x] Manche = "Tutti" (una per minigioco scelto) (v0.3.2)
- [x] Aggiornamenti immediati: service worker senza cache HTTP + ricarica automatica (v0.3.3)
- [x] Catalogo con scheda completa per minigioco; schermata di scelta con ricerca, filtri, categorie (v0.4.0)
- [x] Pacchetti integrati e personali, Sorprendimi (v0.4.0)
- [x] Caricamento a richiesta del codice dei minigiochi (v0.4.0)
- [x] Suoni sintetizzati in telaio e minigiochi, interruttore Suoni (v0.5.0)
- [x] Prestazione a fine manche: dettaglio + confronto col massimo (v0.5.1)
- [x] Altri 12 minigiochi → 25 totali; categoria Parole; pacchetto Testa (v0.6.0)
- [x] Tester nel browser (test.html) e controllo da riga di comando (tools/check.mjs) (v0.6.1)
- [x] Nessuna manche può bloccarsi: limiti di tempo in Copia e Cronometro cieco (v0.6.1)

- [x] Carattere tipografico Fredoka in tutto il gioco (v0.7.0)
- [x] Icona dell'app (normale + maskable) e illustrazione della home generate con Nano Banana (v0.7.1)
- [x] Icone disegnate dei 25 minigiochi (foglio unico 5×5 da Nano Banana, ritagliate in WebP) in elenchi, scelta, scheda, conto alla rovescia, risultati, record (v0.8.0)
- [x] Musica di sottofondo (CC0, loop di 2 min) nei menu, in pausa durante i minigiochi, interruttore 🎵 (v0.9.0)
- [x] Sfondo illustrato dietro i menu e sistema dei temi (automatico per data o a scelta); Halloween/Natale/Estate pronti ad accogliere le immagini (v0.10.0)
- [x] Temi stagionali attivi: Halloween (20 ott–2 nov), Natale (8 dic–6 gen), Estate (15 giu–10 set), scelta manuale in home (v0.10.1)

## Prossimi passi (in ordine di priorità, da confermare con l'utente)

- [ ] Feedback dal gruppo di test (le ragazze e amici): taratura difficoltà, suoni, minigiochi noiosi da togliere
- [ ] Rifinitura visiva: transizioni tra schermate, coriandoli sul podio, conto alla rovescia più scenografico
- [ ] Sfide salvate con nome anche per manche/difficoltà (oggi i pacchetti salvano solo i minigiochi)
- [ ] Preferiti (stellina) nella scelta dei minigiochi
- [ ] Altri minigiochi (idee: labirinto a dito, ritmo con melodia, ordina per grandezza, trova la parola nascosta, tris veloce, pesca)


## Più avanti

- [ ] Avatar: composizione a pezzi, colori, visibile in stanza e classifica
- [ ] Classifiche tra amici nel tempo e casate/squadre (serve un piccolo archivio in rete)
- [ ] Modalità "campionato": più sfide in serie con punteggio cumulativo
- [ ] Ponte di rete (relay) se il P2P fallisce su certe reti mobili
- [ ] Traduzione in inglese (per amici che non parlano italiano)

## Idee parcheggiate

- Roblox / Google Play: no (vedi CLAUDE.md)
- Monete e sblocchi: solo se il gruppo lo chiede
