/*
  App: il telaio del gioco.
  Schermate: home, stanza (con configurazione della sfida), conto alla
  rovescia, minigioco, risultati della manche, podio finale.

  Una "sfida" è una sequenza di manche. L'host la configura (minigiochi,
  numero di manche, difficoltà), poi per ogni manche:
    host annuncia il minigioco -> tutti partono allo stesso istante ->
    ognuno manda il punteggio all'host -> l'host pubblica classifica della
    manche e classifica generale (punti per posizione).
*/

import { VERSION } from "./version.js";
import { Net } from "./net.js";
import { GAMES, getGame } from "./games/registry.js";
import { el, seededRandom } from "./utils.js";
import { DIFFICULTIES, ROUND_OPTIONS, loadConfig, saveConfig, getRecord, updateRecord } from "./storage.js";
import { shuffle } from "./games/shell.js";

const app = document.getElementById("app");
document.getElementById("version").textContent = `v${VERSION}`;

const ALL_GAME_IDS = GAMES.map((g) => g.id);

const state = {
  net: null,
  name: localStorage.getItem("name") || "",
  config: loadConfig(ALL_GAME_IDS), // configurazione della sfida (host)
  hostConfig: null,                 // copia ricevuta dall'host (guest)
  challenge: null,                  // { total, difficulty, index, standings: Map, history: [] }
  round: null,                      // { index, game, params, startAt, scores: Map, participants, deadline }
};

let currentScreen = "home";
let statusEl = null;

// ---------------------------------------------------------------
// Utilità schermate
// ---------------------------------------------------------------

function show(...children) {
  app.replaceChildren(el("div", { class: "screen" }, children));
}

function statusLine(text = "", isError = false) {
  return el("div", { class: `status${isError ? " error" : ""}`, text });
}

function setStatus(text, isError = false) {
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.classList.toggle("error", isError);
  }
}

function difficultyLabel(id) {
  return DIFFICULTIES.find((d) => d.id === id)?.label || id;
}

function isSolo() {
  return state.net?.code === null;
}

function makeNet() {
  return new Net({
    onPlayers: () => {
      if (state.net?.isHost) {
        broadcastConfig();
        checkRoundComplete();
      }
      if (currentScreen === "lobby") showLobby();
    },
    onMessage: handleMessage,
    onStatus: (text) => setStatus(text),
    onDisconnected: () => {
      leaveRoom();
      showHome("La stanza è stata chiusa.");
    },
  });
}

function leaveRoom() {
  state.round?.game.unmount();
  clearTimeout(state.round?.deadline);
  state.net?.leave();
  state.net = null;
  state.round = null;
  state.challenge = null;
  state.hostConfig = null;
}

// ---------------------------------------------------------------
// HOME
// ---------------------------------------------------------------

function showHome(message = "") {
  currentScreen = "home";
  const nameInput = el("input", {
    type: "text",
    maxlength: "16",
    placeholder: "Il tuo nome",
    value: state.name,
    autocomplete: "off",
  });
  nameInput.addEventListener("input", () => {
    state.name = nameInput.value.trim();
    localStorage.setItem("name", state.name);
  });

  const requireName = () => {
    if (!state.name) {
      setStatus("Scrivi prima il tuo nome!", true);
      nameInput.focus();
      return false;
    }
    return true;
  };

  statusEl = statusLine(message, !!message);

  show(
    el("h1", { text: "CELLCITTINE" }),
    el("p", { text: "Sfide a minigiochi, da soli o in gruppo" }),
    el("div", { class: "card" }, [
      nameInput,
      el("button", { text: "Crea una stanza", onclick: () => requireName() && createRoom() }),
      el("button", { text: "Entra con un codice", class: "secondary", onclick: () => requireName() && showJoin() }),
      el("button", { text: "Allenamento", class: "secondary", onclick: () => requireName() && playSolo() }),
    ]),
    el("button", { text: "I miei record", class: "link", onclick: showRecords }),
    statusEl
  );
}

function showRecords() {
  currentScreen = "records";
  const rows = [];
  for (const game of GAMES) {
    const cells = DIFFICULTIES.map((d) => {
      const r = getRecord(game.id, d.id);
      return el("span", { class: "rec-cell", text: r === null ? "—" : game.formatScore(r) });
    });
    rows.push(el("div", { class: "rec-row" }, [el("span", { class: "rec-name", text: `${game.icon} ${game.title}` }), ...cells]));
  }
  show(
    el("h2", { text: "I miei record" }),
    el("div", { class: "card" }, [
      el("div", { class: "rec-row rec-head" }, [
        el("span", { class: "rec-name", text: "" }),
        ...DIFFICULTIES.map((d) => el("span", { class: "rec-cell", text: d.label })),
      ]),
      ...rows,
    ]),
    el("div", { class: "spacer" }),
    el("button", { text: "Indietro", class: "secondary", onclick: () => showHome() })
  );
}

// ---------------------------------------------------------------
// CREA / ENTRA / ALLENAMENTO
// ---------------------------------------------------------------

async function createRoom() {
  setStatus("Apro la stanza…");
  state.net = makeNet();
  try {
    await state.net.host(state.name);
    showLobby();
  } catch (err) {
    leaveRoom();
    setStatus(err.message, true);
  }
}

function playSolo() {
  state.net = makeNet();
  state.net.solo(state.name);
  showLobby();
}

function showJoin() {
  currentScreen = "join";
  const codeInput = el("input", {
    type: "text",
    class: "code",
    maxlength: "4",
    placeholder: "CODICE",
    autocomplete: "off",
    autocapitalize: "characters",
  });
  statusEl = statusLine();

  const joinBtn = el("button", { text: "Entra" });
  joinBtn.addEventListener("click", async () => {
    const code = codeInput.value.trim().toUpperCase();
    if (code.length !== 4) {
      setStatus("Il codice ha 4 lettere.", true);
      return;
    }
    joinBtn.disabled = true;
    setStatus("Mi collego…");
    state.net = makeNet();
    try {
      await state.net.join(code, state.name);
      showLobby();
    } catch (err) {
      leaveRoom();
      joinBtn.disabled = false;
      setStatus(err.message, true);
    }
  });

  show(
    el("h2", { text: "Entra in una stanza" }),
    el("p", { text: "Chiedi il codice a chi ha creato la stanza" }),
    el("div", { class: "card" }, [codeInput, joinBtn]),
    statusEl,
    el("div", { class: "spacer" }),
    el("button", { text: "Indietro", class: "secondary", onclick: () => showHome() })
  );
  setTimeout(() => codeInput.focus(), 50);
}

// ---------------------------------------------------------------
// STANZA + CONFIGURAZIONE SFIDA
// ---------------------------------------------------------------

function broadcastConfig() {
  state.net?.broadcast({ type: "config", config: state.config });
}

function updateConfig(patch) {
  state.config = { ...state.config, ...patch };
  saveConfig(state.config);
  broadcastConfig();
  showLobby();
}

function segmented(options, current, onPick) {
  return el(
    "div",
    { class: "segmented" },
    options.map((o) =>
      el("button", {
        class: `seg${o.id === current ? " active" : ""}`,
        text: o.label,
        onclick: () => onPick(o.id),
      })
    )
  );
}

function configPanel() {
  const cfg = state.config;
  const chips = GAMES.map((g) => {
    const on = cfg.games.includes(g.id);
    return el("button", {
      class: `chip${on ? " on" : ""}`,
      text: `${g.icon} ${g.title}`,
      onclick: () => {
        const games = on ? cfg.games.filter((id) => id !== g.id) : [...cfg.games, g.id];
        updateConfig({ games });
      },
    });
  });

  const allOn = cfg.games.length === ALL_GAME_IDS.length;
  const quick = el("div", { class: "chips quick" }, [
    el("button", {
      class: `chip small${allOn ? " on" : ""}`,
      text: "✓ Tutti",
      onclick: () => updateConfig({ games: [...ALL_GAME_IDS] }),
    }),
    el("button", {
      class: `chip small${cfg.games.length === 0 ? " on" : ""}`,
      text: "✕ Nessuno",
      onclick: () => updateConfig({ games: [] }),
    }),
  ]);

  return el("div", { class: "card" }, [
    el("h2", { text: "La sfida" }),
    el("div", { class: "label", text: `Minigiochi (${cfg.games.length} di ${ALL_GAME_IDS.length})` }),
    quick,
    el("div", { class: "chips" }, chips),
    el("div", { class: "label", text: "Manche" }),
    segmented(
      ROUND_OPTIONS.map((n) => ({ id: n, label: n === "tutti" ? "Tutti" : String(n) })),
      cfg.rounds,
      (rounds) => updateConfig({ rounds })
    ),
    el("div", { class: "label", text: "Difficoltà" }),
    segmented(DIFFICULTIES, cfg.difficulty, (difficulty) => updateConfig({ difficulty })),
  ]);
}

function roundsLabel(cfg) {
  return cfg.rounds === "tutti" ? `${cfg.games.length} manche (tutti i minigiochi)` : `${cfg.rounds} manche`;
}

function configSummary(cfg) {
  const names = cfg.games.map((id) => getGame(id)?.title).filter(Boolean);
  return el("div", { class: "card" }, [
    el("h2", { text: "La sfida" }),
    el("p", { text: `${roundsLabel(cfg)} · ${difficultyLabel(cfg.difficulty)}` }),
    el("p", { class: "small", text: names.join(" · ") }),
  ]);
}

function playersList(players, meId) {
  return el(
    "ul",
    { class: "players" },
    players.map((p) =>
      el("li", { class: p.id === meId ? "me" : "" }, [
        el("span", { text: p.name }),
        el("span", { class: "tag", text: p.isHost ? "host" : "" }),
      ])
    )
  );
}

function showLobby() {
  currentScreen = "lobby";
  const net = state.net;
  const solo = isSolo();
  statusEl = statusLine();

  const header = solo
    ? [el("h2", { text: "Allenamento" }), el("p", { text: "Da soli, contro i tuoi record" })]
    : [
        el("p", { text: "Codice della stanza" }),
        el("div", { class: "code-big", text: net.code }),
        el("p", { text: "Chi vuole entrare tocca “Entra con un codice”" }),
      ];

  const parts = [...header];

  if (!solo) {
    parts.push(
      el("div", { class: "card" }, [
        el("h2", { text: `In stanza (${net.players.length})` }),
        playersList(net.players, net.me.id),
      ])
    );
  }

  if (net.isHost) {
    parts.push(configPanel());
    const startBtn = el("button", { text: solo ? "Inizia!" : "Inizia la sfida!", onclick: startChallenge });
    startBtn.disabled = state.config.games.length === 0;
    parts.push(startBtn);
    if (state.config.games.length === 0) parts.push(el("p", { class: "small", text: "Scegli almeno un minigioco" }));
  } else {
    if (state.hostConfig) parts.push(configSummary(state.hostConfig));
    parts.push(el("p", { text: "Aspetta che l'host faccia partire la sfida…" }));
  }

  show(
    ...parts,
    statusEl,
    el("div", { class: "spacer" }),
    el("button", {
      text: "Esci",
      class: "secondary",
      onclick: () => {
        leaveRoom();
        showHome();
      },
    })
  );
}

// ---------------------------------------------------------------
// SFIDA: avvio e manche (host)
// ---------------------------------------------------------------

function startChallenge() {
  const cfg = state.config;
  const rng = seededRandom(Math.floor(Math.random() * 2 ** 31));

  // "Tutti": ogni minigioco scelto una volta, in ordine casuale.
  // Altrimenti: cicla su quelli scelti, mescolati, evitando ripetizioni vicine.
  const total = cfg.rounds === "tutti" ? cfg.games.length : cfg.rounds;
  const rounds = [];
  let pool = [];
  while (rounds.length < total) {
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
    history: [],
  };
  nextRound();
}

function nextRound() {
  const ch = state.challenge;
  const net = state.net;
  ch.index++;
  const r = ch.rounds[ch.index];
  const startAt = net.now() + 3500;
  const msg = {
    type: "start",
    index: ch.index,
    total: ch.total,
    gameId: r.gameId,
    seed: r.seed,
    difficulty: ch.difficulty,
    startAt,
  };
  net.broadcast(msg);
  beginRound(msg);
}

// ---------------------------------------------------------------
// MANCHE: comune a host e guest
// ---------------------------------------------------------------

function beginRound(msg) {
  const game = getGame(msg.gameId);
  if (!game) return;
  const net = state.net;

  // Un guest arrivato a sfida iniziata crea la propria vista della sfida qui.
  if (!net.isHost && (!state.challenge || msg.index === 0)) {
    state.challenge = { total: msg.total, difficulty: msg.difficulty, index: msg.index, standings: new Map(), history: [] };
  }
  state.challenge.index = msg.index;

  const params = game.createParams(seededRandom(msg.seed), msg.difficulty);
  state.round = {
    index: msg.index,
    game,
    params,
    startAt: msg.startAt,
    scores: new Map(),
    participants: net.players.map((p) => p.id),
    deadline: null,
  };
  showCountdown(game, msg);
}

function showCountdown(game, msg) {
  currentScreen = "countdown";
  const net = state.net;
  const number = el("div", { class: "big", text: "" });
  const area = el("div", { class: "game-area" }, [
    el("div", { class: "hint", text: `Manche ${msg.index + 1} di ${msg.total} · ${difficultyLabel(msg.difficulty)}` }),
    el("div", { text: `${game.icon} ${game.title}` }),
    el("div", { class: "hint", text: game.description }),
    number,
  ]);
  app.replaceChildren(area);

  const tick = () => {
    if (state.round?.index !== msg.index) return; // manche annullata
    const remaining = msg.startAt - net.now();
    if (remaining <= 0) {
      area.remove();
      mountGame();
      return;
    }
    number.textContent = Math.ceil(remaining / 1000);
    setTimeout(tick, Math.min(100, remaining));
  };
  tick();
}

function mountGame() {
  currentScreen = "game";
  const round = state.round;
  const net = state.net;

  if (net.isHost) {
    // Scadenza di sicurezza: se qualcuno non risponde, si chiude comunque.
    round.deadline = setTimeout(publishResults, (round.game.maxSeconds + 8) * 1000);
  }

  round.game.mount(app, {
    params: round.params,
    difficulty: state.challenge.difficulty,
    me: net.me,
    now: () => net.now(),
    onFinish: (score) => submitScore(score),
  });
}

function submitScore(score) {
  const net = state.net;
  const round = state.round;
  if (!round) return;
  round.myScore = score;
  round.isRecord = updateRecord(round.game, state.challenge.difficulty, score);

  if (net.isHost) {
    recordScore(net.me.id, score);
  } else {
    net.sendToHost({ type: "result", index: round.index, score });
  }
}

// ---------------------------------------------------------------
// MANCHE: raccolta punteggi e classifiche (host)
// ---------------------------------------------------------------

function recordScore(playerId, score) {
  const round = state.round;
  if (!round || round.scores.has(playerId)) return;
  round.scores.set(playerId, score);
  checkRoundComplete();
}

function checkRoundComplete() {
  const round = state.round;
  if (!round || !state.net?.isHost || currentScreen === "results") return;
  const present = new Set(state.net.players.map((p) => p.id));
  const waiting = round.participants.filter((id) => present.has(id) && !round.scores.has(id));
  if (waiting.length === 0 && round.scores.size > 0) publishResults();
}

function publishResults() {
  const round = state.round;
  const ch = state.challenge;
  const net = state.net;
  if (!round || currentScreen === "results") return;
  clearTimeout(round.deadline);

  const nameOf = (id) => net.players.find((p) => p.id === id)?.name || ch.standings.get(id)?.name || "?";
  const order = round.game.order;

  const ranking = round.participants
    .map((id) => ({ id, name: nameOf(id), score: round.scores.has(id) ? round.scores.get(id) : null }))
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
    const entry = ch.standings.get(r.id) || { name: r.name, points: 0 };
    entry.name = r.name;
    entry.points += r.points;
    ch.standings.set(r.id, entry);
  }
  ch.history.push({ gameId: round.game.id, ranking });

  const msg = {
    type: "results",
    index: round.index,
    gameId: round.game.id,
    ranking,
    standings: standingsArray(),
    last: round.index === ch.total - 1,
  };
  net.broadcast(msg);
  showResults(msg);
}

function standingsArray() {
  return [...state.challenge.standings.entries()]
    .map(([id, e]) => ({ id, name: e.name, points: e.points }))
    .sort((a, b) => b.points - a.points);
}

// ---------------------------------------------------------------
// RISULTATI E PODIO
// ---------------------------------------------------------------

function showResults(msg) {
  currentScreen = "results";
  const game = getGame(msg.gameId);
  const net = state.net;
  const round = state.round;
  round?.game.unmount();

  if (!net.isHost && state.challenge) {
    state.challenge.standings = new Map(msg.standings.map((s) => [s.id, { name: s.name, points: s.points }]));
    state.challenge.history.push({ gameId: msg.gameId, ranking: msg.ranking });
  }

  const solo = isSolo();
  const meId = net.me.id;

  const roundList = el(
    "ol",
    { class: "ranking" },
    msg.ranking.map((r, i) =>
      el("li", { class: r.id === meId ? "me" : "" }, [
        el("span", { class: "pos", text: solo ? "" : i === 0 ? "🏆" : String(i + 1) }),
        el("span", {}, [
          el("span", { text: r.name }),
          r.id === meId && round?.isRecord ? el("span", { class: "badge", text: "★ record" }) : el("span"),
        ]),
        el("span", { class: "score", text: r.score === null ? "—" : game.formatScore(r.score) }),
        solo ? el("span") : el("span", { class: "pts", text: `+${r.points}` }),
      ])
    )
  );

  const cards = [el("div", { class: "card" }, [el("h2", { text: `${game.icon} ${game.title}` }), roundList])];

  if (solo) {
    const rec = getRecord(game.id, state.challenge.difficulty);
    cards.push(el("p", { text: rec === null ? "" : `Il tuo record: ${game.formatScore(rec)}` }));
  } else {
    cards.push(el("div", { class: "card" }, [el("h2", { text: "Classifica generale" }), standingsList(msg.standings, meId)]));
  }

  const actions = net.isHost
    ? [el("button", { text: msg.last ? "Vedi il risultato finale" : "Prossima manche", onclick: () => (msg.last ? finishChallenge() : nextRound()) })]
    : [el("p", { text: "Aspetta l'host…" })];

  show(
    el("p", { text: `Manche ${msg.index + 1} di ${state.challenge.total}` }),
    ...cards,
    ...actions,
    el("div", { class: "spacer" }),
    el("button", {
      text: "Abbandona",
      class: "link",
      onclick: () => {
        leaveRoom();
        showHome();
      },
    })
  );
}

function standingsList(standings, meId) {
  return el(
    "ol",
    { class: "ranking" },
    standings.map((s, i) =>
      el("li", { class: s.id === meId ? "me" : "" }, [
        el("span", { class: "pos", text: String(i + 1) }),
        el("span", { text: s.name }),
        el("span", { class: "score", text: `${s.points} pt` }),
      ])
    )
  );
}

function finishChallenge() {
  const msg = { type: "final", standings: standingsArray() };
  state.net.broadcast(msg);
  showFinal(msg);
}

function showFinal(msg) {
  currentScreen = "final";
  const net = state.net;
  const ch = state.challenge;
  const solo = isSolo();
  const meId = net.me.id;

  const parts = [];
  if (solo) {
    parts.push(el("h2", { text: "Allenamento completato!" }));
    parts.push(
      el("div", { class: "card" }, [
        el("ol", { class: "ranking" }, ch.history.map((h, i) => {
          const game = getGame(h.gameId);
          const mine = h.ranking.find((r) => r.id === meId);
          return el("li", {}, [
            el("span", { class: "pos", text: String(i + 1) }),
            el("span", { text: `${game.icon} ${game.title}` }),
            el("span", { class: "score", text: mine?.score === null || mine?.score === undefined ? "—" : game.formatScore(mine.score) }),
          ]);
        })),
      ])
    );
  } else {
    const winner = msg.standings[0];
    parts.push(el("h2", { text: "Fine della sfida!" }));
    parts.push(
      el("div", { class: "podium" }, [
        el("div", { class: "podium-trophy", text: "🏆" }),
        el("div", { class: "podium-name", text: winner?.name || "" }),
        el("div", { class: "hint", text: winner ? `${winner.points} punti` : "" }),
      ])
    );
    parts.push(el("div", { class: "card" }, [standingsList(msg.standings, meId)]));
  }

  const actions = net.isHost
    ? [
        el("button", {
          text: solo ? "Ricomincia" : "Nuova sfida",
          onclick: () => {
            state.challenge = null;
            state.round = null;
            net.broadcast({ type: "lobby" });
            showLobby();
          },
        }),
      ]
    : [el("p", { text: "Aspetta che l'host prepari una nuova sfida…" })];

  show(
    ...parts,
    ...actions,
    el("div", { class: "spacer" }),
    el("button", {
      text: "Esci",
      class: "secondary",
      onclick: () => {
        leaveRoom();
        showHome();
      },
    })
  );
}

// ---------------------------------------------------------------
// Messaggi ricevuti dalla rete
// ---------------------------------------------------------------

function handleMessage(msg, fromId) {
  const net = state.net;
  if (!net) return;

  if (net.isHost) {
    if (msg.type === "result" && msg.index === state.round?.index) recordScore(fromId, msg.score);
    return;
  }

  switch (msg.type) {
    case "config":
      state.hostConfig = msg.config;
      if (currentScreen === "lobby") showLobby();
      break;
    case "start":
      state.round?.game.unmount();
      beginRound(msg);
      break;
    case "results":
      showResults(msg);
      break;
    case "final":
      showFinal(msg);
      break;
    case "lobby":
      state.challenge = null;
      state.round = null;
      showLobby();
      break;
  }
}

// ---------------------------------------------------------------
// Avvio
// ---------------------------------------------------------------

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

showHome();
