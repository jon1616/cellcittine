/*
  Home: nome, tre pulsanti (crea stanza, entra, allenamento), collegamenti
  (record, catalogo, suoni, musica) e scelta del tema.
*/

import { el, isVibrationEnabled, setVibrationEnabled, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { state, setScreen } from "../state.js";
import { show, statusLine, setStatus, toast } from "../ui.js";
import { CATALOG } from "../games/catalog.js";
import { availableThemes, getChoice, setChoice, seasonalTheme } from "../theme.js";
import { createRoom, playSolo, joinRoom, playDaily } from "../room.js";
import { dailyKey, dailyLabel, todayResult, dailyStreak, formatPoints, shareText, DAILY_ROUNDS } from "../daily.js";
import { showJoin } from "./join.js";
import { showRecords } from "./records.js";
import { showCatalog } from "./catalog.js";
import { showHistory } from "./history.js";
import { showStats } from "./stats.js";
import { playerTitle, summary } from "../stats.js";
import { AVATARS, getAvatar, setAvatar, getLastRoom, forgetLastRoom } from "../storage.js";

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
    rejoinCard(requireName),
    el("div", { class: "card" }, [
      nameInput,
      avatarRow(),
      titleRow(),
      el("button", { text: "Crea una stanza", onclick: () => requireName() && createRoom() }),
      el("button", { text: "Entra con un codice", class: "secondary", onclick: () => requireName() && showJoin() }),
      el("button", { text: "Allenamento", class: "secondary", onclick: () => requireName() && playSolo() }),
    ]),
    dailyCard(requireName),
    el("div", { class: "links" }, [
      el("button", { text: "I miei record", class: "link", onclick: showRecords }),
      el("button", { text: "Storico", class: "link", onclick: showHistory }),
      el("button", { text: "📊 Statistiche", class: "link", onclick: showStats }),
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
      el("button", {
        text: isVibrationEnabled() ? "📳 Vibrazione" : "📳 Vibrazione (off)",
        class: "link",
        onclick: () => { setVibrationEnabled(!isVibrationEnabled()); vibrate(30); showHome(); },
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

// Ultima stanza (ospite) lasciata senza volerlo negli ultimi 10 minuti: "Rientra"
function rejoinCard(requireName) {
  const last = getLastRoom();
  if (!last || state.pendingCode || state.net) return el("span");
  const enter = el("button", { text: `Rientra nella stanza ${last.code}` });
  enter.addEventListener("click", async () => {
    if (!requireName()) return;
    enter.disabled = true;
    setStatus("Rientro…");
    try {
      await joinRoom(last.code);
    } catch (err) {
      forgetLastRoom();
      showHome(err.message);
    }
  });
  return el("div", { class: "card invite" }, [
    el("div", { class: "label", text: "Stanza di poco fa" }),
    el("p", { text: "Eri in una stanza: se si è chiusa l'app per sbaglio, puoi rientrare con lo stesso nome e i tuoi punti." }),
    enter,
    el("button", { text: "No, lascia perdere", class: "link", onclick: () => { forgetLastRoom(); showHome(); } }),
  ]);
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

// Simbolo personale: compare accanto al nome in stanza e nelle classifiche
function avatarRow() {
  const current = getAvatar();
  return el("div", { class: "avatar-row" }, AVATARS.map((a) => el("button", {
    class: `avatar-pick${a === current ? " on" : ""}`,
    text: a,
    title: "Il tuo simbolo",
    onclick: () => { setAvatar(a === current ? "" : a); showHome(); },
  })));
}

// Il titolo di chi gioca (dalle statistiche), sotto il nome: tocca per le statistiche
function titleRow() {
  const s = summary();
  if (s.rounds < 5) return el("span");
  const t = playerTitle();
  return el("button", { class: "chip small title-chip", text: `🏅 ${t.title} · ${s.rounds} manche`, onclick: showStats });
}

// Sfida del giorno: 5 minigiochi uguali per tutti, oggi. Fatta = punteggio e condivisione.
function dailyCard(requireName) {
  const key = dailyKey();
  const done = todayResult(key);
  const streak = dailyStreak();
  const head = el("div", { class: "daily-head" }, [
    el("span", { class: "daily-title", text: "📅 Sfida del giorno" }),
    el("span", { class: "daily-date", text: dailyLabel(key) }),
  ]);
  if (!done) {
    return el("div", { class: "card daily" }, [
      head,
      el("p", { class: "small", text: `${DAILY_ROUNDS} minigiochi, gli stessi per tutti oggi. Vale il primo tentativo.${streak ? ` 🔥 ${streak} ${streak === 1 ? "giorno" : "giorni"} di fila: continua la serie!` : ""}` }),
      el("button", { text: "Gioca la sfida di oggi", onclick: () => requireName() && playDaily() }),
    ]);
  }
  const share = el("button", { text: "📤 Condividi", class: "secondary small-btn" });
  share.addEventListener("click", async () => {
    const text = shareText(key, done);
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (_) { /* copia */ } }
    try { await navigator.clipboard.writeText(text); toast("Risultato copiato: incollalo in chat"); } catch (_) { toast("Non riesco a copiare"); }
  });
  return el("div", { class: "card daily done" }, [
    head,
    el("div", { class: "daily-score", text: `${formatPoints(done.total)} punti` }),
    el("p", { class: "small", text: `Fatta!${streak > 1 ? ` 🔥 ${streak} giorni di fila.` : ""} Domani ce n'è una nuova.` }),
    el("div", { class: "row-2" }, [
      share,
      el("button", { text: "🔁 Rigioca", class: "secondary small-btn", onclick: () => requireName() && playDaily() }),
    ]),
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
