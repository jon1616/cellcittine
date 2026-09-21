/*
  Home: nome, tre pulsanti (crea stanza, entra, allenamento), collegamenti
  (record, catalogo, suoni, musica) e scelta del tema.
*/

import { el } from "../utils.js";
import { sfx } from "../audio.js";
import { state, setScreen } from "../state.js";
import { show, statusLine, setStatus, toast } from "../ui.js";
import { CATALOG } from "../games/catalog.js";
import { availableThemes, getChoice, setChoice, seasonalTheme } from "../theme.js";
import { createRoom, playSolo, joinRoom } from "../room.js";
import { showJoin } from "./join.js";
import { showRecords } from "./records.js";
import { showCatalog } from "./catalog.js";

// message: riga di stato (per default in rosso: è quasi sempre un errore)
export function showHome(message = "", isError = !!message) {
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

  const status = statusLine(message, isError);
  const hero = el("div", { class: "hero" }, [el("img", { src: "assets/home-hero.jpg", alt: "", width: "1000", height: "521" })]);

  show(
    hero,
    el("h1", { class: "home-title", text: "CELLCITTINE" }),
    el("p", { text: "Sfide a minigiochi, da soli o in gruppo" }),
    inviteCard(requireName),
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
    installRow(),
    status
  );
}

// Installazione sulla schermata Home: pulsante quando il browser lo permette
// (Android/Chrome), istruzioni su iPhone; niente se l'app è già installata.
function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function installRow() {
  if (isInstalled()) return el("span");
  if (state.installPrompt) {
    return el("button", {
      text: "📲 Installa l'app sul telefono",
      class: "link install",
      onclick: async () => {
        const ev = state.installPrompt;
        state.installPrompt = null;
        try { await ev.prompt(); await ev.userChoice; } catch (_) { /* rifiutato o non disponibile */ }
        showHome();
      },
    });
  }
  if (isIOS()) {
    return el("button", {
      text: "📲 Installa l'app sul telefono",
      class: "link install",
      onclick: () => toast("Su iPhone: tocca Condividi (il quadrato con la freccia) → “Aggiungi alla schermata Home”"),
    });
  }
  return el("span");
}

// Invito arrivato da un link (?stanza=XXXX): riquadro in evidenza con "Entra".
function inviteCard(requireName) {
  const code = state.pendingCode;
  if (!code) return el("span");
  const enter = el("button", { text: `Entra nella stanza ${code}` });
  enter.addEventListener("click", async () => {
    if (!requireName()) return;
    enter.disabled = true;
    setStatus("Mi collego…");
    try {
      await joinRoom(code);
      state.pendingCode = null;
    } catch (err) {
      enter.disabled = false;
      setStatus(err.message, true);
    }
  });
  return el("div", { class: "card invite" }, [
    el("div", { class: "label", text: "Invito" }),
    el("p", { text: state.name ? "Ti hanno invitato a giocare!" : "Ti hanno invitato a giocare! Scrivi il tuo nome qui sotto, poi entra." }),
    enter,
    el("button", { text: "Ignora l'invito", class: "link", onclick: () => { state.pendingCode = null; showHome(); } }),
  ]);
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
