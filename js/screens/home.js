/*
  Home: nome, tre pulsanti (crea stanza, entra, allenamento), collegamenti
  (record, catalogo, suoni, musica) e scelta del tema.
*/

import { el } from "../utils.js";
import { sfx } from "../audio.js";
import { state, setScreen } from "../state.js";
import { show, statusLine, setStatus } from "../ui.js";
import { CATALOG } from "../games/catalog.js";
import { availableThemes, getChoice, setChoice, seasonalTheme } from "../theme.js";
import { createRoom, playSolo } from "../room.js";
import { showJoin } from "./join.js";
import { showRecords } from "./records.js";
import { showCatalog } from "./catalog.js";

export function showHome(message = "") {
  setScreen("home");
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

  const status = statusLine(message, !!message);
  const hero = el("div", { class: "hero" }, [el("img", { src: "assets/home-hero.jpg", alt: "", width: "1000", height: "521" })]);

  show(
    hero,
    el("h1", { class: "home-title", text: "CELLCITTINE" }),
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
      el("button", {
        text: sfx.isMusicEnabled() ? "🎵 Musica" : "🎵 Musica (off)",
        class: "link",
        onclick: () => { sfx.setMusicEnabled(!sfx.isMusicEnabled()); showHome(); },
      }),
    ]),
    themeRow(),
    status
  );
}

// Scelta del tema: compare solo quando esiste più di un tema.
function themeRow() {
  const themes = availableThemes();
  if (themes.length < 2) return el("span");
  const choice = getChoice();
  const seasonal = seasonalTheme();
  const chip = (id, label) => el("button", { class: `chip small${choice === id ? " on" : ""}`, text: label, onclick: () => { setChoice(id); showHome(); } });
  return el("div", { class: "theme-row" }, [
    chip("auto", seasonal ? `🗓️ Automatico (${seasonal.name})` : "🗓️ Automatico"),
    ...themes.map((t) => chip(t.id, `${t.icon} ${t.name}`)),
  ]);
}
