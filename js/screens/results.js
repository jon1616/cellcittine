/*
  Risultati di una manche (classifica della manche + generale, prestazione
  personale) e podio finale (o riepilogo dell'allenamento).
*/

import { el } from "../utils.js";
import { sfx } from "../audio.js";
import { state, setScreen, isSolo } from "../state.js";
import { show, gameIcon, gameHeading, confetti, colorDot, playerColor } from "../ui.js";
import { getEntry, loadGame, getLoaded } from "../games/catalog.js";
import { getRecord, addHistoryEntry } from "../storage.js";
import { leaveRoom, exitButton } from "../room.js";
import { nextRound, finishChallenge, replayChallenge, closeChampionship, react, REACTIONS } from "../challenge.js";
import { showLobby as showLobbyScreen, championshipTable } from "./lobby.js";
import { showCatalog, showGameInfo } from "./catalog.js";
import { showHome } from "./home.js";
import { showLobby } from "./lobby.js";
import { teamInfo, formatAvg } from "../teams.js";
import { ratingOf, ratingBar, ratingLabel } from "../rating.js";
import { SPECIALS } from "../specials.js";
import { positionsAfter } from "../awards.js";
import { recordRound, checkAchievements } from "../stats.js";
import { toast } from "../ui.js";
import { commentRound, commentSolo } from "../commentary.js";
import { DAILY_ROUNDS, DAILY_ROUND_MAX, dailyLabel, formatPoints, todayResult, recordDaily, dailyStreak, shareText } from "../daily.js";

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

// Squadre: pillola colorata col nome
function teamLabel(team, full = false) {
  const t = teamInfo(team);
  return el("span", { class: "team-pill", text: full ? t?.name || "?" : t?.short || "?", style: `--t: ${t?.color || "#888"}` });
}

// Classifica delle squadre nella manche (media dei membri) e generale
function teamsCard(teamRanking, teamStandings, myTeam) {
  const n = (teamRanking || []).length;
  const roundList = el("ol", { class: "ranking teams" }, (teamRanking || []).map((t) => {
    const pos = n - t.points + 1; // a pari media, pari posizione
    return el("li", { class: t.team === myTeam ? "me" : "" }, [
      el("span", { class: "pos", text: pos === 1 ? "🏆" : String(pos) }),
      el("span", { class: "who" }, [teamLabel(t.team, true)]),
      el("span", { class: "score", text: `${t.sum ? "somma" : "media"} ${formatAvg(t.avg)}` }),
      el("span", { class: "pts", text: `+${t.points}` }),
    ]);
  }));
  const general = el("ol", { class: "ranking teams" }, (teamStandings || []).map((t, i) =>
    el("li", { class: t.team === myTeam ? "me" : "" }, [
      el("span", { class: "pos", text: String(i + 1) }),
      el("span", { class: "who" }, [teamLabel(t.team, true)]),
      el("span", { class: "score", text: `${t.points} pt` }),
    ])
  ));
  return el("div", { class: "card" }, [el("h2", { text: "Squadre" }), roundList, el("div", { class: "label", text: "Classifica squadre" }), general]);
}

// prev (facoltativo): Map id -> { pos, points } prima dell'ultima manche, per frecce e conteggio animato
function standingsList(standings, meId, prev = null) {
  const list = el(
    "ol",
    { class: `ranking${prev ? " animated" : ""}` },
    standings.map((s, i) => {
      const p = prev?.get(s.id);
      const delta = p ? p.pos - (i + 1) : 0;
      const arrow = !p ? el("span") : el("span", { class: `delta ${delta > 0 ? "up" : delta < 0 ? "down" : "same"}`, text: delta > 0 ? `▲${delta}` : delta < 0 ? `▼${-delta}` : "=" });
      const score = el("span", { class: "score", text: `${p ? p.points : s.points} pt` });
      if (p && p.points !== s.points) countUp(score, p.points, s.points);
      const out = s.out !== null && s.out !== undefined;
      return el("li", { class: `${s.id === meId ? "me" : ""}${out ? " out" : ""}`, style: `--i: ${i}`, "data-id": s.id }, [
        el("span", { class: "pos", text: out ? "💀" : String(i + 1) }),
        el("span", { class: "who" }, [colorDot(s.color), el("span", { text: s.name }), out ? el("span", { class: "out-tag", text: `fuori alla ${s.out + 1}ª` }) : arrow]),
        score,
      ]);
    })
  );
  return list;
}

// Numero che sale da `from` a `to` in 800 ms (parte dopo che la riga è comparsa)
function countUp(node, from, to) {
  const t0 = performance.now() + 350;
  const tick = () => {
    if (!node.isConnected) return;
    const k = Math.min(1, Math.max(0, (performance.now() - t0) / 800));
    const v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    node.textContent = `${v} pt`;
    if (k < 1) requestAnimationFrame(tick); else node.classList.add("bumped");
  };
  requestAnimationFrame(tick);
}

// Posizioni e punti prima dell'ultima manche (da tutti, senza rete)
function previousStandings(history, standings) {
  if (history.length < 2) return null;
  const ids = standings.map((s) => s.id);
  const pos = positionsAfter(history, history.length - 1, ids);
  const pts = new Map(ids.map((id) => [id, 0]));
  for (const h of history.slice(0, -1)) for (const r of h.ranking) pts.set(r.id, (pts.get(r.id) || 0) + (r.points || 0));
  return new Map(ids.map((id) => [id, { pos: pos.get(id) || ids.length, points: pts.get(id) || 0 }]));
}

// Il commentatore: una o due frasi in un fumetto
function commentaryCard(lines) {
  if (!lines?.length) return el("span");
  return el("div", { class: "commentary" }, lines.map((l, i) =>
    el("div", { class: `comment${l.mine ? " mine" : ""}`, style: `--i: ${i}` }, [el("span", { class: "comment-icon", text: l.icon }), el("span", { text: l.text })])
  ));
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
    state.challenge.standings = new Map(msg.standings.map((s) => [s.id, { name: s.name, color: s.color, points: s.points }]));
    state.challenge.history.push({ gameId: msg.gameId, ranking: msg.ranking, special: msg.special || null, eliminated: (msg.eliminated || []).map((e) => e.id) });
  }
  const last = state.challenge?.history[state.challenge.history.length - 1];
  if (last && round) { last.myDetail = round.myDetail; last.myMax = round.myMax; last.myScore = round.myScore; last.myParams = round.params; }

  const solo = isSolo();
  const meId = net.me.id;
  sfx.play(round?.isRecord ? "record" : "roundEnd");
  const ch = state.challenge;
  // Statistiche personali: questa manche
  if (round && round.myScore !== undefined) {
    const best = msg.ranking.find((r) => r.score !== null && r.score !== undefined);
    const mine = msg.ranking.find((r) => r.id === meId);
    recordRound(msg.gameId, { pct: ratingOf(game, round.myScore, round.params), won: !solo && !!mine && !!best && mine.score === best.score, solo, seconds: getEntry(msg.gameId)?.duration || 0 });
  }
  const prev = solo ? null : previousStandings(ch.history, msg.standings);
  const cfg0 = net.isHost ? state.config : state.hostConfig;
  const lines = solo
    ? [commentSolo({ game, score: round?.myScore, record: getRecord(game.id, round?.difficulty || msg.difficulty), isRecord: round?.isRecord, pct: ratingOf(game, round?.myScore, round?.params) })].filter(Boolean)
    : commentRound({ history: ch.history, standings: msg.standings, meId, total: ch.total, hasSpecials: !!cfg0?.special, eliminated: msg.eliminated || [], alive: msg.alive });
  if (!solo && lines.some((l) => l.mine) && !round?.isRecord) setTimeout(() => sfx.play("cheer"), 500);

  const roundList = el(
    "ol",
    { class: `ranking${solo ? "" : " reveal"}` },
    msg.ranking.map((r, i) =>
      el("li", { class: `${r.id === meId ? "me" : ""}${r.out ? " out" : ""}${r.eliminatedNow ? " eliminated" : ""}`, style: `--i: ${i}`, "data-id": r.id }, [
        el("span", { class: "pos", text: solo ? "" : r.out ? "💀" : r.eliminatedNow ? "❌" : i === 0 ? "🏆" : String(i + 1) }),
        el("span", { class: "who" }, [
          solo ? el("span") : colorDot(r.color),
          el("span", { text: r.name }),
          r.id === meId && round?.isRecord ? el("span", { class: "badge", text: "★ record" }) : el("span"),
          r.eliminatedNow ? el("span", { class: "out-tag", text: "eliminato" }) : el("span"),
        ]),
        el("span", { class: "score", text: r.score === null ? "—" : game.formatScore(r.score) }),
        solo ? el("span") : el("span", { class: "pts", text: r.out ? "" : `+${r.points}` }),
      ])
    )
  );

  const cards = [el("div", { class: "card" }, [gameHeading(game), roundList, performanceLine(game, round)])];

  if (solo) {
    const rec = getRecord(game.id, round?.difficulty || msg.difficulty);
    cards.push(el("p", { text: rec ? `Il tuo record: ${rec.text}` : "" }));
  } else {
    if (msg.teamRanking) {
      const myTeam = net.players.find((p) => p.id === meId)?.team;
      cards.push(teamsCard(msg.teamRanking, msg.teamStandings, myTeam));
    }
    cards.push(el("div", { class: "card" }, [el("h2", { text: msg.teamRanking ? "Classifica individuale" : "Classifica generale" }), standingsList(msg.standings, meId, prev)]));
  }
  cards.splice(1, 0, commentaryCard(lines));

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

  const special = msg.special ? SPECIALS[msg.special] : null;
  show(
    el("p", { text: `Manche ${msg.index + 1} di ${state.challenge.total}` }),
    special ? el("div", { class: "special-chip", text: specialText(special, msg) }) : el("span"),
    ...cards,
    ...actions,
    solo ? el("span") : reactionBar(),
    el("div", { class: "spacer" }),
    el("button", { text: "Abbandona", class: "link", onclick: () => { leaveRoom(); showHome(); } })
  );
}

// Testo della manche speciale nei risultati (il Duello dice chi ha vinto)
function specialText(special, msg) {
  if (special.id === "duello" && msg.specialOutcome) {
    const o = msg.specialOutcome;
    const name = (id) => msg.ranking.find((r) => r.id === id)?.name || "?";
    return o.winner ? `⚔️ Duello: ${name(o.winner)} batte ${name(o.loser)} (+${o.bonus})` : "⚔️ Duello in parità: niente punti extra";
  }
  return `${special.icon} ${special.label}`;
}

// Barra delle faccine (solo in gruppo)
function reactionBar() {
  let last = 0;
  return el("div", { class: "reactions" }, REACTIONS.map((e) => el("button", { class: "reaction", text: e, onclick: () => {
    const now = Date.now();
    if (now - last < 900) return;
    last = now;
    react(e);
  } })));
}

// Una faccina vola sul nome di chi l'ha mandata (riga con data-id), o in basso se non c'è
export function showReaction(id, emoji) {
  const rows = [...document.querySelectorAll(`[data-id="${CSS.escape(String(id))}"]`)];
  const target = rows.find((r) => r.closest(".ranking, .steps, .champ-table")) || rows[0];
  const host = target || document.querySelector(".reactions") || document.getElementById("app");
  if (!host) return;
  const fx = el("span", { class: "reaction-fly", text: emoji });
  fx.style.left = `${20 + Math.random() * 50}%`;
  host.style.position = host.style.position || "relative";
  host.append(fx);
  setTimeout(() => fx.remove(), 1400);
}

// Tre gradini per i primi tre (2º a sinistra, 1º al centro, 3º a destra)
function podiumSteps(standings, meId) {
  const top = standings.slice(0, 3);
  const order = [top[1], top[0], top[2]].filter(Boolean);
  const heights = { 0: 96, 1: 70, 2: 52 };
  return el("div", { class: "steps" }, order.map((s) => {
    const rank = standings.indexOf(s);
    return el("div", { class: `step${s.id === meId ? " me" : ""}`, style: `--c: ${playerColor(s.color)}; --h: ${heights[rank]}px; --i: ${rank}` }, [
      el("div", { class: "step-name", text: s.name }),
      el("div", { class: "step-block" }, [el("span", { class: "step-rank", text: String(rank + 1) }), el("span", { class: "step-pts", text: `${s.points} pt` })]),
    ]);
  }));
}

// Premi di fine sfida (calcolati dall'host, vedi awards.js)
function awardsCard(awards, meId) {
  return el("div", { class: "card" }, [
    el("h2", { text: "Premi" }),
    el("div", { class: "awards" }, awards.map((a, i) =>
      el("div", { class: `award${a.id === meId ? " me" : ""}`, style: `--i: ${i}` }, [
        el("span", { class: "award-icon", text: a.icon }),
        el("span", { class: "award-text" }, [
          el("span", { class: "award-title", text: a.title }),
          el("span", { class: "award-who" }, [colorDot(a.color), el("span", { text: a.name })]),
          el("span", { class: "award-why", text: a.text }),
        ]),
      ])
    )),
  ]);
}

// ---------------------------------------------------------------
// Sfida del giorno: punteggio in percentuale per manche, totale, condivisione
// ---------------------------------------------------------------

function dailyRounds(ch) {
  return ch.history.map((h) => {
    const game = getLoaded(h.gameId);
    const pct = ratingOf(game, h.myScore, h.myParams);
    return { gameId: h.gameId, score: h.myScore ?? null, pct, points: pct * (DAILY_ROUND_MAX / 100) };
  });
}

function dailyFinal(ch) {
  const key = ch.daily.key;
  const rounds = dailyRounds(ch);
  const total = rounds.reduce((s, r) => s + r.points, 0);
  const first = recordDaily(key, rounds); // vale solo il primo tentativo del giorno
  const official = todayResult(key);
  const streak = dailyStreak();
  const max = DAILY_ROUNDS * DAILY_ROUND_MAX;

  const rows = el("ol", { class: "ranking daily-rows" }, rounds.map((r, i) => {
    const entry = getEntry(r.gameId);
    const game = getLoaded(r.gameId);
    const text = r.score === null || r.score === undefined ? "—" : game ? game.formatScore(r.score) : String(r.score);
    return el("li", { style: `--i: ${i}` }, [
      el("span", { class: "with-icon" }, [gameIcon(entry, "list-icon"), el("span", {}, [el("div", { text: entry?.title || r.gameId }), el("div", { class: "perf-small", text: `${text} · ${ratingLabel(r.pct)}` })])]),
      el("span", { class: "daily-bar", text: ratingBar(r.pct) }),
      el("span", { class: "pts", text: `${formatPoints(r.points)}` }),
    ]);
  }));

  const share = el("button", { text: "📤 Condividi il risultato", class: "secondary small-btn" });
  share.addEventListener("click", async () => {
    const text = shareText(key, official || { total, rounds });
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch (_) { /* annullato: copia */ }
    }
    try { await navigator.clipboard.writeText(text); share.textContent = "Copiato! Incollalo in chat"; } catch (_) { share.textContent = "Non riesco a copiare"; }
    setTimeout(() => { share.textContent = "📤 Condividi il risultato"; }, 2000);
  });

  return [
    el("h2", { text: `Sfida del giorno · ${dailyLabel(key)}` }),
    el("div", { class: "podium daily" }, [
      el("div", { class: "podium-trophy", text: total >= max * 0.8 ? "🏆" : total >= max * 0.5 ? "🌟" : "📅" }),
      el("div", { class: "podium-name", text: `${formatPoints(total)} punti` }),
      el("div", { class: "hint", text: `su ${formatPoints(max)}${streak > 1 ? ` · 🔥 ${streak} giorni di fila` : ""}` }),
      first ? el("span") : el("p", { class: "small", text: official ? `Oggi vale il primo tentativo: ${formatPoints(official.total)} punti. Questo era allenamento.` : "" }),
    ]),
    el("div", { class: "card" }, [rows, share]),
  ];
}

// Sfida del giorno giocata in gruppo: il MIO totale (vale se è il primo tentativo di oggi)
function dailyGroupCard(ch) {
  const key = ch.daily.key;
  const rounds = dailyRounds(ch);
  if (!rounds.length) return el("span");
  const total = rounds.reduce((s, r) => s + r.points, 0);
  const first = recordDaily(key, rounds);
  const official = todayResult(key);
  const share = el("button", { text: "📤 Condividi il mio risultato", class: "secondary small-btn" });
  share.addEventListener("click", async () => {
    const text = shareText(key, official || { total, rounds });
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (_) { /* copia */ } }
    try { await navigator.clipboard.writeText(text); share.textContent = "Copiato!"; } catch (_) { share.textContent = "Non riesco a copiare"; }
    setTimeout(() => { share.textContent = "📤 Condividi il mio risultato"; }, 2000);
  });
  return el("div", { class: "card daily done" }, [
    el("div", { class: "daily-head" }, [el("span", { class: "daily-title", text: "📅 La tua Sfida del giorno" }), el("span", { class: "daily-date", text: dailyLabel(key) })]),
    el("div", { class: "daily-score", text: `${formatPoints(total)} punti` }),
    el("p", { class: "small", text: first ? `Registrata come la tua sfida di oggi (su ${formatPoints(DAILY_ROUNDS * DAILY_ROUND_MAX)}). ${rounds.map((r) => ratingBar(r.pct)).join(" ")}` : official ? `Oggi avevi già fatto la sfida: vale quella (${formatPoints(official.total)} punti). Questa era una prova.` : "" }),
    share,
  ]);
}

// ---------------------------------------------------------------
// Podio finale / riepilogo dell'allenamento
// ---------------------------------------------------------------

// Ricorda la sfida nello storico del telefono (ognuno salva la propria copia).
function rememberChallenge(msg) {
  const net = state.net;
  const ch = state.challenge;
  if (!net || !ch) return;
  const solo = isSolo();
  const meId = net.me.id;
  const players = solo
    ? [{ id: meId, name: net.me.name, color: 0, points: 0 }]
    : msg.standings.map((s) => ({ id: s.id, name: s.name, color: s.color, points: s.points }));
  addHistoryEntry({
    at: Date.now(),
    code: net.code,
    solo,
    daily: ch.daily?.key || null,
    championshipDay: msg.championship?.day || null,
    rounds: ch.history.length,
    difficulty: ch.difficulty,
    games: ch.history.map((h) => h.gameId),
    players,
    winnerId: solo ? null : players[0]?.id || null,
    awards: (msg.awards || []).map((a) => ({ icon: a.icon, title: a.title, name: a.name })),
    teams: msg.teamStandings?.length ? msg.teamStandings.map((t) => ({ team: t.team, points: t.points })) : null,
    meId,
  });
}

// Traguardi appena sbloccati: un avviso alla volta, dopo il podio
function announceAchievements() {
  const fresh = checkAchievements();
  fresh.forEach((a, i) => setTimeout(() => { toast(`🏅 Traguardo: ${a.icon} ${a.title}!`); sfx.play("cheer"); }, 1800 + i * 2600));
}

// Chiusura del campionato: il campione e la tabella finale
export function showChampion(msg) {
  setScreen("champion");
  sfx.play("fanfare");
  confetti(140);
  const net = state.net;
  const meId = net.me.id;
  const win = msg.table[0];
  const tied = msg.table.filter((r) => win && r.points === win.points && r.wins === win.wins);
  addHistoryEntry({
    at: Date.now(), code: net.code, solo: false, championship: true, days: msg.day, rounds: 0, difficulty: null, games: [],
    players: msg.table.map((r) => ({ id: r.id, name: r.name, color: r.color, points: r.points })),
    winnerId: tied.length === 1 ? win.id : null, awards: [], teams: null, meId,
  });
  const actions = net.isHost
    ? [el("button", { text: "Torna in stanza", onclick: () => { state.challenge = null; state.round = null; net.broadcast({ type: "lobby" }); showLobbyScreen(); } })]
    : [el("p", { text: "Aspetta che l'host prepari una nuova sfida…" })];
  show(
    el("h2", { text: `Fine del campionato · ${msg.day} ${msg.day === 1 ? "giornata" : "giornate"}` }),
    el("div", { class: "podium" }, [
      el("div", { class: "podium-trophy", text: tied.length > 1 ? "🤝" : "🏆" }),
      el("div", { class: "podium-name", text: tied.length > 1 ? "Pareggio!" : `${win?.name || ""}`, style: `--c: ${playerColor(win?.color)}` }),
      el("div", { class: "hint", text: tied.length > 1 ? `${tied.map((r) => r.name).join(" e ")} a ${win.points} punti` : win ? `Campione con ${win.points} punti${win.id === meId ? " · sei tu!" : ""}` : "" }),
    ]),
    el("div", { class: "card champ" }, [championshipTable(msg.table, meId)]),
    ...actions,
    el("div", { class: "spacer" }),
    exitButton()
  );
}

export function showFinal(msg) {
  setScreen("final");
  sfx.play("fanfare");
  rememberChallenge(msg);
  announceAchievements();
  if (!isSolo() || (state.challenge?.history.length || 0) > 0) confetti();
  const net = state.net;
  const ch = state.challenge;
  const solo = isSolo();
  const meId = net.me.id;

  const parts = [];
  if (solo && ch.daily) {
    parts.push(...dailyFinal(ch));
  } else if (solo) {
    parts.push(el("h2", { text: ch.quick ? "Prova finita!" : "Allenamento completato!" }));
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
  } else if (msg.teamStandings?.length) {
    // Podio di squadra
    const win = msg.teamStandings[0];
    const t = teamInfo(win.team);
    const myTeam = net.players.find((p) => p.id === meId)?.team;
    const tied = msg.teamStandings.filter((s) => s.points === win.points);
    parts.push(el("h2", { text: "Fine della sfida!" }));
    parts.push(
      el("div", { class: "podium" }, [
        el("div", { class: "podium-trophy", text: tied.length > 1 ? "🤝" : "🏆" }),
        tied.length > 1
          ? el("div", { class: "podium-name", text: "Pareggio!", style: "--c: var(--accent)" })
          : el("div", { class: "podium-name", text: t?.name || "", style: `--c: ${t?.color || "#888"}` }),
        el("div", { class: "hint", text: tied.length > 1
          ? `${tied.map((s) => teamInfo(s.team)?.name || "?").join(" e ")} a ${win.points} punti`
          : `${win.points} punti${myTeam === win.team ? " · la tua squadra!" : ""}` }),
      ])
    );
    parts.push(el("div", { class: "card" }, [
      el("ol", { class: "ranking teams" }, msg.teamStandings.map((s, i) =>
        el("li", { class: s.team === myTeam ? "me" : "" }, [
          el("span", { class: "pos", text: String(i + 1) }),
          el("span", { class: "who" }, [teamLabel(s.team, true)]),
          el("span", { class: "score", text: `${s.points} pt` }),
        ])
      )),
    ]));
    parts.push(el("div", { class: "card" }, [el("h2", { text: "Classifica individuale" }), standingsList(msg.standings, meId)]));
    if (msg.awards?.length) parts.push(awardsCard(msg.awards, meId));
  } else {
    const winner = msg.standings[0];
    parts.push(el("h2", { text: "Fine della sfida!" }));
    parts.push(
      el("div", { class: "podium" }, [
        el("div", { class: "podium-trophy", text: "🏆" }),
        el("div", { class: "podium-name", text: winner?.name || "", style: `--c: ${playerColor(winner?.color)}` }),
        el("div", { class: "hint", text: winner ? `${winner.points} punti` : "" }),
      ])
    );
    if (msg.standings.length >= 2) parts.push(podiumSteps(msg.standings, meId));
    parts.push(el("div", { class: "card" }, [standingsList(msg.standings, meId)]));
    if (msg.awards?.length) parts.push(awardsCard(msg.awards, meId));
  }
  if (msg.championship) {
    const c = msg.championship;
    parts.push(el("div", { class: "card champ" }, [
      el("h2", { text: `🏆 Campionato · giornata ${c.day}` }),
      championshipTable(c.table, meId),
      el("p", { class: "small", text: c.table[0] ? `In testa ${c.table[0].name} con ${c.table[0].points} punti.` : "" }),
    ]));
  }

  if (!solo && ch?.daily) parts.push(dailyGroupCard(ch));

  const actions = net.isHost
    ? [
        el("button", { text: ch.daily ? "🔁 Rigioca per allenarti" : ch.quick ? "🔁 Riprova" : "🔁 Rivincita (stessa sfida)", class: ch.daily ? "secondary" : "", onclick: () => replayChallenge() }),
        ch.quick ? el("button", { text: "Scheda del minigioco", class: "secondary", onclick: () => { const id = ch.rounds?.[0]?.gameId; leaveRoom(); const g = getEntry(id); g ? showGameInfo(g, showCatalog) : showCatalog(); } }) : el("span"),
        msg.championship ? el("button", { text: "🏆 Chiudi il campionato", class: "link", onclick: () => closeChampionship() }) : el("span"),
        ch.daily || ch.quick ? el("span") : el("button", {
          text: solo ? "Cambia impostazioni" : msg.championship ? `Prossima giornata (${msg.championship.day + 1})` : "Nuova sfida",
          class: "secondary",
          onclick: () => {
            state.challenge = null;
            state.round = null;
            net.broadcast({ type: "lobby" });
            showLobby();
          },
        }),
      ]
    : [el("p", { text: "Aspetta che l'host prepari una nuova sfida…" })];

  show(...parts, ...actions, solo ? el("span") : reactionBar(), el("div", { class: "spacer" }), exitButton());
}
