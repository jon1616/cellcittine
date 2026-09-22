/*
  Stanza (lobby): codice, chi c'è, e per l'host la configurazione della sfida
  (minigiochi scelti, pacchetti, manche, difficoltà). Per gli ospiti, il
  riassunto della sfida ricevuto dall'host.
*/

import { el } from "../utils.js";
import { state, setScreen, isSolo } from "../state.js";
import { show, statusLine, segmented, difficultyLabel, colorDot, toast } from "../ui.js";
import { CATALOG, CATEGORIES, getEntry } from "../games/catalog.js";
import { BUILTIN_PACKS, getBuiltinPack, resolvePack, randomSelection, sameSelection } from "../packs.js";
import { MODE_OPTIONS, DIFFICULTY_OPTIONS, ROUND_OPTIONS, AUTO_MIN, AUTO_MAX, saveConfig, getUserPacks, saveUserPack, deleteUserPack } from "../storage.js";
import { exitButton, shareInvite } from "../room.js";
import { startChallenge } from "../challenge.js";
import { showHome } from "./home.js";
import { showPicker } from "./picker.js";
import { showSelectionList } from "./catalog.js";
import { TEAM_OPTIONS, teamInfo, balancedAssignment } from "../teams.js";
import { snapshot as championshipSnapshot, endChampionship } from "../championship.js";
import { closeChampionship } from "../challenge.js";
import { dailyKey, dailyPlan, dailyLabel } from "../daily.js";

// ---------------------------------------------------------------
// Configurazione della sfida (host)
// ---------------------------------------------------------------

export function broadcastConfig() {
  const cfg = state.config;
  state.net?.broadcast({
    type: "config",
    config: { games: cfg.games, rounds: cfg.rounds, difficulty: cfg.difficulty, packName: packName(cfg), auto: cfg.auto, autoDelay: cfg.autoDelay, teams: cfg.teams, special: cfg.special, championship: cfg.championship, championshipDay: state.championship?.day || 0, mode: cfg.teams ? "punti" : cfg.mode },
  });
}

export function updateConfig(patch, { rerender = true } = {}) {
  state.config = { ...state.config, ...patch };
  if (patch.games && !patch.pack) state.config.pack = detectPack(state.config.games);
  saveConfig(state.config);
  broadcastConfig();
  if (rerender) showLobby();
}

// Se la selezione coincide con un pacchetto, lo riconosce.
export function detectPack(games) {
  for (const p of BUILTIN_PACKS) {
    if (sameSelection(games, resolvePack(p))) return { type: "builtin", id: p.id };
  }
  for (const p of getUserPacks()) {
    if (sameSelection(games, p.games)) return { type: "user", id: p.id };
  }
  return null;
}

function packName(cfg) {
  if (!cfg.pack) return null;
  if (cfg.pack.type === "daily") return cfg.pack.id === dailyKey() ? "Sfida del giorno" : `Sfida del giorno di ${dailyLabel(cfg.pack.id)}`;
  if (cfg.pack.type === "builtin") return getBuiltinPack(cfg.pack.id)?.name || null;
  return getUserPacks().find((p) => p.id === cfg.pack.id)?.name || null;
}

function applyPack(pack, type) {
  // Un pacchetto personale può portare con sé anche manche, difficoltà e manche automatiche
  const rules = type === "user" && pack.rules ? pack.rules : {};
  updateConfig({ games: resolvePack(pack), pack: { type, id: pack.id }, ...rules });
}

function roundsLabel(cfg) {
  return cfg.rounds === "tutti" ? `${cfg.games.length} manche (tutti i minigiochi scelti)` : `${cfg.rounds} manche`;
}

// "⚡ 3  🧠 2  …"
function categoryBreakdown(games) {
  return CATEGORIES.map((c) => {
    const n = games.filter((id) => getEntry(id)?.category === c.id).length;
    return n ? `${c.icon} ${n}` : null;
  }).filter(Boolean).join("  ");
}

function packsRow() {
  const cfg = state.config;
  const isActive = (type, id) => cfg.pack?.type === type && cfg.pack?.id === id;

  // Sfida del giorno in gruppo: i 5 minigiochi di oggi, stessi semi per tutti (solo in stanza)
  const plan = dailyPlan();
  const dailyChip = isSolo() ? [] : [el("button", {
    class: `chip pack${isActive("daily", plan.key) ? " on" : ""}`,
    text: `📅 Sfida del giorno (${plan.games.length})`,
    title: "I 5 minigiochi di oggi, uguali per tutti: il totale di ognuno vale come Sfida del giorno personale",
    onclick: () => updateConfig({ games: [...plan.games], rounds: "tutti", difficulty: "normale", pack: { type: "daily", id: plan.key } }),
  })];

  const builtin = BUILTIN_PACKS.filter((p) => resolvePack(p).length > 0).map((p) => {
    const n = resolvePack(p).length;
    return el("button", {
      class: `chip pack${isActive("builtin", p.id) ? " on" : ""}`,
      text: `${p.icon} ${p.name} (${n})`,
      title: p.description,
      onclick: () => applyPack(p, "builtin"),
    });
  });

  const user = getUserPacks().map((p) => {
    const chip = el("button", {
      class: `chip pack user${isActive("user", p.id) ? " on" : ""}`,
      text: `💾 ${p.name} (${p.games.length})${p.rules ? " ⚙" : ""}`,
      title: p.rules ? `${p.rules.rounds === "tutti" ? "Tutte le manche" : `${p.rules.rounds} manche`} · ${difficultyLabel(p.rules.difficulty)}${p.rules.auto ? " · automatiche" : ""}` : "",
      onclick: () => applyPack(p, "user"),
    });
    const del = el("button", {
      class: "chip-x",
      text: "✕",
      title: "Elimina pacchetto",
      onclick: (ev) => {
        ev.stopPropagation();
        if (del.dataset.armed) {
          deleteUserPack(p.id);
          if (isActive("user", p.id)) updateConfig({ pack: null });
          else showLobby();
        } else {
          del.dataset.armed = "1";
          del.textContent = "Elimina?";
          setTimeout(() => { delete del.dataset.armed; del.textContent = "✕"; }, 2500);
        }
      },
    });
    return el("span", { class: "chip-wrap" }, [chip, del]);
  });

  return el("div", { class: "chips scroll" }, [...dailyChip, ...builtin, ...user]);
}

function savePackForm() {
  const wrap = el("div", { class: "save-pack" });
  const open = el("button", { class: "link", text: "💾 Salva questa selezione come pacchetto" });
  open.addEventListener("click", () => {
    const input = el("input", { type: "text", maxlength: "24", placeholder: "Nome del pacchetto", autocomplete: "off" });
    const save = el("button", { text: "Salva", class: "small-btn" });
    let withRules = true;
    const rulesChip = el("button", { class: "chip small on", text: "⚙ Anche manche e difficoltà" });
    rulesChip.addEventListener("click", () => { withRules = !withRules; rulesChip.classList.toggle("on", withRules); });
    save.addEventListener("click", () => {
      const cfg = state.config;
      const rules = withRules ? { rounds: cfg.rounds, difficulty: cfg.difficulty, auto: cfg.auto, autoDelay: cfg.autoDelay, special: cfg.special, mode: cfg.mode } : null;
      const pack = saveUserPack(input.value, cfg.games, rules);
      updateConfig({ pack: { type: "user", id: pack.id } });
    });
    input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") save.click(); });
    wrap.replaceChildren(el("div", { class: "save-row" }, [input, save]), el("div", { class: "chips" }, [rulesChip]));
    input.focus();
  });
  wrap.append(open);
  return wrap;
}

function configPanel() {
  const cfg = state.config;
  const net = state.net;
  const name = packName(cfg);
  const n = cfg.games.length;

  const selectionCard = el("div", { class: "card" }, [
    el("h2", { text: "Minigiochi" }),
    el("div", { class: "sel-summary" }, [
      el("div", { class: "sel-main", text: name ? `${name} · ${n} di ${CATALOG.length}` : `Selezione personalizzata · ${n} di ${CATALOG.length}` }),
      el("div", { class: "sel-cats", text: n ? categoryBreakdown(cfg.games) : "Nessun minigioco scelto" }),
    ]),
    el("button", { text: "Scegli i minigiochi ›", class: "secondary", onclick: () => showPicker() }),
    el("div", { class: "label", text: "Pacchetti" }),
    packsRow(),
    el("div", { class: "row-2" }, [
      el("button", {
        text: "🎲 Sorprendimi",
        class: "secondary small-btn",
        onclick: () => {
          const count = cfg.rounds === "tutti" ? 7 : cfg.rounds;
          updateConfig({ games: randomSelection(count), pack: null });
        },
      }),
    ]),
    n > 0 && !name ? savePackForm() : el("span"),
  ]);

  const rulesCard = el("div", { class: "card" }, [
    el("div", { class: "label", text: "Manche" }),
    segmented(
      ROUND_OPTIONS.map((r) => ({ id: r, label: r === "tutti" ? "Tutti" : String(r) })),
      cfg.rounds,
      (rounds) => updateConfig({ rounds })
    ),
    el("div", { class: "label", text: "Difficoltà" }),
    segmented(DIFFICULTY_OPTIONS, cfg.difficulty, (difficulty) => updateConfig({ difficulty })),
    cfg.difficulty === "crescente" ? el("p", { class: "small", text: "Le manche partono facili e diventano difficili verso la fine." }) : el("span"),
    el("div", { class: "label", text: "Tra una manche e l'altra" }),
    segmented(
      [{ id: false, label: "A mano" }, { id: true, label: "Automatico" }],
      cfg.auto,
      (auto) => updateConfig({ auto })
    ),
    cfg.auto ? autoDelayRow() : el("p", { class: "small", text: "Chi ha creato la stanza tocca “Prossima manche”" }),
    el("button", {
      text: "🏃 Serata Maratona",
      class: "secondary small-btn",
      title: "15 manche, difficoltà crescente, manche speciali, manche automatiche",
      onclick: () => { updateConfig({ rounds: 15, difficulty: "crescente", auto: true, autoDelay: 8, ...(isSolo() ? {} : { special: true }) }); toast("Maratona: 15 manche, crescente, speciali, automatiche"); },
    }),
  ]);

  return isSolo() ? [selectionCard, rulesCard] : [selectionCard, rulesCard, extrasCard(cfg, net)];
}

// Le opzioni "in più" (squadre, modalità, manche speciali, campionato): chiuse per
// default con un riassunto, aperte al tocco.
let extrasOpen = false;
function extrasSummary(cfg) {
  const parts = [];
  if (cfg.teams) parts.push(`${cfg.teams} squadre`);
  if (!cfg.teams && cfg.mode === "eliminazione") parts.push("a eliminazione");
  if (cfg.special) parts.push("manche speciali");
  if (cfg.championship) parts.push("campionato");
  return parts.length ? parts.join(" · ") : "Niente di attivo: classica sfida a punti";
}
function extrasCard(cfg, net) {
  const toggle = el("button", { class: "cat-toggle extras-toggle", text: `${extrasOpen ? "▾" : "▸"} In più`, onclick: () => { extrasOpen = !extrasOpen; showLobby(); } });
  const head = el("div", { class: "extras-head" }, [toggle, el("span", { class: "extras-summary", text: extrasSummary(cfg) })]);
  if (!extrasOpen) return el("div", { class: "card extras" }, [head]);
  return el("div", { class: "card extras" }, [
    head,
      el("div", { class: "label", text: "Squadre" }),
      segmented(TEAM_OPTIONS, cfg.teams, (teams) => setTeams(teams)),
      cfg.teams ? el("p", { class: "small", text: "Tocca la squadra accanto a un nome per cambiarla. Conta la media dei punti dei membri." }) : el("span"),
      el("div", { class: "label", text: "Modalità" }),
      cfg.teams
        ? el("p", { class: "small", text: "Con le squadre si gioca a punti." })
        : segmented(MODE_OPTIONS, cfg.mode, (mode) => updateConfig({ mode })),
      !cfg.teams && cfg.mode === "eliminazione" ? el("p", { class: "small", text: `Ogni manche chi arriva ultimo è fuori (continua a giocare, ma senza punti). Vince chi resta. Con ${net.players.length} in stanza servono ${Math.max(1, net.players.length - 1)} manche.` }) : el("span"),
      el("div", { class: "label", text: "Manche speciali" }),
      segmented([{ id: false, label: "No" }, { id: true, label: "Sì" }], cfg.special, (special) => updateConfig({ special })),
      el("p", { class: "small", text: cfg.special ? `A sorpresa: 🔥 punti doppi, 🎯 tutto o niente, 🚀 rimonta, ⚡ manche difficile, 🍃 manche facile, ${cfg.teams ? "🤝 staffetta (somma di squadra)" : "⚔️ duello tra due"}; l'ultima vale doppio 🏁.` : "Tutte le manche valgono uguale." }),
      el("div", { class: "label", text: "Campionato" }),
      segmented([{ id: false, label: "No" }, { id: true, label: "Sì" }], cfg.championship, (championship) => updateConfig({ championship })),
      el("p", { class: "small", text: cfg.championship ? "Ogni sfida è una giornata: i punti per posizione si sommano in una classifica di campionato, finché non lo chiudi." : "Ogni sfida fa storia a sé." }),
  ]);
}

// Attesa tra le manche (manche automatiche): cursore da AUTO_MIN a AUTO_MAX secondi.
function autoDelayRow() {
  const cfg = state.config;
  const value = el("span", { class: "range-val", text: `${cfg.autoDelay} s` });
  const slider = el("input", { type: "range", min: String(AUTO_MIN), max: String(AUTO_MAX), step: "1", value: String(cfg.autoDelay) });
  slider.addEventListener("input", () => { value.textContent = `${slider.value} s`; });
  slider.addEventListener("change", () => updateConfig({ autoDelay: Number(slider.value) }, { rerender: false }));
  return el("div", { class: "range-row" }, [el("span", { class: "small", text: "Attesa" }), slider, value]);
}

// Squadre: numero e assegnazione (host)
function setTeams(count) {
  const net = state.net;
  if (count) {
    for (const a of balancedAssignment(net.players, count)) net.setTeam(a.id, a.team);
  } else {
    for (const p of net.players) net.setTeam(p.id, null);
  }
  net.broadcastPlayers();
  updateConfig({ teams: count });
}

function shuffleTeams() {
  const net = state.net;
  const count = state.config.teams;
  const order = [...net.players].sort(() => Math.random() - 0.5);
  for (const a of balancedAssignment(order, count)) net.setTeam(a.id, a.team);
  net.broadcastPlayers();
  showLobby();
}

function cycleTeam(id) {
  const net = state.net;
  const count = state.config.teams;
  const p = net.players.find((x) => x.id === id);
  net.setTeam(id, ((Number.isInteger(p?.team) ? p.team : -1) + 1) % count);
  net.broadcastPlayers();
  showLobby();
}

// Pillola della difficoltà personale (handicap): l'host la cambia toccandola (Auto → Facile → Normale → Difficile)
const HANDICAPS = [null, "facile", "normale", "difficile"];
function handicapPill(p, canEdit) {
  const label = p.handicap ? difficultyLabel(p.handicap) : "Auto";
  const attrs = { class: `diff-pill${p.handicap ? " on" : ""}`, text: label, title: "Difficoltà personale" };
  if (!canEdit) return p.handicap ? el("span", attrs) : el("span");
  return el("button", { ...attrs, onclick: () => {
    const net = state.net;
    const next = HANDICAPS[(HANDICAPS.indexOf(p.handicap || null) + 1) % HANDICAPS.length];
    net.setHandicap(p.id, next);
    net.broadcastPlayers();
    showLobby();
  } });
}

// Pillola con il nome della squadra (per l'host è un pulsante che la cambia)
function teamPill(p, canEdit) {
  const t = teamInfo(p.team);
  if (!t) return el("span");
  const attrs = { class: "team-pill", text: t.short, style: `--t: ${t.color}` };
  if (!canEdit) return el("span", attrs);
  return el("button", { ...attrs, title: "Cambia squadra", onclick: () => cycleTeam(p.id) });
}

// Campionato in corso (host): classifica e chiusura
function championshipCard(snap) {
  const close = el("button", { text: "Chiudi il campionato e proclama il campione", class: "link" });
  close.addEventListener("click", () => {
    if (close.dataset.armed) { closeChampionship(); return; }
    close.dataset.armed = "1";
    close.textContent = "Sicuro? Tocca ancora per chiudere";
    setTimeout(() => { delete close.dataset.armed; close.textContent = "Chiudi il campionato e proclama il campione"; }, 3000);
  });
  const abandon = el("button", { text: "Annulla il campionato", class: "link" });
  abandon.addEventListener("click", () => { endChampionship(); updateConfig({ championship: false }); });
  return el("div", { class: "card champ" }, [
    el("h2", { text: `🏆 Campionato · ${snap.day} ${snap.day === 1 ? "giornata giocata" : "giornate giocate"}` }),
    championshipTable(snap.table, state.net.me.id),
    el("p", { class: "small", text: "La prossima sfida sarà la giornata " + (snap.day + 1) + "." }),
    close,
    abandon,
  ]);
}

// Tabella del campionato: posizione, nome, punti, giornate vinte
export function championshipTable(table, meId) {
  return el("ol", { class: "ranking champ-table" }, table.map((r, i) =>
    el("li", { class: r.id === meId ? "me" : "", style: `--i: ${i}` }, [
      el("span", { class: "pos", text: i === 0 ? "🏆" : String(i + 1) }),
      el("span", { class: "who" }, [colorDot(r.color, r.id), el("span", { text: r.name })]),
      el("span", { class: "score", text: `${r.wins} ${r.wins === 1 ? "vinta" : "vinte"}` }),
      el("span", { class: "pts", text: `${r.points} pt` }),
    ])
  ));
}

// Se il pacchetto scelto è la Sfida del giorno di oggi (stessi minigiochi, in ordine), si parte con i semi del giorno
function dailyStartOptions() {
  const cfg = state.config;
  if (cfg.pack?.type !== "daily") return {};
  const plan = dailyPlan();
  if (cfg.pack.id !== plan.key || cfg.games.join() !== plan.games.join()) return {};
  return { games: [...plan.games], seeds: [...plan.seeds], difficulty: plan.difficulty, daily: { key: plan.key, group: true } };
}

// Riassunto per gli ospiti (dalla configurazione ricevuta dall'host).
function configSummary(cfg) {
  const n = cfg.games.length;
  return el("div", { class: "card" }, [
    el("h2", { text: "La sfida" }),
    el("p", { text: `${cfg.packName === "Sfida del giorno" ? "📅 Sfida del giorno: i 5 minigiochi di oggi, il tuo totale vale come sfida personale · " : cfg.packName ? `Pacchetto ${cfg.packName} · ` : ""}${roundsLabel(cfg)} · ${difficultyLabel(cfg.difficulty)}${cfg.auto ? ` · manche automatiche (${cfg.autoDelay} s)` : ""}${cfg.teams ? ` · ${cfg.teams} squadre` : ""}${cfg.special ? " · manche speciali" : ""}${cfg.championship ? ` · campionato${cfg.championshipDay ? ` (giornata ${cfg.championshipDay + 1})` : ""}` : ""}${cfg.mode === "eliminazione" ? " · a eliminazione" : ""}` }),
    el("p", { class: "small", text: n ? `${n} ${n === 1 ? "minigioco" : "minigiochi"}: ${categoryBreakdown(cfg.games)}` : "" }),
    el("button", { text: "Vedi i minigiochi", class: "link", onclick: () => showSelectionList(cfg.games) }),
  ]);
}

// ---------------------------------------------------------------
// Schermata
// ---------------------------------------------------------------

function playersList(players, meId, { teams = 0, canEdit = false } = {}) {
  return el(
    "ul",
    { class: "players" },
    players.map((p) =>
      el("li", { class: p.id === meId ? "me" : "" }, [
        el("span", { class: "who" }, [colorDot(p.color, p.id), el("span", { text: p.name }), p.away ? el("span", { class: "away", title: "App in secondo piano", text: "💤" }) : el("span")]),
        el("span", { class: "player-right" }, [
          handicapPill(p, canEdit),
          teams ? teamPill(p, canEdit) : el("span"),
          el("span", { class: "tag", text: p.isHost ? "host" : "" }),
        ]),
      ])
    )
  );
}

export function showLobby() {
  setScreen("lobby");
  const net = state.net;
  if (!net) return showHome();
  const solo = isSolo();
  const status = statusLine();

  const header = solo
    ? [el("h2", { text: "Allenamento" }), el("p", { text: "Da soli, contro i tuoi record" })]
    : [
        el("p", { text: "Codice della stanza" }),
        el("div", { class: "code-big", text: net.code }),
        el("p", { text: "Chi vuole entrare tocca “Entra con un codice”, oppure mandagli il link" }),
        el("button", { text: "📨 Invita", class: "secondary small-btn invite-btn", onclick: () => shareInvite(net.code) }),
      ];

  const parts = [...header];

  if (!solo) {
    const teams = net.isHost ? state.config.teams : state.hostConfig?.teams || 0;
    parts.push(
      el("div", { class: "card" }, [
        el("h2", { text: `In stanza (${net.players.length})` }),
        playersList(net.players, net.me.id, { teams, canEdit: net.isHost }),
        net.isHost ? el("p", { class: "small", text: "Tocca “Auto” accanto a un nome per dare una difficoltà personale (handicap): chi ha la stessa difficoltà gioca gli stessi parametri." }) : el("span"),
        net.isHost && teams ? el("button", { text: "🎲 Mescola le squadre", class: "secondary small-btn", onclick: shuffleTeams }) : el("span"),
      ])
    );
  }

  if (net.isHost) {
    const snap = championshipSnapshot();
    if (snap?.day) parts.push(championshipCard(snap));
    parts.push(...configPanel());
    const startBtn = el("button", { text: solo ? "Inizia!" : "Inizia la sfida!", onclick: () => startChallenge(dailyStartOptions()) });
    startBtn.disabled = state.config.games.length === 0;
    const away = net.players.filter((p) => p.away).map((p) => p.name);
    if (away.length) parts.push(el("p", { class: "small", text: `💤 ${away.join(", ")} ${away.length === 1 ? "è altrove" : "sono altrove"} (app in secondo piano): aspetta o inizia comunque.` }));
    parts.push(startBtn);
    if (state.config.games.length === 0) parts.push(el("p", { class: "small", text: "Scegli almeno un minigioco" }));
  } else {
    if (state.hostConfig) parts.push(configSummary(state.hostConfig));
    parts.push(el("p", { text: "Aspetta che l'host faccia partire la sfida…" }));
  }

  show(...parts, status, el("div", { class: "spacer" }), exitButton());
}
