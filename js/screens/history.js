/*
  Storico: le sfide giocate su questo telefono (in gruppo e in allenamento),
  con data, partecipanti e punti, chi ha vinto, premi. In cima il conteggio.
*/

import { el } from "../utils.js";
import { setScreen } from "../state.js";
import { show, colorDot, difficultyLabel } from "../ui.js";
import { getHistory, clearHistory } from "../storage.js";
import { getEntry } from "../games/catalog.js";
import { showHome } from "./home.js";

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function entryCard(e) {
  const meId = e.meId; // chi ero io in quella sfida (salvato con la voce)
  const head = el("div", { class: "hist-head" }, [
    el("span", { class: "hist-date", text: formatDate(e.at) }),
    el("span", { class: "hist-tag", text: e.solo ? "Allenamento" : `Stanza ${e.code || ""}` }),
  ]);
  const meta = el("div", { class: "hist-meta", text: `${e.rounds} ${e.rounds === 1 ? "manche" : "manche"} · ${difficultyLabel(e.difficulty)} · ${[...new Set(e.games)].map((id) => getEntry(id)?.title || id).join(", ")}` });

  const parts = [head, meta];
  if (e.solo) {
    parts.push(el("div", { class: "hist-players" }, [el("span", { class: "who" }, [el("span", { text: e.players[0]?.name || "" })])]));
  } else {
    parts.push(el("div", { class: "hist-players" }, e.players.map((p, i) =>
      el("span", { class: `who hist-player${p.id === meId ? " me" : ""}` }, [
        el("span", { text: i === 0 ? "🏆 " : "" }),
        colorDot(p.color),
        el("span", { text: `${p.name} ${p.points} pt` }),
      ])
    )));
  }
  if (e.awards?.length) {
    parts.push(el("div", { class: "hist-awards", text: e.awards.map((a) => `${a.icon} ${a.title}: ${a.name}`).join(" · ") }));
  }
  return el("div", { class: `card hist${!e.solo && e.winnerId === meId ? " won" : ""}` }, parts);
}

export function showHistory() {
  setScreen("history");
  const list = getHistory();
  const group = list.filter((e) => !e.solo);
  const wins = group.filter((e) => e.winnerId && e.winnerId === e.meId).length;
  const solo = list.length - group.length;

  const summary = el("div", { class: "card" }, [
    el("div", { class: "hist-summary" }, [
      el("div", { class: "hist-stat" }, [el("div", { class: "hist-num", text: String(group.length) }), el("div", { class: "hist-lbl", text: group.length === 1 ? "sfida" : "sfide" })]),
      el("div", { class: "hist-stat" }, [el("div", { class: "hist-num", text: String(wins) }), el("div", { class: "hist-lbl", text: wins === 1 ? "vittoria" : "vittorie" })]),
      el("div", { class: "hist-stat" }, [el("div", { class: "hist-num", text: String(solo) }), el("div", { class: "hist-lbl", text: solo === 1 ? "allenamento" : "allenamenti" })]),
    ]),
  ]);

  const clear = el("button", { text: "Cancella lo storico", class: "link" });
  clear.addEventListener("click", () => {
    if (clear.dataset.armed) { clearHistory(); showHistory(); return; }
    clear.dataset.armed = "1";
    clear.textContent = "Sicuro? Tocca ancora per cancellare";
    setTimeout(() => { delete clear.dataset.armed; clear.textContent = "Cancella lo storico"; }, 3000);
  });

  show(
    el("h2", { text: "Storico" }),
    summary,
    ...(list.length ? list.map((e) => entryCard(e)) : [el("p", { text: "Nessuna sfida giocata ancora. Le sfide finite compaiono qui." })]),
    list.length ? clear : el("span"),
    el("div", { class: "spacer" }),
    el("button", { text: "Indietro", class: "secondary", onclick: () => showHome() })
  );
}
