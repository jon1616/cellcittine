/*
  Sfida e manche.

  Una "sfida" è una sequenza di manche. L'host la configura (minigiochi,
  numero di manche, difficoltà), poi per ogni manche:
    host annuncia il minigioco -> tutti partono allo stesso istante ->
    ognuno manda il punteggio all'host -> l'host pubblica classifica della
    manche e classifica generale (punti per posizione).

  Messaggi di rete (host → tutti): start, results, final, lobby, config.
  (guest → host): result.
*/

import { el, seededRandom } from "./utils.js";
import { sfx } from "./audio.js";
import { state, setScreen, isSolo } from "./state.js";
import { setStatus, gameIcon, difficultyLabel, appRoot, colorDot, toast } from "./ui.js";
import { syncBackGuard } from "./nav.js";
import { getEntry, getCategory, loadGame, preloadGames, getLoaded } from "./games/catalog.js";
import { shuffle } from "./games/shell.js";
import { randomSelection } from "./packs.js";
import { updateRecord, markSeen, getGroupRecord, saveGroupRecord } from "./storage.js";
import { ratingOf } from "./rating.js";
import { bumpWeekly } from "./missions.js";
import { isExpertUnlocked, adaptiveDifficulty } from "./stats.js";
import { setExpert, endTimerNow } from "./games/shell.js";
import { showLobby } from "./screens/lobby.js";
import { showResults, showFinal, recordMyRound } from "./screens/results.js";
import { showGameInfo, showCatalog } from "./screens/catalog.js";
import { starsOf, starsText } from "./rating.js";
import { computeAwards } from "./awards.js";
import { teamRound, pairTurn } from "./teams.js";
import { SPECIALS, roundDifficulty, assignSpecials, applySpecial, pickDuel } from "./specials.js";
import { addDay, endChampionship, isChampionship, startChampionship } from "./championship.js";
import { showChampion, showReaction } from "./screens/results.js";

const COUNTDOWN_MS = 3500; // dal messaggio "start" al via
const INTRO_MS = 7000;     // (non più usato per il conto: alla prima volta si aspetta il pulsante "Pronto")
const READY_MAX_MS = 90000; // dopo tanto l'host fa partire comunque la manche
const GRACE_SECONDS = 8;   // margine oltre maxSeconds prima di chiudere la manche

// ---------------------------------------------------------------
// Avvio (host)
// ---------------------------------------------------------------

// opts (tutti facoltativi):
//   games     sequenza fissa di minigiochi (rivincita: la stessa della sfida appena finita)
//   seeds     semi per manche (Sfida del giorno: uguali per tutti); altrimenti nuovi
//   difficulty  al posto di quella configurata
//   daily     { key } se è la Sfida del giorno
//   quick     true = "Prova subito" di un solo minigioco (podio con Riprova e ritorno al catalogo)
//   series    con quick: "lunga" (le partite sono già in games) o "infinita" (partite dello stesso
//             minigioco finché non si preme Fine: nextRound ne aggiunge una alla volta)
export async function startChallenge(opts = {}) {
  if (!opts || typeof opts !== "object" || opts instanceof Event) opts = {}; // (un evento del click non è un'opzione)
  const cfg = state.config;
  const rng = seededRandom(Math.floor(Math.random() * 2 ** 31));
  const sameGames = Array.isArray(opts.games) && opts.games.length ? opts.games : null;

  // "Tutti": ogni minigioco scelto una volta, in ordine casuale.
  // Altrimenti: cicla su quelli scelti, mescolati, evitando ripetizioni vicine.
  const total = sameGames ? sameGames.length : cfg.rounds === "tutti" ? cfg.games.length : cfg.rounds;
  const rounds = [];
  let pool = [];
  while (rounds.length < total) {
    if (sameGames) {
      const i = rounds.length;
      const seed = Array.isArray(opts.seeds) && Number.isInteger(opts.seeds[i]) ? opts.seeds[i] : Math.floor(rng() * 2 ** 31);
      rounds.push({ gameId: sameGames[i], seed });
      continue;
    }
    if (pool.length === 0) {
      pool = shuffle(cfg.games, rng);
      if (rounds.length > 0 && pool.length > 1 && pool[0] === rounds[rounds.length - 1].gameId) {
        pool.push(pool.shift());
      }
    }
    rounds.push({ gameId: pool.shift(), seed: Math.floor(rng() * 2 ** 31) });
  }

  // Manche speciali (solo in gruppo, se attive): decise ora, annunciate manche per manche
  const difficulty = opts.difficulty || cfg.difficulty;
  const specials = !isSolo() && cfg.special && !opts.daily ? assignSpecials(rounds.length, rng, difficulty, { teams: cfg.teams, players: state.net.players.length }) : [];
  rounds.forEach((r, i) => { r.special = specials[i] || null; });
  const series = opts.quick === true && (opts.series === "lunga" || opts.series === "infinita") ? opts.series : null;

  state.challenge = {
    rounds,
    total: series === "infinita" ? Infinity : rounds.length,
    series, // Prova subito a serie: partite dello stesso minigioco una dopo l'altra, senza la schermata dei risultati in mezzo
    difficulty,
    index: -1,
    standings: new Map(),
    teamStandings: new Map(), // squadra -> punti (solo con le squadre attive)
    teams: isSolo() ? 0 : cfg.teams,
    presenter: !isSolo() && cfg.presenter === true, // l'host presenta e non gioca
    history: [],
    daily: opts.daily || null, // { key } nella Sfida del giorno
    quick: opts.quick === true,
    adaptive: opts.adaptive === true, // Giro veloce: difficoltà per manche dalle stelle
    mode: isSolo() || cfg.teams || opts.daily ? "punti" : cfg.mode, // "eliminazione": ogni manche l'ultimo esce
    eliminated: new Map(),     // id -> manche in cui è uscito
  };

  setStatus("Preparo i minigiochi…");
  const ids = [...new Set(rounds.map((r) => r.gameId))];
  const results = await preloadGames(ids);
  if (!state.net) return; // usciti nel frattempo

  // Se il codice di un minigioco non si carica (file rotto o assente), meglio
  // fermarsi qui con un messaggio chiaro che restare appesi al conto alla rovescia.
  const broken = ids.filter((_, i) => results[i].status === "rejected");
  if (broken.length > 0) {
    state.challenge = null;
    const names = broken.map((id) => getEntry(id)?.title || id).join(", ");
    setStatus(`Non riesco a caricare: ${names}. Prova a ricaricare la pagina o togli quel minigioco.`, true);
    return;
  }
  nextRound();
}

export function nextRound() {
  const ch = state.challenge;
  const net = state.net;
  ch.index++;
  // Serie senza fine: la partita successiva nasce qui (stesso minigioco, seme nuovo)
  if (ch.series === "infinita" && ch.index >= ch.rounds.length) ch.rounds.push({ gameId: ch.rounds[0].gameId, seed: Math.floor(Math.random() * 2 ** 31), special: null });
  const r = ch.rounds[ch.index];
  // Se per qualcuno in stanza è la prima volta, presentazione più lunga per tutti
  const intro = net.players.some((p) => !net.hasSeen(p.id, r.gameId));
  // Duello: due persone in gara sorteggiate ora (serve sapere chi c'è); se non si può, la manche è normale
  if (r.special === "duello") {
    const alive = net.players.map((p) => p.id).filter((id) => !(ch.mode === "eliminazione" && ch.eliminated.has(id)));
    r.duel = pickDuel(alive, seededRandom(r.seed ^ 0x5eed));
    if (!r.duel) r.special = null;
  }
  if (r.special === "staffetta" && !ch.teams) r.special = null;
  // Chi sta fuori in questa manche: l'host presentatore, e nelle coppie chi non è di turno
  const sitOut = [];
  if (ch.presenter) sitOut.push(net.me.id);
  if (ch.teams === "coppie") sitOut.push(...pairTurn(net.players.filter((p) => !sitOut.includes(p.id)), ch.index));
  if (r.special === "duello" && r.duel && r.duel.some((id) => sitOut.includes(id))) { r.special = null; r.duel = null; }
  const special = r.special ? SPECIALS[r.special] : null;
  // Handicap: chi ha una difficoltà personale la usa (salvo le manche speciali Difficile/Facile, uguali per tutti)
  const difficulties = {};
  for (const p of net.players) if (p.handicap && !special?.difficulty && !ch.daily) difficulties[p.id] = p.handicap;
  const msg = {
    type: "start",
    index: ch.index,
    total: ch.total,
    gameId: r.gameId,
    seed: r.seed,
    difficulty: special?.difficulty || (ch.adaptive ? adaptiveDifficulty(r.gameId) : roundDifficulty(ch.difficulty, ch.index, ch.total)),
    difficulties,
    challengeDifficulty: ch.difficulty,
    special: special ? special.id : null,
    duel: r.duel || null,
    sitOut,
    mode: ch.mode,
    daily: ch.daily?.key || null,
    out: [...ch.eliminated.keys()],
    intro,
    // Prima volta per qualcuno: si legge "come si gioca" e si parte quando tutti hanno premuto Pronto (startAt arriva col messaggio "go")
    startAt: intro ? null : net.now() + COUNTDOWN_MS,
  };
  net.broadcast(msg);
  beginRound(msg);
}

// Rivincita: stessa sfida (stessi minigiochi, stesso ordine), nuovi semi, punti da zero
export function replayChallenge() {
  const ch = state.challenge;
  const games = ch?.rounds?.map((r) => r.gameId);
  if (!games?.length) return;
  state.round = null;
  // La Sfida del giorno si rigioca identica (stessi semi): vale come allenamento
  if (ch.adaptive) { startChallenge({ games: randomSelection(5), adaptive: true, difficulty: "adattiva" }); return; }
  // Prova subito a serie: si riparte con la stessa serie (senza fine: una partita, le altre nascono strada facendo)
  if (ch.quick) { startChallenge({ games: ch.series === "infinita" ? [games[0]] : games, quick: true, difficulty: ch.difficulty, ...(ch.series ? { series: ch.series } : {}) }); return; }
  startChallenge(ch.daily ? { games, seeds: ch.rounds.map((r) => r.seed), difficulty: ch.difficulty, daily: ch.daily } : { games });
}

// ---------------------------------------------------------------
// Prova subito a serie (5 di fila / senza fine): totale finora e pulsante Fine
// ---------------------------------------------------------------

// Riassunto delle partite fatte finora: { n, best, text } (null se nessuna)
export function seriesSummary(ch, game) {
  if (!ch?.series || !game) return null;
  const n = ch.history.length; // partite giocate
  if (n === 0) return null;
  // Contano solo i risultati validi (niente false partenze e simili)
  const scores = ch.history.map((h) => h.myScore).filter((s) => typeof s === "number" && Number.isFinite(s) && game.isValidScore(s));
  if (scores.length === 0) return { n, best: null, sum: 0, text: "nessun risultato valido" };
  const high = game.order === "desc"; // desc = vince il punteggio più alto, asc = il più basso (tempi, errori)
  const best = high ? Math.max(...scores) : Math.min(...scores);
  const sum = scores.reduce((a, b) => a + b, 0);
  const avg = Math.round((sum / scores.length) * 10) / 10;
  const text = high
    ? `Totale ${game.formatScore(sum)} · migliore ${game.formatScore(best)}`
    : `Migliore ${game.formatScore(best)} · media ${game.formatScore(avg)}`;
  return { n, best, sum, text };
}

// Fine della serie: tra una partita e l'altra si chiude subito; durante la partita si fa scadere il conto
// alla rovescia (il punteggio di ora conta), altrimenti la partita in corso viene lasciata e non conta.
export function stopSeries() {
  const ch = state.challenge;
  const round = state.round;
  if (!ch?.series || ch.stopping) return;
  ch.stopping = true;
  document.querySelectorAll(".series-end").forEach((b) => { b.disabled = true; b.textContent = "Chiudo…"; });
  const closeNow = () => {
    clearTimeout(round?.deadline);
    clearTimeout(round?.stopGuard);
    if (state.screen === "game") { try { round?.game?.unmount(); } catch (_) { /* già smontato */ } }
    endSeries();
  };
  if (state.screen !== "game" || !round?.game || round.myScore !== undefined) { closeNow(); return; }
  if (!endTimerNow()) { closeNow(); return; }
  // Il minigioco deve mandare il punteggio a breve: se non lo fa (era un conto di una fase), si chiude comunque
  round.stopGuard = setTimeout(() => { if (state.round === round && state.screen === "game") closeNow(); }, 2500);
}

// Chiude la serie: podio con tutte le partite, oppure la scheda del minigioco se non se n'è finita nemmeno una
function endSeries() {
  const ch = state.challenge;
  if (!ch) return;
  if (ch.history.length === 0) {
    const id = ch.rounds?.[0]?.gameId;
    const g = getEntry(id);
    leaveRoomForSeries();
    g ? showGameInfo(g, showCatalog) : showCatalog();
    return;
  }
  state.round = null;
  finishChallenge();
}
// (leaveRoom vive in room.js, che importa questo modulo: si passa dalla stessa strada di exitButton)
function leaveRoomForSeries() {
  const net = state.net;
  setExpert(false);
  clearTimeout(state.round?.deadline);
  net?.leave();
  state.net = null; state.round = null; state.challenge = null;
}

// Tra una partita e l'altra della serie: statistiche, avviso del risultato, avanti (o fine)
function seriesStep(msg) {
  const ch = state.challenge;
  const round = state.round;
  const net = state.net;
  const last = ch.history[ch.history.length - 1];
  if (last && round) { last.myDetail = round.myDetail; last.myMax = round.myMax; last.myScore = round.myScore; last.myParams = round.params; }
  recordMyRound(round.game, round, msg, { solo: true, meId: net.me.id });
  const pct = ratingOf(round.game, round.myScore, round.params);
  sfx.play(round.isRecord ? "record" : "roundEnd");
  try { round.game.unmount(); } catch (_) { /* già smontato */ } // come fa la schermata dei risultati
  if (ch.stopping || msg.last) { state.round = null; finishChallenge(); return; }
  toast(`Partita ${msg.index + 1}: ${round.game.formatScore(round.myScore)} · ${starsText(starsOf(pct))}${round.isRecord ? " · record!" : ""}`);
  state.round = null;
  nextRound();
}

// Pulsante Fine (nell'intestazione del minigioco e nel conto alla rovescia)
function seriesEndButton(cls = "") {
  return el("button", { class: `series-end ${cls}`.trim(), text: "■ Fine", onclick: () => stopSeries() });
}

export function finishChallenge() {
  const standings = standingsArray();
  const msg = { type: "final", standings, awards: computeAwards(state.challenge.history, standings, { reactions: state.challenge.reactions || new Map() }), teamStandings: teamStandingsArray() };
  // Campionato: questa sfida è una giornata
  if (!isSolo() && state.config.championship) {
    if (!isChampionship()) startChampionship();
    msg.championship = addDay(standings);
  }
  state.net.broadcast(msg);
  showFinal(msg);
}

// Passaggio di host: la sfida (classifica e storia) continua da qui; le manche restanti si sorteggiano
// di nuovo tra i minigiochi della sfida (le vecchie le conosceva solo l'host sparito). Se non c'era una
// sfida in corso, si torna in stanza.
export function resumeAfterHandover() {
  const net = state.net;
  const ch = state.challenge;
  if (!ch || !ch.history || ch.total === 0) {
    state.challenge = null; state.round = null;
    showLobby();
    return;
  }
  const done = ch.history.length;
  const cfg = state.config;
  const pool = cfg.games?.length ? cfg.games : [...new Set(ch.history.map((h) => h.gameId))];
  const rng = seededRandom(Math.floor(Math.random() * 2 ** 31));
  const rounds = ch.history.map((h) => ({ gameId: h.gameId, seed: 0 }));
  let bag = [];
  while (rounds.length < ch.total) {
    if (!bag.length) bag = shuffle(pool, rng);
    rounds.push({ gameId: bag.shift(), seed: Math.floor(rng() * 2 ** 31), special: null });
  }
  Object.assign(ch, { rounds, index: done - 1, teamStandings: ch.teamStandings || new Map(), teams: cfg.teams || 0, eliminated: ch.eliminated || new Map(), mode: ch.mode || "punti", presenter: false, daily: null, quick: false });
  for (const s of ch.standings.values()) delete s.team;
  state.round = null;
  setScreen("handover");
  sfx.setScene("menu");
  const left = ch.total - done;
  const btn = el("button", { text: left > 0 ? `Continua la sfida (manche ${done + 1} di ${ch.total})` : "Vedi il risultato finale", onclick: () => { clearInterval(t); left > 0 ? nextRound() : finishChallenge(); } });
  let secs = 12;
  const p = el("p", { text: `Gli altri stanno rientrando nella stanza ${net.code}… si riparte tra ${secs} s` });
  const t = setInterval(() => { secs--; p.textContent = `Gli altri stanno rientrando nella stanza ${net.code}… si riparte tra ${secs} s`; if (secs <= 0) { clearInterval(t); if (state.screen === "handover") btn.click(); } }, 1000);
  appRoot().replaceChildren(el("div", { class: "screen" }, [
    el("h2", { text: "🎤 Hai preso il comando" }),
    el("div", { class: "card" }, [
      el("p", { text: `Chi aveva creato la stanza non risponde più. La sfida continua da qui, con i punti di tutti: ${done} ${done === 1 ? "manche giocata" : "manche giocate"} su ${ch.total}.` }),
      el("div", { class: "code-big", text: net.code }),
      p,
    ]),
    btn,
    el("div", { class: "spacer" }),
  ]));
  syncBackGuard();
}

// Chiude il campionato (host): tutti vedono il campione
export function closeChampionship() {
  const snap = endChampionship();
  if (!snap) return;
  const msg = { type: "champion", ...snap };
  state.net.broadcast(msg);
  showChampion(msg);
}

// ---------------------------------------------------------------
// Manche: comune a host e guest
// ---------------------------------------------------------------

async function beginRound(msg) {
  const net = state.net;
  if (!net) return;

  // Un guest arrivato a sfida iniziata crea la propria vista della sfida qui.
  if (!net.isHost && (!state.challenge || msg.index === 0)) {
    state.challenge = { total: msg.total, difficulty: msg.challengeDifficulty || msg.difficulty, index: msg.index, standings: new Map(), history: [], eliminated: new Map() };
  }
  state.challenge.index = msg.index;
  if (msg.mode) state.challenge.mode = msg.mode;
  if (!net.isHost) state.challenge.daily = msg.daily ? { key: msg.daily, group: true } : null;
  if (Array.isArray(msg.out)) { state.challenge.eliminated = new Map(msg.out.map((id) => [id, true])); }

  // Entrati a manche iniziata, presentatore, o non di turno nella coppia: si guarda (risultati in diretta)
  const sitOut = Array.isArray(msg.sitOut) ? msg.sitOut : [];
  if ((msg.spectate && !net.isHost) || sitOut.includes(net.me.id)) {
    const participants = net.players.map((p) => p.id).filter((id) => !sitOut.includes(id));
    state.round = { index: msg.index, game: null, params: null, startAt: msg.startAt, difficulty: msg.difficulty, special: msg.special || null, scores: new Map(), records: new Set(), participants, deadline: null, ready: new Set(), spectator: true, live: [] };
    const why = state.challenge?.presenter && net.isHost ? "🎤 Sei il presentatore: guardi, e a fine manche puoi dare un punto simpatia." : sitOut.includes(net.me.id) ? `🤝 Tocca al tuo compagno di coppia: ${net.players.find((p) => p.team === net.players.find((x) => x.id === net.me.id)?.team && p.id !== net.me.id && !sitOut.includes(p.id))?.name || "l'altra persona"}. Tu guardi questa manche.` : "👀 Manche già iniziata: la guardi da qui e giochi dalla prossima.";
    if (net.isHost) { state.round.deadline = setTimeout(publishResults, ((getEntry(msg.gameId)?.duration || 30) + 15) * 1000); }
    showSpectator(getEntry(msg.gameId), msg, why);
    try { const g = await loadGame(msg.gameId); if (state.round?.index === msg.index) state.round.game = g; renderLive(); } catch (_) { /* si vedrà ai risultati */ }
    return;
  }

  // Segnaposto subito (così i messaggi di questa manche non vengono scartati)…
  let myDifficulty = msg.difficulties?.[net.me.id] || msg.difficulty; // handicap personale
  if (myDifficulty === "esperto" && !isExpertUnlocked(msg.gameId)) myDifficulty = "difficile"; // Esperto solo dove è sbloccato
  state.round = { index: msg.index, game: null, params: null, startAt: msg.startAt, difficulty: myDifficulty, special: msg.special || null, duel: msg.duel || null, scores: new Map(), records: new Set(), participants: net.players.map((p) => p.id).filter((id) => !sitOut.includes(id)), deadline: null, ready: new Set() };
  state.round.waitReady = !msg.startAt; // alla prima volta si aspetta il pulsante
  showCountdown(getEntry(msg.gameId), msg);
  // "Sono pronto": l'host raccoglie e rimanda a tutti la lista di chi ha il conto alla rovescia a schermo
  // (alla prima volta, invece, ognuno preme il pulsante quando ha finito di leggere)
  if (!state.round.waitReady) sayReady(msg.index);
  else if (net.isHost) state.round.readyTimer = setTimeout(() => goRound(msg.index), READY_MAX_MS);

  // …poi il codice del minigioco, caricato a richiesta.
  let game;
  try {
    game = await loadGame(msg.gameId);
  } catch (_) {
    // Niente attesa infinita sul conto alla rovescia: si torna alla lobby.
    if (state.round?.index !== msg.index) return;
    clearTimeout(state.round.deadline);
    state.round = null;
    showLobby();
    setStatus(`Non riesco a caricare il minigioco “${getEntry(msg.gameId)?.title || msg.gameId}”. Prova a ricaricare la pagina.`, true);
    return;
  }
  if (state.round?.index !== msg.index) return; // nel frattempo è cambiato qualcosa
  state.round.game = game;
  state.round.params = game.createParams(seededRandom(msg.seed), state.round.difficulty === "esperto" ? "difficile" : state.round.difficulty);
}

// Spettatore: nome del minigioco in corso e lista di chi ha già finito (riempita da renderLive)
function showSpectator(entry, msg, why = "👀 Manche già iniziata: la guardi da qui e giochi dalla prossima.") {
  setScreen("spectate");
  sfx.setScene("game");
  const area = el("div", { class: "game-area spectate" }, [
    el("div", { class: "hint", text: `Manche ${msg.index + 1} di ${msg.total} in corso` }),
    gameIcon(entry, "countdown-icon"),
    el("div", { text: entry?.title || msg.gameId }),
    el("div", { class: "spectate-note", text: why }),
    el("div", { class: "game-done" }, [el("div", { class: "hint", text: "In attesa dei risultati…" })]),
  ]);
  appRoot().replaceChildren(area);
  syncBackGuard();
}

// "✓ Ho letto, sono pronto": alla prima volta il conto parte quando tutti l'hanno premuto
function readyButton(index) {
  const btn = el("button", { class: "ready-btn", text: "✓ Ho letto, sono pronto!" });
  btn.addEventListener("click", () => {
    btn.disabled = true;
    btn.textContent = isSolo() ? "Via!" : "Aspetto gli altri…";
    sayReady(index);
  });
  return btn;
}

function duelName(id) {
  return state.net?.players.find((p) => p.id === id)?.name || "?";
}

// Io sono pronto (host: segna e diffonde; ospite: lo dice all'host)
function sayReady(index) {
  const net = state.net;
  if (!net) return;
  if (net.isHost) markReady(net.me.id, index);
  else net.sendToHost({ type: "ready", index });
}

// Host: una persona è pronta per la manche `index`; tutti ricevono la lista aggiornata.
// Alla prima volta, quando tutti i partecipanti presenti hanno premuto Pronto, si parte.
function markReady(id, index) {
  const round = state.round;
  const net = state.net;
  if (!round || round.index !== index || !net?.isHost) return;
  round.ready.add(id);
  const ids = [...round.ready];
  net.broadcast({ type: "ready", index, ids });
  renderReady(ids);
  if (round.waitReady && !round.startAt) {
    const present = new Set(net.players.map((p) => p.id));
    const waiting = round.participants.filter((pid) => present.has(pid) && !round.ready.has(pid));
    if (waiting.length === 0) goRound(index);
  }
}

// Host: via alla manche (dopo il "Pronto" di tutti o allo scadere dell'attesa)
function goRound(index) {
  const round = state.round;
  const net = state.net;
  if (!round || round.index !== index || !net?.isHost || round.startAt) return;
  clearTimeout(round.readyTimer);
  const startAt = net.now() + COUNTDOWN_MS;
  round.startAt = startAt;
  document.querySelector(".ready-btn")?.remove();
  if (net.lastBroadcast?.type === "start" && net.lastBroadcast.index === index) net.lastBroadcast.startAt = startAt; // chi rientra parte col conto
  net.broadcast({ type: "go", index, startAt });
}

// Lista dei nomi nel conto alla rovescia: ✓ a chi è pronto
function renderReady(ids) {
  const list = document.querySelector(".ready-list");
  const net = state.net;
  if (!list || !net) return;
  const ready = new Set(ids);
  list.replaceChildren(...net.players.map((p) => el("span", { class: `ready-name${ready.has(p.id) ? " on" : ""}`, text: `${ready.has(p.id) ? "✓ " : ""}${p.name}` })));
}

function showCountdown(entry, msg) {
  setScreen("countdown");
  sfx.setScene("game");
  const net = state.net;
  const number = el("div", { class: "big", text: "" });
  const special = msg.special ? SPECIALS[msg.special] : null;
  if (special) sfx.play("special");
  const amOut = state.challenge?.eliminated?.has(net.me.id);
  const ch = state.challenge;
  const sofar = ch?.series ? seriesSummary(ch, getLoaded(msg.gameId)) : null;
  const area = el("div", { class: `game-area${msg.intro ? " intro" : ""}` }, [
    el("div", { class: "hint", text: ch?.series
      ? `Partita ${msg.index + 1}${Number.isFinite(msg.total) ? ` di ${msg.total}` : ""} · ${difficultyLabel(state.round?.difficulty || msg.difficulty)}`
      : `Manche ${msg.index + 1} di ${msg.total} · ${difficultyLabel(state.round?.difficulty || msg.difficulty)}${msg.difficulties?.[net.me.id] ? " (la tua difficoltà)" : msg.difficulty === "esperto" && state.round?.difficulty !== "esperto" ? " (Esperto non ancora sbloccato qui)" : ""}` }),
    sofar ? el("div", { class: "series-sofar", text: `Finora ${sofar.n} ${sofar.n === 1 ? "partita" : "partite"} · ${sofar.text}` }) : el("span"),
    special
      ? el("div", { class: "special-banner" }, [
          el("div", { class: "special-title", text: `${special.icon} ${special.label}` }),
          msg.duel ? el("div", { class: "special-duel", text: `${duelName(msg.duel[0])} contro ${duelName(msg.duel[1])}` }) : el("span"),
          el("div", { class: "special-desc", text: msg.duel?.includes(net.me.id) ? "Sei in duello! Chi fa meglio tra voi due prende punti extra." : special.desc }),
        ])
      : el("span"),
    amOut ? el("div", { class: "out-banner", text: "💀 Sei fuori: gioca per divertimento, senza punti" }) : el("span"),
    gameIcon(entry, "countdown-icon"),
    el("div", { text: entry?.title || msg.gameId }),
    msg.intro
      ? el("div", { class: "howto-intro" }, [el("div", { class: "howto-label", text: "Come si gioca" }), el("div", { text: entry?.howTo || entry?.description || "" })])
      : el("div", { class: "hint", text: entry?.description || "" }),
    number,
    msg.startAt ? el("span") : readyButton(msg.index),
    isSolo() ? el("span") : el("div", { class: "ready-list" }),
    ch?.series ? seriesEndButton("between") : el("span"),
  ]);
  const cat = getCategory(entry?.category);
  if (cat) area.style.setProperty("--cat", cat.color);
  area.classList.add("countdown");
  appRoot().replaceChildren(area);
  syncBackGuard();
  if (!isSolo()) renderReady(net.isHost ? [net.me.id] : []);

  const tick = () => {
    if (state.round?.index !== msg.index || !state.net) return; // manche annullata
    if (!state.round.startAt) { number.textContent = ""; setTimeout(tick, 150); return; } // si aspetta il "Pronto" di tutti
    const remaining = state.round.startAt - net.now();
    if (remaining <= 0) {
      if (!state.round.game) {
        number.textContent = "…"; // codice non ancora arrivato: aspetta
        setTimeout(tick, 100);
        return;
      }
      area.remove();
      sfx.play("go");
      mountGame();
      return;
    }
    const n = Math.ceil(remaining / 1000);
    if (number.textContent !== String(n)) sfx.play("tick");
    number.textContent = n;
    setTimeout(tick, Math.min(100, remaining));
  };
  tick();
}

function mountGame() {
  setScreen("game");
  const round = state.round;
  const net = state.net;
  markSeen(round.game.id);
  setExpert(round.difficulty === "esperto");

  if (net.isHost) {
    // Scadenza di sicurezza: se qualcuno non risponde, si chiude comunque.
    round.deadline = setTimeout(publishResults, (round.game.maxSeconds + GRACE_SECONDS) * 1000);
  }

  round.game.mount(appRoot(), {
    params: round.params,
    difficulty: round.difficulty === "esperto" ? "difficile" : round.difficulty,
    me: net.me,
    now: () => net.now(),
    onFinish: (score, detail) => submitScore(score, detail),
  });
  // Cornice con il colore della categoria (come al conto alla rovescia)
  const cat = getCategory(getEntry(round.game.id)?.category);
  const area = appRoot().querySelector(".game-area");
  if (cat && area) area.style.setProperty("--cat", cat.color);
  // Serie: il pulsante Fine nell'intestazione (o in un angolo, se il minigioco non usa la cornice comune)
  if (state.challenge?.series) {
    const header = appRoot().querySelector(".game-header");
    if (header) header.insertBefore(seriesEndButton(), header.querySelector(".game-timer"));
    else appRoot().append(el("div", { class: "series-end-float" }, [seriesEndButton()]));
  }
}

function submitScore(score, detail = null) {
  const net = state.net;
  const round = state.round;
  if (!round || !net) return;
  round.myScore = score;
  round.myDetail = detail;
  round.myMax = typeof round.game.maxScore === "function" ? round.game.maxScore(round.params) : null;
  round.isRecord = updateRecord(round.game, round.difficulty, score);
  if (round.isRecord) bumpWeekly("records");

  if (net.isHost) {
    recordScore(net.me.id, score, round.isRecord);
  } else {
    net.sendToHost({ type: "result", index: round.index, score, record: round.isRecord });
  }
  setTimeout(renderLive, 0); // la schermata di attesa del minigioco è appena comparsa
}

// ---------------------------------------------------------------
// Raccolta punteggi e classifiche (host)
// ---------------------------------------------------------------

function recordScore(playerId, score, record = false) {
  const round = state.round;
  if (!round || round.scores.has(playerId)) return;
  round.scores.set(playerId, score);
  if (record) round.records.add(playerId);
  // Risultati in diretta: chi ha già finito, in ordine di arrivo
  if (!isSolo()) {
    const net = state.net;
    const done = [...round.scores.entries()].map(([id, s]) => { const p = net.players.find((x) => x.id === id); return { id, name: p?.name || "?", color: p?.color || 0, score: s }; });
    round.live = done;
    net.broadcast({ type: "progress", index: round.index, done });
    renderLive();
  }
  checkRoundComplete();
}

// Lista di chi ha finito, dentro la schermata "In attesa degli altri…" del minigioco
export function renderLive() {
  const round = state.round;
  const box = document.querySelector(".game-done");
  if (!round?.live?.length || !box || !round.game) return;
  let list = box.querySelector(".live-list");
  if (!list) { list = el("div", { class: "live-list" }); box.append(list); }
  const known = new Set([...list.children].map((c) => c.dataset.id));
  for (const d of round.live) {
    if (known.has(d.id)) continue;
    const row = el("div", { class: `live-row${d.id === state.net.me.id ? " me" : ""}`, "data-id": d.id }, [
      colorDot(d.color, d.id),
      el("span", { text: d.name }),
      el("span", { class: "live-score", text: d.score === null || d.score === undefined ? "—" : round.game.formatScore(d.score) }),
    ]);
    list.append(row);
    if (d.id !== state.net.me.id) sfx.play("blip");
  }
  const total = round.participants.length;
  if (round.spectator) box.querySelector(".hint").textContent = round.live.length ? `Hanno finito: ${round.live.length}` : "In attesa dei risultati…";
  else box.querySelector(".hint").textContent = round.live.length >= total ? "Tutti hanno finito!" : `In attesa degli altri… (${round.live.length} su ${total})`;
}

export function checkRoundComplete() {
  const round = state.round;
  if (!round || !state.net?.isHost || state.screen === "results") return;
  const present = new Set(state.net.players.map((p) => p.id));
  const waiting = round.participants.filter((id) => present.has(id) && !round.scores.has(id));
  if (waiting.length === 0 && round.scores.size > 0) publishResults();
}

// Presentatore: un punto "simpatia" a una persona, una volta per manche (host → tutti)
export function giveBonus(id) {
  const ch = state.challenge;
  const net = state.net;
  if (!net?.isHost || !ch?.presenter || !ch.standings.has(id) || ch.bonusGiven === state.round?.index) return;
  ch.bonusGiven = state.round?.index;
  ch.standings.get(id).points += 1;
  const msg = { type: "bonus", id, name: ch.standings.get(id).name, standings: standingsArray() };
  net.broadcast(msg);
  applyBonus(msg);
}
function applyBonus(msg) {
  const ch = state.challenge;
  if (ch && !state.net.isHost) for (const s of msg.standings) { const e = ch.standings.get(s.id); if (e) e.points = s.points; }
  for (const li of document.querySelectorAll(`.ranking li[data-id="${CSS.escape(String(msg.id))}"] .score`)) { const s = msg.standings.find((x) => x.id === msg.id); if (s && /pt$/.test(li.textContent)) { li.textContent = `${s.points} pt`; li.classList.add("bumped"); } }
  document.querySelectorAll(".bonus-btn").forEach((b) => { b.disabled = true; });
  toastBonus(msg.name);
}
function toastBonus(name) { toast(`🎁 Punto simpatia a ${name} dal presentatore!`); sfx.play("coin"); }

function publishResults() {
  const round = state.round;
  const ch = state.challenge;
  const net = state.net;
  if (!round || !round.game || round.published || state.screen === "results") return;
  round.published = true;
  clearTimeout(round.deadline);
  clearTimeout(round.readyTimer);
  clearTimeout(round.stopGuard);

  const infoOf = (id) => net.players.find((p) => p.id === id) || ch.standings.get(id) || { name: "?", color: 0 };
  const order = round.game.order;

  const elimination = ch.mode === "eliminazione";
  const isOut = (id) => elimination && ch.eliminated.has(id);
  const ranking = round.participants
    .map((id) => ({ id, name: infoOf(id).name, color: infoOf(id).color, score: round.scores.has(id) ? round.scores.get(id) : null, record: round.records.has(id), out: isOut(id) }))
    .sort((a, b) => {
      if (a.out !== b.out) return a.out ? 1 : -1; // chi è fuori in fondo
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return order === "asc" ? a.score - b.score : b.score - a.score;
    });

  // Punti per posizione tra chi è in gara: primo = N, secondo = N-1… A pari punteggio, pari punti.
  const alive = ranking.filter((r) => !r.out);
  const n = alive.length;
  let pos = 0;
  alive.forEach((r, i) => {
    if (i === 0 || r.score !== alive[i - 1].score) pos = i;
    r.points = r.score === null ? 0 : n - pos;
  });
  ranking.forEach((r) => { if (r.out) r.points = 0; });

  // Eliminazione: l'ultimo tra chi è in gara esce (a pari merito escono tutti, ma mai tutti quanti)
  let eliminatedNow = [];
  if (elimination && n > 1) {
    const worst = alive[alive.length - 1].score;
    const losers = alive.filter((r) => r.score === worst || (r.score === null && worst === null));
    if (losers.length < n) {
      eliminatedNow = losers.map((r) => ({ id: r.id, name: r.name, color: r.color }));
      for (const l of losers) { ch.eliminated.set(l.id, round.index); l.eliminatedNow = true; }
    }
  }
  // Manche speciale: punti doppi, tutto o niente, rimonta, duello…
  const specialOutcome = round.special ? applySpecial(round.special, ranking, standingsArray(), { duel: round.duel }) : null;

  for (const r of ranking) {
    const entry = ch.standings.get(r.id) || { name: r.name, color: r.color, points: 0 };
    entry.name = r.name;
    entry.color = r.color;
    entry.points += r.points;
    const team = net.players.find((p) => p.id === r.id)?.team;
    if (Number.isInteger(team)) entry.team = team;
    ch.standings.set(r.id, entry);
  }
  // Percentuale di prestazione di ognuno (per i premi) e record del gruppo (per stanza/nome)
  for (const r of ranking) r.pct = r.score === null ? 0 : ratingOf(round.game, r.score, round.params);
  let groupRecord = null;
  {
    const best = ranking.find((r) => r.score !== null && !r.out && round.game.isValidScore(r.score));
    const roomName = state.config.roomName || "";
    const old = getGroupRecord(roomName, round.game.id);
    const better = best && (!old || (order === "asc" ? best.score < old.score : best.score > old.score));
    if (better) {
      groupRecord = { name: best.name, id: best.id, text: round.game.formatScore(best.score), isNew: true, previous: old ? { name: old.name, text: old.text } : null };
      saveGroupRecord(roomName, round.game.id, { score: best.score, text: groupRecord.text, name: best.name, at: Date.now() });
    } else if (old) groupRecord = { name: old.name, text: old.text, isNew: false };
  }
  ch.history.push({ gameId: round.game.id, ranking, special: round.special || null, eliminated: eliminatedNow.map((e) => e.id) });

  // Squadre: media dei punti dei membri, poi punti per posizione tra squadre
  let teamRanking = null;
  if (ch.teams) {
    teamRanking = teamRound(ranking, (id) => ch.standings.get(id)?.team, round.special === "staffetta");
    for (const t of teamRanking) ch.teamStandings.set(t.team, (ch.teamStandings.get(t.team) || 0) + t.points);
  }

  const msg = {
    type: "results",
    index: round.index,
    total: ch.total,
    difficulty: round.difficulty,
    challengeDifficulty: ch.difficulty,
    special: round.special || null,
    duel: round.duel || null,
    specialOutcome,
    gameId: round.game.id,
    ranking,
    standings: standingsArray(),
    teamRanking,
    teamStandings: teamStandingsArray(),
    mode: ch.mode,
    groupRecord,
    eliminated: eliminatedNow,
    alive: elimination ? ranking.filter((r) => !ch.eliminated.has(r.id)).length : null,
    last: round.index === ch.total - 1 || (elimination && ranking.filter((r) => !ch.eliminated.has(r.id)).length <= 1),
  };
  if (ch.series) { seriesStep(msg); return; } // serie da soli: niente schermata dei risultati in mezzo
  net.broadcast(msg);
  showResults(msg);
}

// Reazioni con le faccine: chi guarda tocca, l'host rilancia a tutti (una al secondo a persona)
const REACTIONS = ["👏", "😂", "😱", "🔥", "❤️"];
const lastReaction = new Map();
export function sendReaction(id, emoji) {
  const net = state.net;
  if (!net?.isHost || !REACTIONS.includes(emoji)) return;
  const now = Date.now();
  if (now - (lastReaction.get(id) || 0) < 900) return;
  lastReaction.set(id, now);
  if (state.challenge) { const m = state.challenge.reactions || (state.challenge.reactions = new Map()); m.set(id, (m.get(id) || 0) + 1); }
  net.broadcast({ type: "react", id, emoji });
  showReaction(id, emoji);
}
export function react(emoji) {
  const net = state.net;
  if (!net || isSolo()) return;
  if (net.isHost) sendReaction(net.me.id, emoji);
  else net.sendToHost({ type: "react", emoji });
}
export { REACTIONS };

// Host: qualità della linea di una persona ("good" | "slow" | "bad"), mostrata in stanza
export function setLink(id, quality) {
  const net = state.net;
  const p = net?.players.find((x) => x.id === id);
  if (!p || !["good", "slow", "bad"].includes(quality) || p.link === quality) return;
  if (quality === "good") delete p.link; else p.link = quality;
  net.broadcastPlayers();
  net.handlers.onPlayers?.(net.players);
}

// Host: chi ha l'app in secondo piano (💤 in stanza)
export function setPresence(id, away) {
  const net = state.net;
  const p = net?.players.find((x) => x.id === id);
  if (!p || !!p.away === away) return;
  if (away) p.away = true; else delete p.away;
  net.broadcastPlayers();
  net.handlers.onPlayers?.(net.players);
}

export function teamStandingsArray() {
  const ch = state.challenge;
  if (!ch?.teams) return null;
  return [...ch.teamStandings.entries()].map(([team, points]) => ({ team, points })).sort((a, b) => b.points - a.points);
}

export function standingsArray() {
  const ch = state.challenge;
  const outAt = (id) => (ch.mode === "eliminazione" && ch.eliminated.has(id) ? ch.eliminated.get(id) : null);
  return [...ch.standings.entries()]
    .map(([id, e]) => ({ id, name: e.name, color: e.color, points: e.points, out: outAt(id) }))
    .sort((a, b) => {
      const ao = a.out !== null && a.out !== undefined, bo = b.out !== null && b.out !== undefined;
      if (ao !== bo) return ao ? 1 : -1;       // chi è in gara prima
      if (ao && bo) return b.out - a.out;       // tra gli eliminati, chi è durato di più prima
      return b.points - a.points;
    });
}

// ---------------------------------------------------------------
// Messaggi ricevuti dalla rete
// ---------------------------------------------------------------

export function handleMessage(msg, fromId) {
  const net = state.net;
  if (!net) return;

  if (net.isHost) {
    if (msg.type === "result" && msg.index === state.round?.index) recordScore(fromId, msg.score, msg.record === true);
    else if (msg.type === "ready") markReady(fromId, msg.index);
    else if (msg.type === "presence") setPresence(fromId, msg.away === true);
    else if (msg.type === "react") sendReaction(fromId, msg.emoji);
    else if (msg.type === "link") setLink(fromId, msg.quality);
    return;
  }
  if (msg.type === "ready") { if (state.round?.index === msg.index && state.screen === "countdown") renderReady(msg.ids || []); return; }
  if (msg.type === "go") { if (state.round?.index === msg.index && !state.round.startAt) { state.round.startAt = msg.startAt; document.querySelector(".ready-btn")?.remove(); } return; }
  if (msg.type === "progress") { if (state.round?.index === msg.index) { state.round.live = msg.done || []; renderLive(); } return; }
  if (msg.type === "react") { showReaction(msg.id, msg.emoji); return; }
  if (msg.type === "bonus") { applyBonus(msg); return; }

  // Dopo un rientro l'host rimanda l'ultimo messaggio di fase: se lo abbiamo già, niente doppioni.
  switch (msg.type) {
    case "config":
      state.hostConfig = msg.config;
      if (state.screen === "lobby") showLobby();
      break;
    case "start":
      if (state.round?.index === msg.index && state.round.startAt === msg.startAt) return;
      state.round?.game?.unmount();
      beginRound(msg);
      break;
    case "results":
      if (state.screen === "results" && state.round?.index === msg.index) return;
      // Arrivati (o rientrati) a pagina nuova: la vista della sfida si ricostruisce da qui
      if (!state.challenge) state.challenge = { total: msg.total || msg.index + 1, difficulty: msg.challengeDifficulty || msg.difficulty || null, index: msg.index, standings: new Map(), history: [], eliminated: new Map() };
      if (msg.mode) state.challenge.mode = msg.mode;
      if (!state.challenge.eliminated) state.challenge.eliminated = new Map();
      for (const s of msg.standings) if (s.out !== null && s.out !== undefined) state.challenge.eliminated.set(s.id, s.out);
      showResults(msg);
      break;
    case "final":
      if (state.screen === "final") return;
      if (!state.challenge) state.challenge = { total: 0, difficulty: null, index: 0, standings: new Map(), history: [] };
      showFinal(msg);
      break;
    case "lobby":
      if (state.screen === "lobby" && !state.challenge) return;
      state.challenge = null;
      state.round = null;
      showLobby();
      break;
    case "champion":
      if (state.screen === "champion") return;
      state.challenge = null;
      state.round = null;
      showChampion(msg);
      break;
  }
}
