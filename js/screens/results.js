/*
  Risultati di una manche (classifica della manche + generale, prestazione
  personale) e podio finale (o riepilogo dell'allenamento).
*/

import { el } from "../utils.js";
import { sfx } from "../audio.js";
import { state, setScreen, isSolo } from "../state.js";
import { show, gameIcon, gameHeading, confetti } from "../ui.js";
import { getEntry, loadGame, getLoaded } from "../games/catalog.js";
import { getRecord } from "../storage.js";
import { leaveRoom, exitButton } from "../room.js";
import { nextRound, finishChallenge } from "../challenge.js";
import { showHome } from "./home.js";
import { showLobby } from "./lobby.js";

// ---------------------------------------------------------------
// "La tua prestazione": dettaglio del minigioco e confronto col massimo, dove esiste.
// ---------------------------------------------------------------

function performanceText(game, score, max, detail) {
  const parts = [];
  if (detail) parts.push(detail);
  if (max && score !== null && score !== undefined && game.isValidScore(score)) {
    const pct = Math.round((Math.min(score, max) / max) * 100);
    parts.push(`${score} su ${max} (${pct}%)`);
  }
  return parts.join(" · ");
}

function performanceLine(game, round) {
  if (!round || round.myScore === undefined) return el("span");
  const text = performanceText(game, round.myScore, round.myMax, round.myDetail);
  if (!text) return el("span");
  return el("div", { class: "perf" }, [el("span", { class: "perf-label", text: "La tua prestazione" }), el("span", { text })]);
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

// ---------------------------------------------------------------
// Manche automatiche: conto alla rovescia dopo i risultati
// ---------------------------------------------------------------

let autoTimer = null;

function stopAuto() {
  clearInterval(autoTimer);
  autoTimer = null;
}

// Aggiorna `onTick(rimanenti)` ogni secondo e chiama `onDone` a zero.
// Si ferma da solo se nel frattempo si è cambiata schermata o manche.
function startAuto(seconds, roundIndex, onTick, onDone) {
  stopAuto();
  let left = seconds;
  onTick(left);
  autoTimer = setInterval(() => {
    if (state.screen !== "results" || state.round?.index !== roundIndex || !state.net) { stopAuto(); return; }
    left--;
    if (left <= 0) { stopAuto(); onDone(); return; }
    onTick(left);
  }, 1000);
}

// ---------------------------------------------------------------
// Fine manche
// ---------------------------------------------------------------

export async function showResults(msg) {
  setScreen("results");
  const net = state.net;
  const round = state.round;
  round?.game?.unmount();

  const game = round?.game?.id === msg.gameId ? round.game : await loadGame(msg.gameId);
  if (!state.net) return;

  if (!net.isHost && state.challenge) {
    state.challenge.standings = new Map(msg.standings.map((s) => [s.id, { name: s.name, points: s.points }]));
    state.challenge.history.push({ gameId: msg.gameId, ranking: msg.ranking });
  }
  const last = state.challenge?.history[state.challenge.history.length - 1];
  if (last && round) { last.myDetail = round.myDetail; last.myMax = round.myMax; last.myScore = round.myScore; }

  const solo = isSolo();
  const meId = net.me.id;
  sfx.play(round?.isRecord ? "record" : "roundEnd");

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

  const cards = [el("div", { class: "card" }, [gameHeading(game), roundList, performanceLine(game, round)])];

  if (solo) {
    const rec = getRecord(game.id, state.challenge.difficulty);
    cards.push(el("p", { text: rec ? `Il tuo record: ${rec.text}` : "" }));
  } else {
    cards.push(el("div", { class: "card" }, [el("h2", { text: "Classifica generale" }), standingsList(msg.standings, meId)]));
  }

  const actions = [];
  const cfg = net.isHost ? state.config : state.hostConfig;
  if (net.isHost) {
    const label = msg.last ? "Vedi il risultato finale" : "Prossima manche";
    const advance = () => { stopAuto(); msg.last ? finishChallenge() : nextRound(); };
    const btn = el("button", { text: label, onclick: advance });
    actions.push(btn);
    if (cfg?.auto) {
      const hold = el("button", { text: "Aspetta, non ancora", class: "link", onclick: () => { stopAuto(); btn.textContent = label; hold.remove(); } });
      actions.push(hold);
      startAuto(cfg.autoDelay, msg.index, (n) => { btn.textContent = `${label} · ${n} s`; }, advance);
    }
  } else if (cfg?.auto) {
    const p = el("p", { text: "" });
    actions.push(p);
    startAuto(cfg.autoDelay, msg.index, (n) => { p.textContent = `${msg.last ? "Risultato finale" : "Prossima manche"} fra ${n} s…`; }, () => { p.textContent = "Aspetta l'host…"; });
  } else {
    actions.push(el("p", { text: "Aspetta l'host…" }));
  }

  show(
    el("p", { text: `Manche ${msg.index + 1} di ${state.challenge.total}` }),
    ...cards,
    ...actions,
    el("div", { class: "spacer" }),
    el("button", { text: "Abbandona", class: "link", onclick: () => { leaveRoom(); showHome(); } })
  );
}

// ---------------------------------------------------------------
// Podio finale / riepilogo dell'allenamento
// ---------------------------------------------------------------

export function showFinal(msg) {
  setScreen("final");
  sfx.play("fanfare");
  if (!isSolo() || (state.challenge?.history.length || 0) > 0) confetti();
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
          const entry = getEntry(h.gameId);
          const mine = h.ranking.find((r) => r.id === meId);
          const game = getLoaded(h.gameId);
          const text = mine?.score === null || mine?.score === undefined ? "—" : game ? game.formatScore(mine.score) : String(mine.score);
          const perf = game ? performanceText(game, h.myScore, h.myMax, h.myDetail) : "";
          return el("li", { class: perf ? "with-perf" : "" }, [
            el("span", { class: "pos", text: String(i + 1) }),
            el("span", { class: "with-icon" }, [gameIcon(entry, "list-icon"), el("span", {}, [el("div", { text: entry?.title || h.gameId }), perf ? el("div", { class: "perf-small", text: perf }) : el("span")])]),
            el("span", { class: "score", text }),
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

  show(...parts, ...actions, el("div", { class: "spacer" }), exitButton());
}
