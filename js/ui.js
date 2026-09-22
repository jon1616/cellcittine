/*
  Mattoni dell'interfaccia usati da più schermate: cambio schermata, riga di
  stato, avviso breve (toast), coriandoli, icone e righe dei minigiochi,
  selettori. Nessuna logica di gioco qui.
*/

import { el } from "./utils.js";
import { sfx } from "./audio.js";
import { state } from "./state.js";
import { syncBackGuard } from "./nav.js";
import { DIFFICULTY_OPTIONS, getRecord } from "./storage.js";
import { PACES, isNew } from "./games/catalog.js";

const app = document.getElementById("app");

// ---------------------------------------------------------------
// Schermate
// ---------------------------------------------------------------

// Sostituisce la schermata corrente con una nuova (menu: musica accesa).
export function show(...children) {
  app.replaceChildren(el("div", { class: "screen" }, children));
  sfx.setScene("menu");
  syncBackGuard();
}

// Come show(), ma con una classe in più e senza avvolgere in un nuovo .screen
// se il chiamante vuole riusare i suoi elementi (scelta minigiochi).
export function showRaw(node) {
  app.replaceChildren(node);
  syncBackGuard();
}

export function appRoot() {
  return app;
}

// ---------------------------------------------------------------
// Riga di stato: ogni schermata ne crea una e diventa il bersaglio di setStatus()
// ---------------------------------------------------------------

let statusEl = null;

export function statusLine(text = "", isError = false) {
  statusEl = el("div", { class: `status${isError ? " error" : ""}`, text });
  return statusEl;
}

export function setStatus(text, isError = false) {
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.classList.toggle("error", isError);
  }
}

// ---------------------------------------------------------------
// Avviso breve in basso (es. "Premi ancora ◀ per uscire")
// ---------------------------------------------------------------

let toastEl = null;
let toastTimer = null;

export function toast(text) {
  if (!toastEl) {
    toastEl = el("div", { class: "toast" });
    document.body.append(toastEl);
  }
  toastEl.textContent = text;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

export function hideToast() {
  toastEl?.classList.remove("show");
}

// ---------------------------------------------------------------
// Pioggia di coriandoli (podio). Puramente decorativa, si rimuove da sola.
// ---------------------------------------------------------------

export function confetti(count = 90) {
  const colors = ["#ffb703", "#fb5607", "#43d17a", "#ff4d6d", "#36cfc9", "#f6f3ff"];
  const layer = el("div", { class: "confetti" });
  for (let i = 0; i < count; i++) {
    const piece = el("i");
    piece.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-duration:${2.2 + Math.random() * 2}s;animation-delay:${Math.random() * 1.2}s;transform:rotate(${Math.random() * 360}deg);width:${6 + Math.random() * 6}px;height:${10 + Math.random() * 8}px;`;
    layer.append(piece);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 5000);
}

// ---------------------------------------------------------------
// Colore per persona (indice assegnato dall'host in ordine di ingresso)
// ---------------------------------------------------------------

export const PLAYER_COLORS = ["#ffb703", "#36cfc9", "#ff4d6d", "#8ac926", "#c77dff", "#ff924c", "#1982c4", "#f15bb5"];

export function playerColor(index) {
  return PLAYER_COLORS[(Number.isInteger(index) ? index : 0) % PLAYER_COLORS.length];
}

// Pallino colorato davanti al nome; se la persona (id) ha un simbolo, il simbolo nel suo colore
export function colorDot(index, id = null) {
  const avatar = id ? state.net?.players.find((p) => p.id === id)?.avatar : "";
  if (avatar) return el("span", { class: "avatar-dot", style: `--c: ${playerColor(index)}`, text: avatar });
  return el("span", { class: "dot-color", style: `--c: ${playerColor(index)}` });
}

// ---------------------------------------------------------------
// Testi
// ---------------------------------------------------------------

export function difficultyLabel(id) {
  return DIFFICULTY_OPTIONS.find((d) => d.id === id)?.label || id;
}

// "⏱ 20 s · Veloce · tocco"
export function metaLine(g) {
  return [`⏱ ${g.duration} s`, PACES[g.pace] || g.pace, g.input].join(" · ");
}

// ---------------------------------------------------------------
// Minigiochi: icona, intestazione, riga compatta
// ---------------------------------------------------------------

// Icona di un minigioco: immagine disegnata se c'è, altrimenti l'emoji.
export function gameIcon(g, cls = "game-icon") {
  if (g?.image) return el("img", { class: cls, src: g.image, alt: "", width: "160", height: "160" });
  return el("span", { class: cls + " emoji", text: g?.icon || "" });
}

// Titolo con icona (per intestazioni)
export function gameHeading(g, tag = "h2") {
  return el(tag, { class: "with-icon" }, [gameIcon(g, "heading-icon"), el("span", { text: g?.title || "" })]);
}

// Riga compatta di un minigioco, usata in catalogo e nella scelta.
//   selected: null (nessuna spunta) | true | false
//   onClick: tocco sulla riga · onInfo: pulsante "i" · onFav: stellina (fav = stato attuale)
export function gameRow(g, { selected = null, onClick, onInfo, onFav = null, fav = false } = {}) {
  const rec = getRecord(g.id, state.config.difficulty === "crescente" ? "normale" : state.config.difficulty);
  const row = el("div", { class: `game-row${selected === true ? " on" : ""}${selected === false ? " off" : ""}${onFav ? " with-fav" : ""}` }, [
    selected === null ? el("span") : el("span", { class: "check", text: selected ? "✓" : "" }),
    gameIcon(g),
    el("div", { class: "game-text" }, [
      el("div", { class: "game-title-row" }, [
        el("span", { class: "game-name", text: g.title }),
        isNew(g) ? el("span", { class: "badge new", text: "NUOVO" }) : el("span"),
      ]),
      el("div", { class: "game-desc", text: g.description }),
      el("div", { class: "game-meta", text: metaLine(g) + (rec ? ` · ★ ${rec.text}` : "") }),
    ]),
    onFav ? el("button", { class: `fav${fav ? " on" : ""}`, text: fav ? "★" : "☆", title: "Preferito", onclick: (ev) => { ev.stopPropagation(); onFav(); } }) : el("span"),
    onInfo ? el("button", { class: "info", text: "i", onclick: (ev) => { ev.stopPropagation(); onInfo(); } }) : el("span"),
  ]);
  if (onClick) row.addEventListener("click", onClick);
  return row;
}

// ---------------------------------------------------------------
// Selettore a segmenti (manche, difficoltà)
// ---------------------------------------------------------------

export function segmented(options, current, onPick) {
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
