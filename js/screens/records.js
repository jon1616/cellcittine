/*
  I miei record: una tabella per categoria, una riga per minigioco,
  una colonna per difficoltà.
*/

import { el } from "../utils.js";
import { setScreen } from "../state.js";
import { show, gameIcon } from "../ui.js";
import { CATALOG, CATEGORIES } from "../games/catalog.js";
import { DIFFICULTIES, getRecord } from "../storage.js";
import { showHome } from "./home.js";

export function showRecords() {
  setScreen("records");
  const sections = CATEGORIES.map((cat) => {
    const games = CATALOG.filter((g) => g.category === cat.id);
    if (games.length === 0) return null;
    const rows = games.map((g) =>
      el("div", { class: "rec-row" }, [
        el("span", { class: "rec-name with-icon" }, [gameIcon(g, "list-icon"), el("span", { text: g.title })]),
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
