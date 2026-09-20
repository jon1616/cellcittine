/*
  App: il telaio del gioco.
  Gestisce le schermate (home, stanza, conto alla rovescia, minigioco,
  risultati) e il giro completo di una manche:
    host sceglie minigioco -> tutte partono allo stesso istante ->
    ognuna manda il punteggio all'host -> l'host pubblica la classifica.
*/

import { VERSION } from "./version.js";
import { Net } from "./net.js";
import { GAMES, getGame } from "./games/registry.js";
import { el, seededRandom } from "./utils.js";

const app = document.getElementById("app");
document.getElementById("version").textContent = `v${VERSION}`;

const state = {
  net: null,
  name: localStorage.getItem("name") || "",
  round: null, // { game, params, startAt, scores: Map }
};

// ---------------------------------------------------------------
// Utilità schermate
// ---------------------------------------------------------------

function show(...children) {
  app.replaceChildren(el("div", { class: "screen" }, children));
}

function statusLine(text = "", isError = false) {
  return el("div", { class: `status${isError ? " error" : ""}`, text });
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

function makeNet() {
  return new Net({
    onPlayers: () => {
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

let currentScreen = "home";
let statusEl = null;
function setStatus(text, isError = false) {
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.classList.toggle("error", isError);
  }
}

function leaveRoom() {
  state.net?.leave();
  state.net = null;
  state.round = null;
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
    el("h1", { text: "Cellcittine" }),
    el("p", { text: "Minigiochi per giocare insieme" }),
    el("div", { class: "card" }, [
      nameInput,
      el("button", { text: "Crea una stanza", onclick: () => requireName() && createRoom() }),
      el("button", { text: "Entra con un codice", class: "secondary", onclick: () => requireName() && showJoin() }),
      el("button", { text: "Gioca da sola", class: "secondary", onclick: () => requireName() && playSolo() }),
    ]),
    statusEl
  );
}

// ---------------------------------------------------------------
// CREA / ENTRA
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
    el("button", { text: "Indietro", class: "secondary", onclick: showHome })
  );
  setTimeout(() => codeInput.focus(), 50);
}

// ---------------------------------------------------------------
// STANZA
// ---------------------------------------------------------------

function showLobby() {
  currentScreen = "lobby";
  const net = state.net;
  const isSolo = net.code === null;
  statusEl = statusLine();

  const header = isSolo
    ? [el("h2", { text: "Da sola" }), el("p", { text: "Allenati e batti i tuoi record" })]
    : [
        el("p", { text: "Codice della stanza" }),
        el("div", { class: "code-big", text: net.code }),
        el("p", { text: "Dillo alle amiche: loro toccano “Entra con un codice”" }),
      ];

  const actions = [];
  if (net.isHost) {
    actions.push(el("button", { text: isSolo ? "Gioca!" : "Inizia la partita!", onclick: startRound }));
  } else {
    actions.push(el("p", { text: "Aspetta che l'host faccia partire il gioco…" }));
  }

  show(
    ...header,
    el("div", { class: "card" }, [
      el("h2", { text: isSolo ? "" : `Giocatrici (${net.players.length})` }),
      playersList(net.players, net.me.id),
      ...actions,
    ]),
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
// MANCHE: avvio (solo host)
// ---------------------------------------------------------------

function startRound() {
  const net = state.net;
  const game = GAMES[Math.floor(Math.random() * GAMES.length)];
  const seed = Math.floor(Math.random() * 2 ** 31);
  const startAt = net.now() + 3500;

  net.broadcast({ type: "start", gameId: game.id, seed, startAt });
  beginRound(game.id, seed, startAt);
}

// Comune a host e guest.
function beginRound(gameId, seed, startAt) {
  const game = getGame(gameId);
  if (!game) return;
  const params = game.createParams(seededRandom(seed));
  state.round = { game, params, startAt, scores: new Map() };
  showCountdown(game, startAt);
}

function showCountdown(game, startAt) {
  currentScreen = "countdown";
  const net = state.net;
  const number = el("div", { class: "big", text: "" });
  const area = el("div", { class: "game-area" }, [
    el("div", { text: game.title }),
    el("div", { class: "hint", text: game.description }),
    number,
  ]);
  app.replaceChildren(area);

  const tick = () => {
    const remaining = startAt - net.now();
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
  const { game, params } = state.round;
  const net = state.net;
  game.mount(app, {
    params,
    me: net.me,
    players: net.players,
    now: () => net.now(),
    onFinish: (score) => submitScore(score),
  });
}

// ---------------------------------------------------------------
// MANCHE: punteggi e classifica
// ---------------------------------------------------------------

function submitScore(score) {
  const net = state.net;
  if (net.isHost) {
    recordScore(net.me.id, score);
  } else {
    net.sendToHost({ type: "result", score });
  }
}

// Solo host: raccoglie i punteggi; quando ci sono tutti (o scade il tempo) pubblica.
function recordScore(playerId, score) {
  const round = state.round;
  if (!round) return;
  round.scores.set(playerId, score);

  const everyone = state.net.players.every((p) => round.scores.has(p.id));
  if (everyone) {
    publishResults();
  } else if (!round.deadline) {
    round.deadline = setTimeout(publishResults, 10000);
  }
}

function publishResults() {
  const round = state.round;
  if (!round) return;
  clearTimeout(round.deadline);

  const ranking = state.net.players
    .map((p) => ({ name: p.name, score: round.scores.has(p.id) ? round.scores.get(p.id) : null }))
    .sort((a, b) => {
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return round.game.order === "asc" ? a.score - b.score : b.score - a.score;
    });

  state.net.broadcast({ type: "results", gameId: round.game.id, ranking });
  showResults(round.game.id, ranking);
}

function showResults(gameId, ranking) {
  currentScreen = "results";
  const game = getGame(gameId);
  const net = state.net;
  state.round?.game.unmount();
  state.round = null;

  const list = el(
    "ol",
    { class: "ranking" },
    ranking.map((r, i) =>
      el("li", {}, [
        el("span", { class: "pos", text: i === 0 ? "🏆" : String(i + 1) }),
        el("span", { text: r.name }),
        el("span", { class: "score", text: r.score === null ? "—" : game.formatScore(r.score) }),
      ])
    )
  );

  const actions = net.isHost
    ? [
        el("button", { text: "Un'altra!", onclick: startRound }),
        el("button", {
          text: "Torna alla stanza",
          class: "secondary",
          onclick: () => {
            net.broadcast({ type: "lobby" });
            showLobby();
          },
        }),
      ]
    : [el("p", { text: "Aspetta che l'host scelga cosa fare…" })];

  show(
    el("h2", { text: game.title }),
    el("p", { text: "Classifica" }),
    el("div", { class: "card" }, [list, ...actions])
  );
}

// ---------------------------------------------------------------
// Messaggi ricevuti dalla rete
// ---------------------------------------------------------------

function handleMessage(msg, fromId) {
  const net = state.net;
  if (!net) return;

  if (net.isHost) {
    if (msg.type === "result") recordScore(fromId, msg.score);
    return;
  }

  switch (msg.type) {
    case "start":
      beginRound(msg.gameId, msg.seed, msg.startAt);
      break;
    case "results":
      showResults(msg.gameId, msg.ranking);
      break;
    case "lobby":
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
