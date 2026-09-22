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
import { setStatus, gameIcon, difficultyLabel, appRoot, colorDot } from "./ui.js";
import { syncBackGuard } from "./nav.js";
import { getEntry, getCategory, loadGame, preloadGames } from "./games/catalog.js";
import { shuffle } from "./games/shell.js";
import { updateRecord, markSeen } from "./storage.js";
import { showLobby } from "./screens/lobby.js";
import { showResults, showFinal } from "./screens/results.js";
import { computeAwards } from "./awards.js";
import { teamRound } from "./teams.js";
import { SPECIALS, roundDifficulty, assignSpecials, applySpecial, pickDuel } from "./specials.js";
import { addDay, endChampionship, isChampionship, startChampionship } from "./championship.js";
import { showChampion, showReaction } from "./screens/results.js";

const COUNTDOWN_MS = 3500; // dal messaggio "start" al via
const INTRO_MS = 7000;     // …quando per qualcuno è la prima volta: si legge come si gioca
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

  state.challenge = {
    rounds,
    total: rounds.length,
    difficulty,
    index: -1,
    standings: new Map(),
    teamStandings: new Map(), // squadra -> punti (solo con le squadre attive)
    teams: isSolo() ? 0 : cfg.teams,
    history: [],
    daily: opts.daily || null, // { key } nella Sfida del giorno
    quick: opts.quick === true,
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
    difficulty: special?.difficulty || roundDifficulty(ch.difficulty, ch.index, ch.total),
    difficulties,
    challengeDifficulty: ch.difficulty,
    special: special ? special.id : null,
    duel: r.duel || null,
    mode: ch.mode,
    daily: ch.daily?.key || null,
    out: [...ch.eliminated.keys()],
    intro,
    startAt: net.now() + (intro ? INTRO_MS : COUNTDOWN_MS),
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
  startChallenge(ch.daily ? { games, seeds: ch.rounds.map((r) => r.seed), difficulty: ch.difficulty, daily: ch.daily } : { games, quick: ch.quick });
}

export function finishChallenge() {
  const standings = standingsArray();
  const msg = { type: "final", standings, awards: computeAwards(state.challenge.history, standings), teamStandings: teamStandingsArray() };
  // Campionato: questa sfida è una giornata
  if (!isSolo() && state.config.championship) {
    if (!isChampionship()) startChampionship();
    msg.championship = addDay(standings);
  }
  state.net.broadcast(msg);
  showFinal(msg);
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

  // Entrati a manche iniziata: si guarda (risultati in diretta), si gioca dalla prossima
  if (msg.spectate && !net.isHost) {
    state.round = { index: msg.index, game: null, params: null, startAt: msg.startAt, difficulty: msg.difficulty, special: msg.special || null, scores: new Map(), records: new Set(), participants: [], deadline: null, ready: new Set(), spectator: true, live: [] };
    showSpectator(getEntry(msg.gameId), msg);
    try { const g = await loadGame(msg.gameId); if (state.round?.index === msg.index) state.round.game = g; renderLive(); } catch (_) { /* si vedrà ai risultati */ }
    return;
  }

  // Segnaposto subito (così i messaggi di questa manche non vengono scartati)…
  const myDifficulty = msg.difficulties?.[net.me.id] || msg.difficulty; // handicap personale
  state.round = { index: msg.index, game: null, params: null, startAt: msg.startAt, difficulty: myDifficulty, special: msg.special || null, duel: msg.duel || null, scores: new Map(), records: new Set(), participants: net.players.map((p) => p.id), deadline: null, ready: new Set() };
  showCountdown(getEntry(msg.gameId), msg);
  // "Sono pronto": l'host raccoglie e rimanda a tutti la lista di chi ha il conto alla rovescia a schermo
  if (net.isHost) markReady(net.me.id, msg.index);
  else net.sendToHost({ type: "ready", index: msg.index });

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
  state.round.params = game.createParams(seededRandom(msg.seed), state.round.difficulty);
}

// Spettatore: nome del minigioco in corso e lista di chi ha già finito (riempita da renderLive)
function showSpectator(entry, msg) {
  setScreen("spectate");
  sfx.setScene("game");
  const area = el("div", { class: "game-area spectate" }, [
    el("div", { class: "hint", text: `Manche ${msg.index + 1} di ${msg.total} in corso` }),
    gameIcon(entry, "countdown-icon"),
    el("div", { text: entry?.title || msg.gameId }),
    el("div", { class: "spectate-note", text: "👀 Manche già iniziata: la guardi da qui e giochi dalla prossima." }),
    el("div", { class: "game-done" }, [el("div", { class: "hint", text: "In attesa dei risultati…" })]),
  ]);
  appRoot().replaceChildren(area);
  syncBackGuard();
}

function duelName(id) {
  return state.net?.players.find((p) => p.id === id)?.name || "?";
}

// Host: una persona è pronta per la manche `index`; tutti ricevono la lista aggiornata
function markReady(id, index) {
  const round = state.round;
  const net = state.net;
  if (!round || round.index !== index || !net?.isHost) return;
  round.ready.add(id);
  const ids = [...round.ready];
  net.broadcast({ type: "ready", index, ids });
  renderReady(ids);
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
  const area = el("div", { class: `game-area${msg.intro ? " intro" : ""}` }, [
    el("div", { class: "hint", text: `Manche ${msg.index + 1} di ${msg.total} · ${difficultyLabel(state.round?.difficulty || msg.difficulty)}${msg.difficulties?.[net.me.id] ? " (la tua difficoltà)" : ""}` }),
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
    isSolo() ? el("span") : el("div", { class: "ready-list" }),
  ]);
  const cat = getCategory(entry?.category);
  if (cat) area.style.setProperty("--cat", cat.color);
  area.classList.add("countdown");
  appRoot().replaceChildren(area);
  syncBackGuard();
  if (!isSolo()) renderReady(net.isHost ? [net.me.id] : []);

  const tick = () => {
    if (state.round?.index !== msg.index || !state.net) return; // manche annullata
    const remaining = msg.startAt - net.now();
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

  if (net.isHost) {
    // Scadenza di sicurezza: se qualcuno non risponde, si chiude comunque.
    round.deadline = setTimeout(publishResults, (round.game.maxSeconds + GRACE_SECONDS) * 1000);
  }

  round.game.mount(appRoot(), {
    params: round.params,
    difficulty: round.difficulty,
    me: net.me,
    now: () => net.now(),
    onFinish: (score, detail) => submitScore(score, detail),
  });
  // Cornice con il colore della categoria (come al conto alla rovescia)
  const cat = getCategory(getEntry(round.game.id)?.category);
  const area = appRoot().querySelector(".game-area");
  if (cat && area) area.style.setProperty("--cat", cat.color);
}

function submitScore(score, detail = null) {
  const net = state.net;
  const round = state.round;
  if (!round || !net) return;
  round.myScore = score;
  round.myDetail = detail;
  round.myMax = typeof round.game.maxScore === "function" ? round.game.maxScore(round.params) : null;
  round.isRecord = updateRecord(round.game, round.difficulty, score);

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

function publishResults() {
  const round = state.round;
  const ch = state.challenge;
  const net = state.net;
  if (!round || !round.game || state.screen === "results") return;
  clearTimeout(round.deadline);

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
    eliminated: eliminatedNow,
    alive: elimination ? ranking.filter((r) => !ch.eliminated.has(r.id)).length : null,
    last: round.index === ch.total - 1 || (elimination && ranking.filter((r) => !ch.eliminated.has(r.id)).length <= 1),
  };
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
    return;
  }
  if (msg.type === "ready") { if (state.round?.index === msg.index && state.screen === "countdown") renderReady(msg.ids || []); return; }
  if (msg.type === "progress") { if (state.round?.index === msg.index) { state.round.live = msg.done || []; renderLive(); } return; }
  if (msg.type === "react") { showReaction(msg.id, msg.emoji); return; }

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
