# ROADMAP — CELLCITTINE

Qui si segna ogni aggiunta futura **prima** di farla, e la si spunta quando è online.
Una riga per idea: `- [ ] cosa` → `- [x] cosa (vX.Y.Z)`. Le decisioni prese stanno in CLAUDE.md.

Ogni voce da fare dice: **cosa** si vede, **come** si fa (file toccati), **misura** (S = un passo,
M = due-tre passi, L = più passi). L'ordine dentro ogni blocco è quello consigliato.

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
- [x] Icona dell'app (normale + maskable) e illustrazione della home (v0.7.1)
- [x] Icone disegnate dei 25 minigiochi (WebP) in tutta l'interfaccia (v0.8.0)
- [x] Musica di sottofondo (CC0, loop di 2 min) nei menu, in pausa durante i minigiochi, interruttore 🎵 (v0.9.0)
- [x] Sfondo illustrato dietro i menu e sistema dei temi (v0.10.0)
- [x] Temi stagionali attivi: Halloween (20 ott–2 nov), Natale (8 dic–6 gen), Estate (15 giu–10 set), scelta manuale in home (v0.10.1)
- [x] Restyling dei menu: card in vetro, pulsanti con gradiente e bagliore, titolo luminoso, transizioni, codice pulsante, trofeo animato e coriandoli (v0.11.0)
- [x] Tasto indietro di Android: schermata precedente; doppia pressione per uscire da stanza e sfida (v0.12.0)
- [x] Manutenzione: app.js diviso in moduli (state, ui, nav, room, challenge, screens/*), CSS in base/menu/games senza sovrascritture, check.mjs verifica che ogni file sia in PRECACHE (v0.12.1)

## 1. Una serata senza intoppi (priorità alta)

- [x] **PeerJS copiato nel progetto** (MIT, `vendor/`) invece che da unpkg; il service worker offline non risponde più con HTML al posto di uno script (v0.13.0)
- [x] **Invito con link**: pulsante "📨 Invita" in stanza (menu di condivisione del telefono o copia); chi apre `…/?stanza=CODICE` entra subito se ha già il nome, altrimenti trova in home il riquadro "Invito" (v0.14.0)
- [x] **Schermo sempre acceso** dalla stanza al podio (Wake Lock API), anche in allenamento; rilasciato uscendo in home (v0.14.1)
- [x] **Identità stabile per telefono**: i partecipanti sono riconosciuti da un id fisso del telefono, non dalla connessione; chi rientra ritrova nome, colore e punti (v0.17.0)
- [x] **Ricollegamento automatico**: se un ospite perde la linea con l'host riprova da solo per 30 s ("Collegamento perso, mi ricollego…" / "Ricollegato!"), i risultati in sospeso vengono inviati al rientro, l'host gli rimanda l'ultimo messaggio di fase (v0.17.0)
- [x] **Manche automatiche**: opzione "A mano / Automatico" in stanza con attesa regolabile da 5 a 20 s; conto alla rovescia sul pulsante, "Aspetta, non ancora" per fermarlo; gli ospiti vedono il conto (v0.15.0)
- [x] **Nomi doppi**: se in stanza c'è già "Giulia", chi entra diventa "Giulia 2" (v0.16.0)
- [x] **Colore per persona** (8 tinte, in ordine di ingresso): pallino accanto al nome in stanza e nelle classifiche, alone del vincitore sul podio (v0.16.0)
- [x] **Messaggi chiari quando il collegamento non riesce**: distinguono server non raggiunto, stanza non trovata (con promemoria su I/O) e telefoni che non si collegano tra loro (stesso Wi‑Fi, VPN, hotspot) (v0.14.2)
- [x] **Pulsante "Installa l'app"** in home: su Android apre la finestra di installazione, su iPhone spiega Condividi → Aggiungi alla schermata Home; sparisce quando l'app è installata (v0.17.1)

## 2. Più divertimento (priorità media)

- [x] **Premi di fine sfida** sul podio: uno per categoria (Fulmine ⚡, Cecchino 🎯, Elefante 🐘, Occhio di lince 🔍, Calcolatrice 🧮, Fortuna 🍀, Dizionario 📖) a chi vince più manche di quel tipo, più Dominio 👑, Costante 🧱, Rimonta 🚀 e Da record ★ (js/awards.js) (v0.18.0)
- [x] **Storico delle sfide** sul telefono ("Storico" in home): data, stanza, partecipanti con punti, chi ha vinto, premi; conteggio di sfide, vittorie e allenamenti; ultime 60 (v0.19.0)
- [x] **Presentazione più lunga la prima volta**: se per qualcuno in stanza il minigioco è nuovo (ognuno manda all'host i minigiochi già giocati), il conto alla rovescia dura 7 s per tutti e mostra "Come si gioca" completo; altrimenti 3,5 s come prima (v0.20.0)
- [ ] **Massimo o riferimento per gli 11 minigiochi che non lo mostrano**: Memory/Numeri → "tempo ideale" per difficoltà; Calcoli/Colori/Frecce/Di più/Alto o basso/Dieci → "domande viste"; Tocchi → "record del telefono"; Intruso/Anagrammi → totale disponibile. Come: `maxScore` o `detail` in ogni file. — M
- [x] **Interruttore vibrazione** 📳 in home accanto a Suoni e Musica (v0.21.0)
- [x] **Sfide salvate**: salvando un pacchetto si può includere anche manche, difficoltà e manche automatiche (chip "⚙ Anche manche e difficoltà"); il pacchetto le riapplica (v0.21.0)
- [x] **Preferiti**: stellina su ogni riga della scelta, filtro "★ Preferiti", pacchetto automatico "Preferiti" (compare quando c'è almeno una stellina) (v0.21.0)
- [x] **Rivincita**: dal podio, "🔁 Rivincita (stessa sfida)" ripete gli stessi minigiochi nello stesso ordine con nuovi semi, punti da zero (v0.21.0)
- [ ] **Squadre** (2 contro 2, 3 contro 3): l'host assegna le squadre in stanza; punti sommati per squadra, podio di squadra. Come: `net.js` (team nel join/players), `challenge.js`, `screens/lobby.js`/`results.js`. — L
- [ ] **Campionato**: più sfide in serie con classifica cumulativa e "giornate". Come: `challenge.js`, `storage.js`. — M
- [ ] **Difficoltà per persona** (handicap): l'host può dare "facile" a chi è più piccolo; i parametri restano equi per chi ha la stessa difficoltà. Come: `net.js`, `challenge.js` (difficoltà nel `start` per id). — M

## 3. Nuovi minigiochi

Idee già discusse, tutte con suoni, prestazione e icona nello stile delle altre:

- [ ] Labirinto a dito (destrezza): traccia il percorso senza toccare i muri, tempo. — M
- [ ] Melodia (memoria): ripeti una sequenza di note che si allunga, con i pad sonori. — S
- [ ] Ordina per grandezza (attenzione): tocca le forme dalla più piccola alla più grande. — S
- [ ] Parola nascosta (parole): trova la parola in una griglia di lettere. — M
- [ ] Tris veloce (calcolo/attenzione): contro un avversario automatico, partite lampo. — M
- [ ] Pesca (azzardo/riflessi): tocca al momento giusto quando il pesce abbocca. — S
- [ ] Traiettoria (destrezza): lancia con uno scorrimento verso un bersaglio che si sposta. — M
- [ ] Bandiere / capitali (memoria): quiz a quattro risposte, con set di domande dal seme. — S

## 4. Grafica, audio, temi

- [ ] Origine e autore della musica in `assets/music/LICENSE.txt` (oggi "da indicare"). — S
- [ ] Una musica per tema (Halloween, Natale, Estate), stesso trattamento CC0 + FFmpeg. — S per brano
- [ ] Effetti sonori registrati (CC0) al posto di alcuni sintetizzati, sempre dal solo `audio.js`. — M
- [ ] `theme-color` (barra di stato Android) che segue il tema. Come: `theme.js`. — S
- [ ] Temi in più (Primavera, Compleanno) con sfondo e accento; evento "Compleanno" attivabile a mano per un giorno. — S per tema
- [ ] Animazione di ingresso/uscita dei minigiochi (dissolvenza dal conto alla rovescia). — S

## 5. Rete e affidabilità (più avanti)

- [ ] Ponte di rete (relay) se il P2P fallisce: serve un piccolo server esterno; da valutare quando il gruppo gioca da reti diverse. — L
- [ ] Passaggio di host: se l'host esce, un altro telefono prende il comando (serve stato condiviso). — L
- [ ] Modalità spettatore: chi entra a sfida iniziata vede le classifiche e gioca dalla manche successiva (oggi entra e aspetta). — S
- [ ] Prova automatica del multiplayer nel tester (due iframe: host + ospite). — M

## 6. Più avanti

- [ ] Avatar: composizione a pezzi (forma, colore, accessorio), visibile in stanza, classifica e podio. — L
- [ ] Classifiche tra amici nel tempo e casate/squadre stabili (serve un piccolo archivio in rete). — L
- [ ] Traduzione in inglese (testi in un file `js/i18n.js`, italiano di default). — M

## Idee parcheggiate

- Roblox / Google Play: no (vedi CLAUDE.md)
- Monete e sblocchi: solo se il gruppo lo chiede
