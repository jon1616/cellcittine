/*
  Far conoscere il gioco: WhatsApp, email, menu di condivisione del telefono, copia del link.
  Condivide sempre l'indirizzo pulito del gioco (senza ?stanza= o ?giorno=).
*/

import { el } from "./utils.js";
import { toast } from "./ui.js";
import { CATALOG } from "./games/catalog.js";

export function gameUrl() {
  return `${location.origin}${location.pathname}`.replace(/index\.html$/, "");
}

function gameText() {
  return `Prova CELLCITTINE! ${CATALOG.length} minigiochi per telefono, da soli o in gruppo con gli amici. Gratis, senza account e senza scaricare niente:`;
}

export function whatsappHref() {
  return `https://wa.me/?text=${encodeURIComponent(`${gameText()} ${gameUrl()}`)}`;
}

export function mailHref() {
  const subject = "Ti consiglio un gioco: CELLCITTINE";
  const body = `Ciao!\n\n${gameText()}\n${gameUrl()}\n\nSi apre dal browser del telefono e si può installare come un'app.`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function shareOther() {
  const url = gameUrl();
  if (navigator.share) {
    try { await navigator.share({ title: "CELLCITTINE", text: gameText(), url }); return; } catch (err) { if (err?.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(`${gameText()} ${url}`);
    toast("Link del gioco copiato: incollalo dove vuoi");
  } catch (_) {
    toast(url);
  }
}

// Riga di pulsanti: WhatsApp, Email, Altro (menu del telefono, o copia del link)
export function shareButtons() {
  return el("div", { class: "share-row" }, [
    el("a", { class: "share-btn wa", href: whatsappHref(), target: "_blank", rel: "noopener" }, [el("span", { class: "si", text: "💬" }), el("span", { text: "WhatsApp" })]),
    el("a", { class: "share-btn mail", href: mailHref() }, [el("span", { class: "si", text: "✉️" }), el("span", { text: "Email" })]),
    el("button", { class: "share-btn other", onclick: shareOther }, [el("span", { class: "si", text: navigator.share ? "📤" : "🔗" }), el("span", { text: navigator.share ? "Altro" : "Copia link" })]),
  ]);
}

// Riquadro completo per la home
export function shareCard() {
  return el("div", { class: "card tone share-card", style: "--c: var(--teal)" }, [
    el("div", { class: "label", text: "Fai conoscere il gioco" }),
    el("p", { class: "small", text: "Manda il link a chi vuoi: si gioca subito dal browser, senza account." }),
    shareButtons(),
  ]);
}
