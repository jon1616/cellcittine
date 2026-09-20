/*
  App: il telaio del gioco.
  Schermate: home, stanza (con configurazione della sfida), scelta dei
  minigiochi, conto alla rovescia, minigioco, risultati, podio finale.

  Una "sfida" è una sequenza di manche. L'host la configura (minigiochi,
  numero di manche, difficoltà), poi per ogni manche:
    host annuncia il minigioco -> tutti partono allo stesso istante ->
    ognuno manda il punteggio all'host -> l'host pubblica classifica della
    manche e classifica generale (punti per posizione).

  I minigiochi sono descritti nel catalogo (games/catalog.js) e il loro
  codice viene caricato solo quando serve (loadGame).
*/

import { VERSION } from "./version.js";
import { Net } from "./net.js";
import {
  CATALOG, CATEGORIES, ALL_GAME_IDS, getEntry, getCategory, isNew, matches, loadGame, getLoaded, preloadGames, PACES,
} from "./games/catalog.js";
import { BUILTIN_PACKS, getBuiltinPack, resolvePack, randomSelection, sameSelection } from "./packs.js";
import { el, seededRandom } from "./utils.js";
import {
  DIFFICULTIES, ROUND_OPTIONS, loadConfig, saveConfig, getRecord, updateRecord,
  getUserPacks, saveUserPack, deleteUserPack,
} from "./storage.js";
import { shuffle } from "./games/shell.js";
import { sfx } from "./audio.js";

const app = document.getElementById("app");
document.getElementById("version").textContent = `v${VERSION}`;

const state = {
  net: null,
  name: localStorage.getItem("name") || "",
  config: loadConfig(ALL_GAME_IDS), // configurazione della sfida (host)
  hostConfig: null,                 // copia ricevuta dall'host (guest)
  challenge: null,                  // { total, difficulty, index, standings: Map, history: [] }
  round: null,                      // { index, game, params, startAt, scores: Map, participants, deadline }
  picker: null,                     // stato della schermata di scelta minigiochi
};

let currentScreen = "home";
let statusEl = null;

// Se la selezione salvata coincide con un pacchetto, mostralo col suo nome.
if (!state.config.pack) state.config.pack = detectPack(state.config.games);

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
  state.round?.game?.unmount();
  clearTimeout(state.round?.deadline);
  state.net?.leave();
  state.net = null;
  state.round = null;
  state.challenge = null;
  state.hostConfig = null;
}

function exitButton(text = "Esci") {
  return el("button", {
    text,
    class: "secondary",
    onclick: () => {
      leaveRoom();
      // Click leggero su ogni pulsante dell'interfaccia (i minigiochi hanno i loro suoni)
document.addEventListener("pointerdown", (ev) => {
  const btn = ev.target.closest("button");
  if (btn && !btn.closest(".game-area")) sfx.play("click");
}, { passive: true });

showHome();
    },
  });
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
    el("div", { class: "links" }, [
      el("button", { text: "I miei record", class: "link", onclick: showRecords }),
      el("button", { text: `${CATALOG.length} minigiochi`, class: "link", onclick: () => showCatalog() }),
      el("button", {
        text: sfx.isEnabled() ? "🔊 Suoni" : "🔇 Suoni",
        class: "link",
        onclick: () => { sfx.setEnabled(!sfx.isEnabled()); showHome(); },
      }),
    ]),
    statusEl
  );
}

// ---------------------------------------------------------------
// RECORD
// ---------------------------------------------------------------

function showRecords() {
  currentScreen = "records";
  const sections = CATEGORIES.map((cat) => {
    const games = CATALOG.filter((g) => g.category === cat.id);
    if (games.length === 0) return null;
    const rows = games.map((g) =>
      el("div", { class: "rec-row" }, [
        el("span", { class: "rec-name", text: `${g.icon} ${g.title}` }),
        ...DIFFICULTIES.map((d) => {
          const r = getRecord(g.id, d.id);
          return el("span", { class: "rec-cell", text: r ? r.text : "—" });
        }),
      ])
    );
    return el("div", { class: "card" }, [
      el("h2", { text: `${cat.icon} ${cat.label}` }),
      el("div", { class: "rec-row rec-head" }, [
        el("span", { class: "rec-name", text: "" }),
        ...DIFFICULTIES.map((d) => el("span", { class: "rec-cell", text: d.label })),
      ]),
      ...rows,
    ]);
  }).filter(Boolean);

  show(
    el("h2", { text: "I miei record" }),
    ...sections,
    el("div", { class: "spacer" }),
    el("button", { text: "Indietro", class: "secondary", onclick: () => showHome() })
  );
}

// ---------------------------------------------------------------
// CATALOGO (solo consultazione) e scheda di un minigioco
// ---------------------------------------------------------------

function showCatalog() {
  currentScreen = "catalog";
  const sections = CATEGORIES.map((cat) => {
    const games = CATALOG.filter((g) => g.category === cat.id);
    if (games.length === 0) return null;
    return el("div", { class: "card" }, [
      el("h2", { text: `${cat.icon} ${cat.label}` }),
      ...games.map((g) => gameRow(g, { onClick: () => showGameInfo(g, showCatalog) })),
    ]);
  }).filter(Boolean);

  show(
    el("h2", { text: "Tutti i minigiochi" }),
    el("p", { text: "Tocca un minigioco per la scheda completa" }),
    ...sections,
    el("div", { class: "spacer" }),
    el("button", { text: "Indietro", class: "secondary", onclick: () => showHome() })
  );
}

function metaLine(g) {
  const parts = [`⏱ ${g.duration} s`, PACES[g.pace] || g.pace, g.input];
  return parts.join(" · ");
}

// Riga compatta di un minigioco, usata in catalogo e nella scelta.
function gameRow(g, { selected = null, onClick, onInfo } = {}) {
  const rec = getRecord(g.id, state.config.difficulty);
  const row = el("div", { class: `game-row${selected === true ? " on" : ""}${selected === false ? " off" : ""}` }, [
    selected === null ? el("span") : el("span", { class: "check", text: selected ? "✓" : "" }),
    el("span", { class: "game-icon", text: g.icon }),
    el("div", { class: "game-text" }, [
      el("div", { class: "game-title-row" }, [
        el("span", { class: "game-name", text: g.title }),
        isNew(g) ? el("span", { class: "badge new", text: "NUOVO" }) : el("span"),
      ]),
      el("div", { class: "game-desc", text: g.description }),
      el("div", { class: "game-meta", text: metaLine(g) + (rec ? ` · ★ ${rec.text}` : "") }),
    ]),
    onInfo ? el("button", { class: "info", text: "i", onclick: (ev) => { ev.stopPropagation(); onInfo(); } }) : el("span"),
  ]);
  if (onClick) row.addEventListener("click", onClick);
  return row;
}

function showGameInfo(g, back) {
  currentScreen = "info";
  const cat = getCategory(g.category);
  const rows = [
    ["Categoria", `${cat?.icon || ""} ${cat?.label || g.category}`],
    ["Abilità", g.skills.join(", ")],
    ["Tema", g.theme],
    ["Durata", `${g.duration} secondi`],
    ["Ritmo", PACES[g.pace] || g.pace],
    ["Comando", `${g.input} · ${g.hands}`],
    ["Punteggio", g.scoring],
    ["Difficoltà", g.difficultyNote],
    ["Arrivato il", new Date(g.added).toLocaleDateString("it-IT")],
    ["Tag", g.tags.join(", ")],
  ];
  const records = DIFFICULTIES.map((d) => {
    const r = getRecord(g.id, d.id);
    return `${d.label}: ${r ? r.text : "—"}`;
  }).join(" · ");

  show(
    el("div", { class: "info-head" }, [
      el("div", { class: "info-icon", text: g.icon }),
      el("h2", { text: g.title }),
      isNew(g) ? el("span", { class: "badge new", text: "NUOVO" }) : el("span"),
    ]),
    el("div", { class: "card" }, [
      el("p", { class: "howto", text: g.howTo }),
    ]),
    el("div", { class: "card" }, [
      ...rows.map(([k, v]) => el("div", { class: "info-row" }, [el("span", { class: "info-k", text: k }), el("span", { class: "info-v", text: v })])),
    ]),
    el("div", { class: "card" }, [el("div", { class: "label", text: "I tuoi record" }), el("p", { class: "small", text: records })]),
    el("div", { class: "spacer" }),
    el("button", { text: "Indietro", class: "secondary", onclick: back })
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
// CONFIGURAZIONE DELLA SFIDA
// ---------------------------------------------------------------

function broadcastConfig() {
  const cfg = state.config;
  state.net?.broadcast({
    type: "config",
    config: { games: cfg.games, rounds: cfg.rounds, difficulty: cfg.difficulty, packName: packName(cfg) },
  });
}

function updateConfig(patch, { rerender = true } = {}) {
  state.config = { ...state.config, ...patch };
  if (patch.games && !patch.pack) state.config.pack = detectPack(state.config.games);
  saveConfig(state.config);
  broadcastConfig();
  if (rerender) showLobby();
}

// Se la selezione coincide con un pacchetto, lo riconosce.
function detectPack(games) {
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

// "Riflessi 3 · Memoria 2 · …"
function categoryBreakdown(games) {
  return CATEGORIES.map((c) => {
    const n = games.filter((id) => getEntry(id)?.category === c.id).length;
    return n ? `${c.icon} ${n}` : null;
  }).filter(Boolean).join("  ");
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
  ]);

  return [selectionCard, rulesCard];
}

function configSummary(cfg) {
  const n = cfg.games.length;
  return el("div", { class: "card" }, [
    el("h2", { text: "La sfida" }),
    el("p", { text: `${cfg.packName ? `Pacchetto ${cfg.packName} · ` : ""}${roundsLabel(cfg)} · ${difficultyLabel(cfg.difficulty)}` }),
    el("p", { class: "small", text: n ? `${n} ${n === 1 ? "minigioco" : "minigiochi"}: ${categoryBreakdown(cfg.games)}` : "" }),
    el("button", { text: "Vedi i minigiochi", class: "link", onclick: () => showSelectionList(cfg.games) }),
  ]);
}

// Elenco di sola lettura dei minigiochi della sfida (per chi è ospite).
function showSelectionList(games) {
  currentScreen = "list";
  show(
    el("h2", { text: "Minigiochi della sfida" }),
    el("div", { class: "card" }, games.map((id) => getEntry(id)).filter(Boolean).map((g) => gameRow(g, { onClick: () => showGameInfo(g, () => showSelectionList(games)) }))),
    el("div", { class: "spacer" }),
    el("button", { text: "Indietro", class: "secondary", onclick: () => showLobby() })
  );
}

// ---------------------------------------------------------------
// SCELTA DEI MINIGIOCHI (schermata dedicata, per l'host)
// ---------------------------------------------------------------

function showPicker() {
  currentScreen = "picker";
  state.picker = {
    selected: new Set(state.config.games),
    query: "",
    filter: "tutti", // "tutti" | "nuovi" | "scelti" | <categoria>
    collapsed: new Set(),
  };

  const search = el("input", { type: "text", class: "search", placeholder: "Cerca (nome, abilità, tema…)", autocomplete: "off" });
  search.addEventListener("input", () => { state.picker.query = search.value; renderList(); });

  const filters = el("div", { class: "chips scroll filters" });
  const list = el("div", { class: "pick-list" });
  const footer = el("div", { class: "pick-footer" });

  const renderFilters = () => {
    const p = state.picker;
    const mk = (id, label) =>
      el("button", { class: `chip small${p.filter === id ? " on" : ""}`, text: label, onclick: () => { p.filter = id; renderFilters(); renderList(); } });
    const newCount = CATALOG.filter(isNew).length;
    filters.replaceChildren(
      mk("tutti", "Tutti"),
      mk("scelti", `Scelti (${p.selected.size})`),
      ...(newCount ? [mk("nuovi", `✨ Nuovi (${newCount})`)] : []),
      ...CATEGORIES.map((c) => mk(c.id, `${c.icon} ${c.label}`))
    );
  };

  const visibleGames = () => {
    const p = state.picker;
    return CATALOG.filter((g) => {
      if (p.filter === "nuovi" && !isNew(g)) return false;
      if (p.filter === "scelti" && !p.selected.has(g.id)) return false;
      if (CATEGORIES.some((c) => c.id === p.filter) && g.category !== p.filter) return false;
      return matches(g, p.query);
    });
  };

  const renderFooter = () => {
    const p = state.picker;
    footer.replaceChildren(
      el("button", { class: "chip small", text: "✓ Tutti", onclick: () => { visibleGames().forEach((g) => p.selected.add(g.id)); renderList(); } }),
      el("button", { class: "chip small", text: "✕ Nessuno", onclick: () => { visibleGames().forEach((g) => p.selected.delete(g.id)); renderList(); } }),
      el("div", { class: "spacer" }),
      el("button", {
        text: `Fatto · ${p.selected.size}`,
        onclick: () => {
          updateConfig({ games: CATALOG.filter((g) => p.selected.has(g.id)).map((g) => g.id) }, { rerender: false });
          showLobby();
        },
      })
    );
  };

  const renderList = () => {
    const p = state.picker;
    const visible = visibleGames();
    const sections = [];
    for (const cat of CATEGORIES) {
      const games = visible.filter((g) => g.category === cat.id);
      if (games.length === 0) continue;
      const chosen = games.filter((g) => p.selected.has(g.id)).length;
      const collapsed = p.collapsed.has(cat.id);
      const head = el("div", { class: "cat-head" }, [
        el("button", {
          class: "cat-toggle",
          text: `${collapsed ? "▸" : "▾"} ${cat.icon} ${cat.label}`,
          onclick: () => { collapsed ? p.collapsed.delete(cat.id) : p.collapsed.add(cat.id); renderList(); },
        }),
        el("span", { class: "cat-count", text: `${chosen}/${games.length}` }),
        el("button", {
          class: "chip small",
          text: chosen === games.length ? "Nessuno" : "Tutti",
          onclick: () => {
            if (chosen === games.length) games.forEach((g) => p.selected.delete(g.id));
            else games.forEach((g) => p.selected.add(g.id));
            renderList();
          },
        }),
      ]);
      head.style.setProperty("--cat", cat.color);
      const rows = collapsed ? [] : games.map((g) =>
        gameRow(g, {
          selected: p.selected.has(g.id),
          onClick: () => { p.selected.has(g.id) ? p.selected.delete(g.id) : p.selected.add(g.id); renderList(); },
          onInfo: () => showGameInfo(g, () => { showPickerAgain(); }),
        })
      );
      sections.push(el("div", { class: "cat-section" }, [head, ...rows]));
    }
    if (sections.length === 0) sections.push(el("p", { text: "Nessun minigioco corrisponde." }));
    list.replaceChildren(...sections);
    renderFooter();
    renderFilters();
  };

  // Torna alla scelta conservando selezione e filtri (dopo una scheda info).
  const showPickerAgain = () => {
    currentScreen = "picker";
    app.replaceChildren(
      el("div", { class: "screen picker" }, [
        el("h2", { text: "Scegli i minigiochi" }),
        search,
        filters,
        list,
        footer,
      ])
    );
    search.value = state.picker.query;
    renderList();
  };

  showPickerAgain();
}

// ---------------------------------------------------------------
// STANZA
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

function showLobby() {
  currentScreen = "lobby";
  const net = state.net;
  if (!net) return showHome();
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
    parts.push(...configPanel());
    const startBtn = el("button", { text: solo ? "Inizia!" : "Inizia la sfida!", onclick: startChallenge });
    startBtn.disabled = state.config.games.length === 0;
    parts.push(startBtn);
    if (state.config.games.length === 0) parts.push(el("p", { class: "small", text: "Scegli almeno un minigioco" }));
  } else {
    if (state.hostConfig) parts.push(configSummary(state.hostConfig));
    parts.push(el("p", { text: "Aspetta che l'host faccia partire la sfida…" }));
  }

  show(...parts, statusEl, el("div", { class: "spacer" }), exitButton());
}

// ---------------------------------------------------------------
// SFIDA: avvio e manche (host)
// ---------------------------------------------------------------

async function startChallenge() {
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

  setStatus("Preparo i minigiochi…");
  await preloadGames([...new Set(rounds.map((r) => r.gameId))]);
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

async function beginRound(msg) {
  const net = state.net;
  if (!net) return;

  // Un guest arrivato a sfida iniziata crea la propria vista della sfida qui.
  if (!net.isHost && (!state.challenge || msg.index === 0)) {
    state.challenge = { total: msg.total, difficulty: msg.difficulty, index: msg.index, standings: new Map(), history: [] };
  }
  state.challenge.index = msg.index;

  // Segnaposto subito (così i messaggi di questa manche non vengono scartati)…
  state.round = { index: msg.index, game: null, params: null, startAt: msg.startAt, scores: new Map(), participants: net.players.map((p) => p.id), deadline: null };
  showCountdown(getEntry(msg.gameId), msg);

  // …poi il codice del minigioco, caricato a richiesta.
  let game;
  try {
    game = await loadGame(msg.gameId);
  } catch (_) {
    setStatus("Non riesco a caricare il minigioco.", true);
    return;
  }
  if (state.round?.index !== msg.index) return; // nel frattempo è cambiato qualcosa
  state.round.game = game;
  state.round.params = game.createParams(seededRandom(msg.seed), msg.difficulty);
}

function showCountdown(entry, msg) {
  currentScreen = "countdown";
  const net = state.net;
  const number = el("div", { class: "big", text: "" });
  const area = el("div", { class: "game-area" }, [
    el("div", { class: "hint", text: `Manche ${msg.index + 1} di ${msg.total} · ${difficultyLabel(msg.difficulty)}` }),
    el("div", { text: `${entry?.icon || ""} ${entry?.title || msg.gameId}` }),
    el("div", { class: "hint", text: entry?.description || "" }),
    number,
  ]);
  app.replaceChildren(area);

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
  if (!round || !net) return;
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
  if (!round || !round.game || currentScreen === "results") return;
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

async function showResults(msg) {
  currentScreen = "results";
  const net = state.net;
  const round = state.round;
  round?.game?.unmount();

  const game = round?.game?.id === msg.gameId ? round.game : await loadGame(msg.gameId);
  if (!state.net) return;

  if (!net.isHost && state.challenge) {
    state.challenge.standings = new Map(msg.standings.map((s) => [s.id, { name: s.name, points: s.points }]));
    state.challenge.history.push({ gameId: msg.gameId, ranking: msg.ranking });
  }

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

  const cards = [el("div", { class: "card" }, [el("h2", { text: `${game.icon} ${game.title}` }), roundList])];

  if (solo) {
    const rec = getRecord(game.id, state.challenge.difficulty);
    cards.push(el("p", { text: rec ? `Il tuo record: ${rec.text}` : "" }));
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
    el("button", { text: "Abbandona", class: "link", onclick: () => { leaveRoom(); showHome(); } })
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
  sfx.play("fanfare");
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
          return el("li", {}, [
            el("span", { class: "pos", text: String(i + 1) }),
            el("span", { text: `${entry?.icon || ""} ${entry?.title || h.gameId}` }),
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
      state.round?.game?.unmount();
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
  // Quando si attiva una versione nuova, ricarica una volta per usarla subito.
  const hadController = !!navigator.serviceWorker.controller; // false alla prima installazione
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading || !hadController) return;
    if (currentScreen !== "home") return; // mai a metà partita
    reloading = true;
    location.reload();
  });
}

showHome();
