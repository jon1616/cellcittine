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

- [x] **Sfida del giorno** in home: 5 minigiochi di 5 categorie, uguali per tutti (piano e semi dalla data), difficoltà normale; ogni manche vale fino a 1000 punti (percentuale di prestazione, js/rating.js); conta il primo tentativo, si può rigiocare; serie di giorni di fila 🔥; condivisione del risultato in stile "uno al giorno" (js/daily.js) (v0.26.0)
- [x] **Statistiche personali** ("📊 Statistiche" in home): titolo (Fulmine, Elefante, Lince, Cecchino, Calcolatrice, Dizionario, Tuttofare…), manche/sfide/vittorie/record/manche perfette/tempo di gioco, punti forti per categoria (media della prestazione), minigiochi più giocati e mai provati (js/stats.js, js/screens/stats.js) (v0.29.0)
- [x] **Traguardi**: 16 medaglie (Prima sfida, Campione, Tris di vittorie, Veterano, In forma, Esploratore, Collezionista, Perfetto, Da record, Collezione di record, Maratona, Instancabile, Buongiorno, Tre di fila, Una settimana, Giornata top) sbloccate a fine sfida con avviso e suono, elenco nelle statistiche (v0.29.0)
- [x] **Il commentatore**: dopo ogni manche una o due frasi calcolate da tutti dalla storia della sfida (si parte, sorpasso, testa a testa, vittoria matematica, ultima manche, serie di vittorie, rimonta, record, dall'ultimo posto…); in allenamento il confronto col record; suono "cheer" quando riguarda chi guarda (js/commentary.js) (v0.28.0)
- [x] **Classifica generale animata**: righe che entrano una alla volta, freccia di posizione (▲2 / ▼1 / =) e punti che salgono contando (v0.28.0)
- [x] **Manche speciali** (opzione in stanza, solo in gruppo): decise dall'host all'avvio e annunciate al conto alla rovescia con suono: 🔥 Punti doppi, 🎯 Tutto o niente (solo chi vince prende punti), 🚀 Rimonta (metà bassa della classifica a punti doppi), ⚡ Manche difficile, 🍃 Manche facile; l'ultima manche è sempre 🏁 Finale doppia (js/specials.js) (v0.27.0)
- [x] **Difficoltà "Crescente"**: le manche vanno da Facile a Difficile lungo la sfida; i record si salvano con la difficoltà vera di ogni manche (v0.27.0)
- [x] **Percentuale di prestazione per tutti i 50 minigiochi** (js/rating.js): massimo del minigioco dove c'è, altrimenti un riferimento per minigioco (tabella REFS, ritoccabile) (v0.26.0)

- [x] **Premi di fine sfida** sul podio: uno per categoria (Fulmine ⚡, Cecchino 🎯, Elefante 🐘, Occhio di lince 🔍, Calcolatrice 🧮, Fortuna 🍀, Dizionario 📖) a chi vince più manche di quel tipo, più Dominio 👑, Costante 🧱, Rimonta 🚀 e Da record ★ (js/awards.js) (v0.18.0)
- [x] **Storico delle sfide** sul telefono ("Storico" in home): data, stanza, partecipanti con punti, chi ha vinto, premi; conteggio di sfide, vittorie e allenamenti; ultime 60 (v0.19.0)
- [x] **Presentazione più lunga la prima volta**: se per qualcuno in stanza il minigioco è nuovo (ognuno manda all'host i minigiochi già giocati), il conto alla rovescia dura 7 s per tutti e mostra "Come si gioca" completo; altrimenti 3,5 s come prima (v0.20.0)
- [ ] **Massimo o riferimento per gli 11 minigiochi che non lo mostrano**: Memory/Numeri → "tempo ideale" per difficoltà; Calcoli/Colori/Frecce/Di più/Alto o basso/Dieci → "domande viste"; Tocchi → "record del telefono"; Intruso/Anagrammi → totale disponibile. Come: `maxScore` o `detail` in ogni file. — M
- [x] **Interruttore vibrazione** 📳 in home accanto a Suoni e Musica (v0.21.0)
- [x] **Sfide salvate**: salvando un pacchetto si può includere anche manche, difficoltà e manche automatiche (chip "⚙ Anche manche e difficoltà"); il pacchetto le riapplica (v0.21.0)
- [x] **Preferiti**: stellina su ogni riga della scelta, filtro "★ Preferiti", pacchetto automatico "Preferiti" (compare quando c'è almeno una stellina) (v0.21.0)
- [x] **Rivincita**: dal podio, "🔁 Rivincita (stessa sfida)" ripete gli stessi minigiochi nello stesso ordine con nuovi semi, punti da zero (v0.21.0)
- [x] **Squadre** (2 o 3): l'host le attiva in stanza, assegna le persone toccando la pillola accanto al nome (o "Mescola"), chi entra dopo va nella squadra più piccola; in ogni manche la squadra vale la media dei punti dei membri e le squadre prendono punti per posizione; card "Squadre" nei risultati, podio di squadra, storico (js/teams.js) (v0.22.0)
- [x] **Campionato** (opzione in stanza): ogni sfida è una giornata, punti per posizione nella classifica finale sommati in una tabella (con giornate vinte e punti totali per gli spareggi) mostrata sul podio e in stanza; "Prossima giornata", "Chiudi il campionato" → schermata del campione (messaggio "champion", anche a chi rientra), voci nello storico (js/championship.js) (v0.32.0)
- [ ] **Difficoltà per persona** (handicap): l'host può dare "facile" a chi è più piccolo; i parametri restano equi per chi ha la stessa difficoltà. Come: `net.js`, `challenge.js` (difficoltà nel `start` per id). — M

## 3. Nuovi minigiochi

Idee già discusse, tutte con suoni, prestazione e icona nello stile delle altre:

- [x] Labirinto (destrezza): dito dall'ingresso all'uscita senza toccare i muri, labirinto dal seme (v0.23.0)
- [x] Melodia (memoria): melodie nuove e sempre più lunghe su quattro tasti-pianoforte (v0.23.0)
- [x] Ordina (attenzione): cerchi dal più piccolo al più grande, serie dopo serie (v0.23.0)
- [x] Parola nascosta (parole): griglia di lettere, tocca la parola in ordine (v0.23.0)
- [x] Tris veloce (attenzione): partite lampo contro il telefono, distrazioni dal seme (v0.23.0)
- [x] Pesca (riflessi): tocca quando il pesce abbocca, finti morsi nei livelli alti (v0.23.0)
- [x] Traiettoria (destrezza): lancio con scorrimento verso un bersaglio in movimento (v0.23.0)
- [x] Capitali (memoria): quiz a quattro risposte con bandiere, tre livelli di notorietà (v0.23.0)
- [x] Icone disegnate degli 8 nuovi minigiochi (foglio assets/game-icons-2.png ritagliato in assets/icons/<id>.webp) (v0.23.1)
- [x] Via la categoria Azzardo: "Alto o basso" eliminato, "Palloncini" rifatto come gioco di controllo (riga da raggiungere, punti per precisione) e spostato in Destrezza → 32 minigiochi (v0.24.0)

- [x] 18 minigiochi nuovi → 50 totali: Talpe, Lampadine, Sfuggente (riflessi); Suoni, Cosa manca, Cifre (memoria); Quanti, Gemelli, Bussolotti (attenzione); Equilibrio, Serpente, Strada (destrezza); Bilancia, Prossimo, Orologio (calcolo); Ortografia, Rime, Contrari (parole) (v0.25.0)
- [x] Icone disegnate dei 18 nuovi minigiochi (foglio assets/game-icons-3.png, card chiare rimosse in ritaglio) (v0.25.1)
- [x] 6 minigiochi nuovi → 56 totali: Specchio (attenzione: ricopia il disegno ribaltato), Maggiore (calcolo: quale conto vale di più), Sillabe (parole: ricomponi la parola), Manopola (destrezza: ruota fino alla tacca), Al volo (riflessi: tocca nella zona verde), Percorso (memoria: rifai il percorso sulla griglia); icone emoji in attesa del foglio (v0.30.0)
- [x] 6 minigiochi nuovi → 62 totali: Resto (calcolo: il resto giusto), Lettere (attenzione: conta la lettera nella frase), Cerchi (riflessi: tocca quando il cerchio combacia con l'anello), Rimbalzo (destrezza: racchetta e pallina), Abbinamenti (memoria: il colore di ogni oggetto), Plurali (parole: il plurale giusto, anche irregolare) (v0.31.0)
- [ ] Icone disegnate dei minigiochi nuovi dalla v0.30.0 (foglio assets/game-icons-4.png da generare: stesso prompt degli altri fogli, soggetti direttamente sul fondo scuro #1E1F34, niente card)

## 4. Grafica, audio, temi

- [x] Origine e autore della musica in `assets/music/LICENSE.txt`: brano generato con IA dall'autore del progetto (v0.25.2)
- [ ] Una musica per tema (Halloween, Natale, Estate), stesso trattamento CC0 + FFmpeg. — S per brano
- [ ] Effetti sonori registrati (CC0) al posto di alcuni sintetizzati, sempre dal solo `audio.js`. — M
- [ ] `theme-color` (barra di stato Android) che segue il tema. Come: `theme.js`. — S
- [ ] Temi in più (Primavera, Compleanno) con sfondo e accento; evento "Compleanno" attivabile a mano per un giorno. — S per tema
- [ ] Animazione di ingresso/uscita dei minigiochi (dissolvenza dal conto alla rovescia). — S

## 5. Rete e affidabilità (più avanti)

- [ ] ~~Ponte di rete (TURN)~~ — **rinunciato il 21/09/2026**: servirebbe un account esterno con chiave nel codice pubblico. Il meccanismo resta predisposto e spento in `js/relay.js` (basterebbero `app` e `apiKey`), se un giorno si cambiasse idea. Il gioco a distanza funziona tra reti normali (casa ↔ casa); può fallire con alcune SIM, uffici e VPN: il messaggio d'errore lo spiega.
- [ ] Server di presentazione (PeerJS) di riserva se quello pubblico non risponde. — M
- [ ] Passaggio di host: se l'host esce, un altro telefono prende il comando (serve stato condiviso). — L
- [ ] Modalità spettatore: chi entra a sfida iniziata vede le classifiche e gioca dalla manche successiva (oggi entra e aspetta). — S
- [x] Tester da riga di comando: `node tools/tester.mjs` apre test.html in Chrome headless e stampa il rapporto (v0.27.0)
- [ ] Prova automatica del multiplayer nel tester (due iframe: host + ospite). — M

## 6. Più avanti

- [ ] Avatar: composizione a pezzi (forma, colore, accessorio), visibile in stanza, classifica e podio. — L
- [ ] Classifiche tra amici nel tempo e casate/squadre stabili (serve un piccolo archivio in rete). — L
- [ ] Traduzione in inglese (testi in un file `js/i18n.js`, italiano di default). — M

## Idee parcheggiate

- Roblox / Google Play: no (vedi CLAUDE.md)
- Monete e sblocchi: solo se il gruppo lo chiede
