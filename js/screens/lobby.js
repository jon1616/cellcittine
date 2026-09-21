/*
  Stanza (lobby): codice, chi c'è, e per l'host la configurazione della sfida
  (minigiochi scelti, pacchetti, manche, difficoltà). Per gli ospiti, il
  riassunto della sfida ricevuto dall'host.
*/

import { el } from "../utils.js";
import { state, setScreen, isSolo } from "../state.js";
import { show, statusLine, segmented, difficultyLabel } from "../ui.js";
import { CATALOG, CATEGORIES, getEntry } from "../games/catalog.js";
import { BUILTIN_PACKS, getBuiltinPack, resolvePack, randomSelection, sameSelection } from "../packs.js";
import { DIFFICULTIES, ROUND_OPTIONS, AUTO_MIN, AUTO_MAX, saveConfig, getUserPacks, saveUserPack, deleteUserPack } from "../storage.js";
import { exitButton, shareInvite } from "../room.js";
import { startChallenge } from "../challenge.js";
import { showHome } from "./home.js";
import { showPicker } from "./picker.js";
import { showSelectionList } from "./catalog.js";

// ---------------------------------------------------------------
// Configurazione della sfida (host)
// ---------------------------------------------------------------

export function broadcastConfig() {
  const cfg = state.config;
  state.net?.broadcast({
    type: "config",
    config: { games: cfg.games, rounds: cfg.rounds, difficulty: cfg.difficulty, packName: packName(cfg), auto: cfg.auto, autoDelay: cfg.autoDelay },
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
  if (cfg.pack.type === "builtin") return getBuiltinPack(cfg.pack.id)?.name || null;
  return getUserPacks().find((p) => p.id === cfg.pack.id)?.name || null;
}

function applyPack(pack, type) {
  updateConfig({ games: resolvePack(pack), pack: { type, id: pack.id } });
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

  const builtin = BUILTIN_PACKS.map((p) => {
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
      text: `💾 ${p.name} (${p.games.length})`,
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

  return el("div", { class: "chips scroll" }, [...builtin, ...user]);
}

function savePackForm() {
  const wrap = el("div", { class: "save-pack" });
  const open = el("button", { class: "link", text: "💾 Salva questa selezione come pacchetto" });
  open.addEventListener("click", () => {
    const input = el("input", { type: "text", maxlength: "24", placeholder: "Nome del pacchetto", autocomplete: "off" });
    const save = el("button", { text: "Salva", class: "small-btn" });
    save.addEventListener("click", () => {
      const pack = saveUserPack(input.value, state.config.games);
      updateConfig({ pack: { type: "user", id: pack.id } });
    });
    input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") save.click(); });
    wrap.replaceChildren(el("div", { class: "save-row" }, [input, save]));
    input.focus();
  });
  wrap.append(open);
  return wrap;
}

function configPanel() {
  const cfg = state.config;
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
    segmented(DIFFICULTIES, cfg.difficulty, (difficulty) => updateConfig({ difficulty })),
    el("div", { class: "label", text: "Tra una manche e l'altra" }),
    segmented(
      [{ id: false, label: "A mano" }, { id: true, label: "Automatico" }],
      cfg.auto,
      (auto) => updateConfig({ auto })
    ),
    cfg.auto ? autoDelayRow() : el("p", { class: "small", text: "Chi ha creato la stanza tocca “Prossima manche”" }),
  ]);

  return [selectionCard, rulesCard];
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

// Riassunto per gli ospiti (dalla configurazione ricevuta dall'host).
function configSummary(cfg) {
  const n = cfg.games.length;
  return el("div", { class: "card" }, [
    el("h2", { text: "La sfida" }),
    el("p", { text: `${cfg.packName ? `Pacchetto ${cfg.packName} · ` : ""}${roundsLabel(cfg)} · ${difficultyLabel(cfg.difficulty)}${cfg.auto ? ` · manche automatiche (${cfg.autoDelay} s)` : ""}` }),
    el("p", { class: "small", text: n ? `${n} ${n === 1 ? "minigioco" : "minigiochi"}: ${categoryBreakdown(cfg.games)}` : "" }),
    el("button", { text: "Vedi i minigiochi", class: "link", onclick: () => showSelectionList(cfg.games) }),
  ]);
}

// ---------------------------------------------------------------
// Schermata
// ---------------------------------------------------------------

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
    parts.push(
      el("div", { class: "card" }, [
        el("h2", { text: `In stanza (${net.players.length})` }),
        playersList(net.players, net.me.id),
      ])
    );
  }

  if (net.isHost) {
    parts.push(...configPanel());
    const startBtn = el("button", { text: solo ? "Inizia!" : "Inizia la sfida!", onclick: startChallenge });
    startBtn.disabled = state.config.games.length === 0;
    parts.push(startBtn);
    if (state.config.games.length === 0) parts.push(el("p", { class: "small", text: "Scegli almeno un minigioco" }));
  } else {
    if (state.hostConfig) parts.push(configSummary(state.hostConfig));
    parts.push(el("p", { text: "Aspetta che l'host faccia partire la sfida…" }));
  }

  show(...parts, status, el("div", { class: "spacer" }), exitButton());
}
