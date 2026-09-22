/*
  Catalogo (solo consultazione), scheda di un minigioco, elenco dei
  minigiochi della sfida (per chi è ospite).
*/

import { el } from "../utils.js";
import { state, setScreen } from "../state.js";
import { show, gameIcon, gameRow } from "../ui.js";
import { CATALOG, CATEGORIES, getCategory, getEntry, isNew, PACES } from "../games/catalog.js";
import { DIFFICULTIES, getRecord, EXPERT_UNLOCK } from "../storage.js";
import { isExpertUnlocked, expertProgress } from "../stats.js";
import { showHome } from "./home.js";
import { showLobby } from "./lobby.js";
import { playQuick } from "../room.js";

export function showCatalog() {
  setScreen("catalog");
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

// Scheda completa. `back` = dove torna il pulsante Indietro (e il tasto ◀).
export function showGameInfo(g, back) {
  setScreen("info");
  state.infoBack = back;
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
  const records = [...DIFFICULTIES, { id: "esperto", label: "Esperto" }].map((d) => {
    const r = getRecord(g.id, d.id);
    return d.id === "esperto" && !r && !isExpertUnlocked(g.id) ? null : `${d.label}: ${r ? r.text : "—"}`;
  }).filter(Boolean).join(" · ");
  const expert = isExpertUnlocked(g.id) ? "🔓 Esperto sbloccato: come Difficile, con il 25% di tempo in meno." : `🔒 Esperto: ${expertProgress(g.id)} su ${EXPERT_UNLOCK} risultati oltre l'80% a Difficile.`;

  show(
    el("div", { class: "info-head" }, [
      gameIcon(g, "info-icon"),
      el("h2", { text: g.title }),
      isNew(g) ? el("span", { class: "badge new", text: "NUOVO" }) : el("span"),
    ]),
    el("div", { class: "card" }, [el("p", { class: "howto", text: g.howTo })]),
    el("div", { class: "card" }, rows.map(([k, v]) =>
      el("div", { class: "info-row" }, [el("span", { class: "info-k", text: k }), el("span", { class: "info-v", text: v })])
    )),
    el("div", { class: "card" }, [el("div", { class: "label", text: "I tuoi record" }), el("p", { class: "small", text: records }), el("p", { class: "small", text: expert })]),
    state.net ? el("span") : el("button", { text: "▶ Prova subito", onclick: () => playQuick(g.id) }),
    el("div", { class: "spacer" }),
    el("button", { text: "Indietro", class: "secondary", onclick: back })
  );
}

// Elenco di sola lettura dei minigiochi della sfida (per chi è ospite).
export function showSelectionList(games) {
  setScreen("list");
  show(
    el("h2", { text: "Minigiochi della sfida" }),
    el("div", { class: "card" }, games.map((id) => getEntry(id)).filter(Boolean).map((g) => gameRow(g, { onClick: () => showGameInfo(g, () => showSelectionList(games)) }))),
    el("div", { class: "spacer" }),
    el("button", { text: "Indietro", class: "secondary", onclick: () => showLobby() })
  );
}
