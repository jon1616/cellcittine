/*
  Scelta dei minigiochi (host): ricerca, filtri, sezioni per categoria con
  spunte, pannello fisso in basso con "Fatto". La selezione diventa effettiva
  solo con "Fatto" (o col tasto ◀, che fa lo stesso).
*/

import { el } from "../utils.js";
import { sfx } from "../audio.js";
import { state, setScreen } from "../state.js";
import { showRaw, gameRow } from "../ui.js";
import { CATALOG, CATEGORIES, isNew, matches } from "../games/catalog.js";
import { getFavorites, toggleFavorite } from "../storage.js";
import { updateConfig, showLobby } from "./lobby.js";
import { showGameInfo } from "./catalog.js";

export function showPicker() {
  setScreen("picker");
  state.picker = {
    selected: new Set(state.config.games),
    query: "",
    filter: "tutti", // "tutti" | "nuovi" | "scelti" | <categoria>
    collapsed: new Set(),
    done: null,      // conferma la selezione (impostata sotto)
  };

  const search = el("input", { type: "text", class: "search", placeholder: "Cerca (nome, abilità, tema…)", autocomplete: "off" });
  search.addEventListener("input", () => { state.picker.query = search.value; renderList(); });

  const filters = el("div", { class: "chips scroll filters" });
  const list = el("div", { class: "pick-list" });
  const footer = el("div", { class: "pick-footer" });

  // Conferma la selezione e torna alla stanza (anche col tasto indietro).
  state.picker.done = () => {
    const p = state.picker;
    updateConfig({ games: CATALOG.filter((g) => p.selected.has(g.id)).map((g) => g.id) }, { rerender: false });
    showLobby();
  };

  const renderFilters = () => {
    const p = state.picker;
    const mk = (id, label) =>
      el("button", { class: `chip small${p.filter === id ? " on" : ""}`, text: label, onclick: () => { p.filter = id; renderFilters(); renderList(); } });
    const newCount = CATALOG.filter(isNew).length;
    const favCount = getFavorites().length;
    filters.replaceChildren(
      mk("tutti", "Tutti"),
      mk("scelti", `Scelti (${p.selected.size})`),
      mk("preferiti", `★ Preferiti (${favCount})`),
      ...(newCount ? [mk("nuovi", `✨ Nuovi (${newCount})`)] : []),
      ...CATEGORIES.map((c) => mk(c.id, `${c.icon} ${c.label}`))
    );
  };

  const visibleGames = () => {
    const p = state.picker;
    return CATALOG.filter((g) => {
      if (p.filter === "nuovi" && !isNew(g)) return false;
      if (p.filter === "scelti" && !p.selected.has(g.id)) return false;
      if (p.filter === "preferiti" && !getFavorites().includes(g.id)) return false;
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
      el("button", { text: `Fatto · ${p.selected.size}`, onclick: () => state.picker.done() })
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
      const favs = getFavorites();
      const rows = collapsed ? [] : games.map((g) =>
        gameRow(g, {
          selected: p.selected.has(g.id),
          fav: favs.includes(g.id),
          onFav: () => { toggleFavorite(g.id); renderList(); },
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
    setScreen("picker");
    sfx.setScene("menu");
    showRaw(el("div", { class: "screen picker" }, [el("h2", { text: "Scegli i minigiochi" }), search, filters, list, footer]));
    search.value = state.picker.query;
    renderList();
  };

  showPickerAgain();
}
