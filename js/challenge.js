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
import { setStatus, gameIcon, difficultyLabel, appRoot } from "./ui.js";
import { syncBackGuard } from "./nav.js";
import { getEntry, loadGame, preloadGames } from "./games/catalog.js";
import { shuffle } from "./games/shell.js";
import { updateRecord, markSeen } from "./storage.js";
import { showLobby } from "./screens/lobby.js";
import { showResults, showFinal } from "./screens/results.js";
import { computeAwards } from "./awards.js";
import { teamRound } from "./teams.js";

const COUNTDOWN_MS = 3500; // dal messaggio "start" al via
const INTRO_MS = 7000;     // …quando per qualcuno è la prima volta: si legge come si gioca
const GRACE_SECONDS = 8;   // margine oltre maxSeconds prima di chiudere la manche

// ---------------------------------------------------------------
// Avvio (host)
// ---------------------------------------------------------------

// sameGames: (rivincita) stessa sequenza di minigiochi della sfida appena finita, semi nuovi
export async function startChallenge(sameGames = null) {
  if (!Array.isArray(sameGames)) sameGames = null; // (un evento del click non è una lista)
  const cfg = state.config;
  const rng = seededRandom(Math.floor(Math.random() * 2 ** 31));

  // "Tutti": ogni minigioco scelto una volta, in ordine casuale.
  // Altrimenti: cicla su quelli scelti, mescolati, evitando ripetizioni vicine.
  const total = sameGames ? sameGames.length : cfg.rounds === "tutti" ? cfg.games.length : cfg.rounds;
  const rounds = [];
  let pool = [];
  while (rounds.length < total) {
    if (sameGames) {
      rounds.push({ gameId: sameGames[rounds.length], seed: Math.floor(rng() * 2 ** 31) });
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

  state.challenge = {
    rounds,
    total: rounds.length,
    difficulty: cfg.difficulty,
    index: -1,
    standings: new Map(),
    teamStandings: new Map(), // squadra -> punti (solo con le squadre attive)
    teams: isSolo() ? 0 : cfg.teams,
    history: [],
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
  const msg = {
    type: "start",
    index: ch.index,
    total: ch.total,
    gameId: r.gameId,
    seed: r.seed,
    difficulty: ch.difficulty,
    intro,
    startAt: net.now() + (intro ? INTRO_MS : COUNTDOWN_MS),
  };
  net.broadcast(msg);
  beginRound(msg);
}

// Rivincita: stessa sfida (stessi minigiochi, stesso ordine), nuovi semi, punti da zero
export function replayChallenge() {
  const games = state.challenge?.rounds?.map((r) => r.gameId);
  if (!games?.length) return;
  state.round = null;
  startChallenge(games);
}

export function finishChallenge() {
  const standings = standingsArray();
  const msg = { type: "final", standings, awards: computeAwards(state.challenge.history, standings), teamStandings: teamStandingsArray() };
  state.net.broadcast(msg);
  showFinal(msg);
}

// ---------------------------------------------------------------
// Manche: comune a host e guest
// ---------------------------------------------------------------

async function beginRound(msg) {
  const net = state.net;
  if (!net) return;

  // Un guest arrivato a sfida iniziata crea la propria vista della sfida qui.
  if (!net.isHost && (!state.challenge || msg.index === 0)) {
    state.challenge = { total: msg.total, difficulty: msg.difficulty, index: msg.index, standings: new Map(), history: [] };
  }
  state.challenge.index = msg.index;

  // Segnaposto subito (così i messaggi di questa manche non vengono scartati)…
  state.round = { index: msg.index, game: null, params: null, startAt: msg.startAt, scores: new Map(), records: new Set(), participants: net.players.map((p) => p.id), deadline: null };
  showCountdown(getEntry(msg.gameId), msg);

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
  state.round.params = game.createParams(seededRandom(msg.seed), msg.difficulty);
}

function showCountdown(entry, msg) {
  setScreen("countdown");
  sfx.setScene("game");
  const net = state.net;
  const number = el("div", { class: "big", text: "" });
  const area = el("div", { class: `game-area${msg.intro ? " intro" : ""}` }, [
    el("div", { class: "hint", text: `Manche ${msg.index + 1} di ${msg.total} · ${difficultyLabel(msg.difficulty)}` }),
    gameIcon(entry, "countdown-icon"),
    el("div", { text: entry?.title || msg.gameId }),
    msg.intro
      ? el("div", { class: "howto-intro" }, [el("div", { class: "howto-label", text: "Come si gioca" }), el("div", { text: entry?.howTo || entry?.description || "" })])
      : el("div", { class: "hint", text: entry?.description || "" }),
    number,
  ]);
  appRoot().replaceChildren(area);
  syncBackGuard();

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
    difficulty: state.challenge.difficulty,
    me: net.me,
    now: () => net.now(),
    onFinish: (score, detail) => submitScore(score, detail),
  });
}

function submitScore(score, detail = null) {
  const net = state.net;
  const round = state.round;
  if (!round || !net) return;
  round.myScore = score;
  round.myDetail = detail;
  round.myMax = typeof round.game.maxScore === "function" ? round.game.maxScore(round.params) : null;
  round.isRecord = updateRecord(round.game, state.challenge.difficulty, score);

  if (net.isHost) {
    recordScore(net.me.id, score, round.isRecord);
  } else {
    net.sendToHost({ type: "result", index: round.index, score, record: round.isRecord });
  }
}

// ---------------------------------------------------------------
// Raccolta punteggi e classifiche (host)
// ---------------------------------------------------------------

function recordScore(playerId, score, record = false) {
  const round = state.round;
  if (!round || round.scores.has(playerId)) return;
  round.scores.set(playerId, score);
  if (record) round.records.add(playerId);
  checkRoundComplete();
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

  const ranking = round.participants
    .map((id) => ({ id, name: infoOf(id).name, color: infoOf(id).color, score: round.scores.has(id) ? round.scores.get(id) : null, record: round.records.has(id) }))
    .sort((a, b) => {
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return order === "asc" ? a.score - b.score : b.score - a.score;
    });

  // Punti per posizione: primo = N, secondo = N-1… A pari punteggio, pari punti.
  const n = ranking.length;
  let pos = 0;
  ranking.forEach((r, i) => {
    if (i === 0 || r.score !== ranking[i - 1].score) pos = i;
    r.points = r.score === null ? 0 : n - pos;
  });

  for (const r of ranking) {
    const entry = ch.standings.get(r.id) || { name: r.name, color: r.color, points: 0 };
    entry.name = r.name;
    entry.color = r.color;
    entry.points += r.points;
    const team = net.players.find((p) => p.id === r.id)?.team;
    if (Number.isInteger(team)) entry.team = team;
    ch.standings.set(r.id, entry);
  }
  ch.history.push({ gameId: round.game.id, ranking });

  // Squadre: media dei punti dei membri, poi punti per posizione tra squadre
  let teamRanking = null;
  if (ch.teams) {
    teamRanking = teamRound(ranking, (id) => ch.standings.get(id)?.team);
    for (const t of teamRanking) ch.teamStandings.set(t.team, (ch.teamStandings.get(t.team) || 0) + t.points);
  }

  const msg = {
    type: "results",
    index: round.index,
    total: ch.total,
    difficulty: ch.difficulty,
    gameId: round.game.id,
    ranking,
    standings: standingsArray(),
    teamRanking,
    teamStandings: teamStandingsArray(),
    last: round.index === ch.total - 1,
  };
  net.broadcast(msg);
  showResults(msg);
}

export function teamStandingsArray() {
  const ch = state.challenge;
  if (!ch?.teams) return null;
  return [...ch.teamStandings.entries()].map(([team, points]) => ({ team, points })).sort((a, b) => b.points - a.points);
}

export function standingsArray() {
  return [...state.challenge.standings.entries()]
    .map(([id, e]) => ({ id, name: e.name, color: e.color, points: e.points }))
    .sort((a, b) => b.points - a.points);
}

// ---------------------------------------------------------------
// Messaggi ricevuti dalla rete
// ---------------------------------------------------------------

export function handleMessage(msg, fromId) {
  const net = state.net;
  if (!net) return;

  if (net.isHost) {
    if (msg.type === "result" && msg.index === state.round?.index) recordScore(fromId, msg.score, msg.record === true);
    return;
  }

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
      if (!state.challenge) state.challenge = { total: msg.total || msg.index + 1, difficulty: msg.difficulty || null, index: msg.index, standings: new Map(), history: [] };
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
  }
}
