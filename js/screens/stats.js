/*
  Le mie statistiche: titolo, totali, punti forti per categoria, minigiochi
  più giocati e da scoprire, traguardi sbloccati e da sbloccare.
*/

import { el } from "../utils.js";
import { setScreen } from "../state.js";
import { show, gameIcon } from "../ui.js";
import { getEntry } from "../games/catalog.js";
import { summary, categoryStrengths, mostPlayed, neverPlayed, playerTitle, ACHIEVEMENTS, unlockedAchievements, checkAchievements } from "../stats.js";
import { formatPoints } from "../daily.js";
import { showHome } from "./home.js";

function stat(num, label) {
  return el("div", { class: "hist-stat" }, [el("div", { class: "hist-num", text: String(num) }), el("div", { class: "hist-lbl", text: label })]);
}

function minutes(seconds) {
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function showStats() {
  setScreen("stats");
  checkAchievements(); // traguardi maturati nel frattempo (senza avviso)
  const s = summary();
  const t = playerTitle();
  const cats = categoryStrengths();
  const top = mostPlayed(5);
  const never = neverPlayed();
  const done = unlockedAchievements();

  const head = el("div", { class: "card stats-head" }, [
    el("div", { class: "stats-title", text: t.title }),
    el("p", { class: "small", text: t.why }),
    el("div", { class: "hist-summary" }, [stat(s.rounds, s.rounds === 1 ? "manche" : "manche"), stat(s.challenges, s.challenges === 1 ? "sfida" : "sfide"), stat(s.victories, s.victories === 1 ? "vittoria" : "vittorie")]),
    el("div", { class: "hist-summary" }, [stat(s.records, "record"), stat(s.perfect, s.perfect === 1 ? "perfetta" : "perfette"), stat(minutes(s.seconds), "di gioco")]),
    s.dailies ? el("p", { class: "small", text: `Sfida del giorno: ${s.dailies} ${s.dailies === 1 ? "fatta" : "fatte"} · miglior totale ${formatPoints(s.dailyBest)}${s.streak > 1 ? ` · 🔥 ${s.streak} giorni di fila` : ""}` }) : el("span"),
  ]);

  const strengths = el("div", { class: "card" }, [
    el("h2", { text: "Punti forti" }),
    cats.length
      ? el("div", { class: "bars" }, cats.map((c) => el("div", { class: "bar-row" }, [
          el("span", { class: "bar-label", text: `${c.icon} ${c.label}` }),
          el("span", { class: "bar" }, [el("i", { style: `width: ${c.avg}%; --c: ${c.color}` })]),
          el("span", { class: "bar-val", text: `${c.avg}%` }),
        ])))
      : el("p", { class: "small", text: "Gioca qualche manche: qui vedrai la media per categoria." }),
    cats.length ? el("p", { class: "small", text: "Media della prestazione nelle manche giocate, per categoria." }) : el("span"),
  ]);

  const games = el("div", { class: "card" }, [
    el("h2", { text: "I più giocati" }),
    top.length
      ? el("ol", { class: "ranking compact" }, top.map((g, i) => {
          const entry = getEntry(g.id);
          return el("li", {}, [
            el("span", { class: "pos", text: String(i + 1) }),
            el("span", { class: "with-icon" }, [gameIcon(entry, "list-icon"), el("span", { text: entry?.title || g.id })]),
            el("span", { class: "score", text: `${g.n}× · media ${g.avg}%` }),
          ]);
        }))
      : el("p", { class: "small", text: "Nessuna manche giocata ancora." }),
    never.length
      ? el("p", { class: "small", text: `Da scoprire: ${never.length} ${never.length === 1 ? "minigioco mai provato" : "minigiochi mai provati"}${never.length <= 6 ? ` (${never.map((id) => getEntry(id)?.title).join(", ")})` : ""}.` })
      : el("p", { class: "small", text: "Hai provato tutti i minigiochi!" }),
  ]);

  const unlocked = ACHIEVEMENTS.filter((a) => done[a.id]);
  const locked = ACHIEVEMENTS.filter((a) => !done[a.id]);
  const badges = el("div", { class: "card" }, [
    el("h2", { text: `Traguardi · ${unlocked.length} di ${ACHIEVEMENTS.length}` }),
    el("div", { class: "badges" }, [...unlocked, ...locked].map((a) => el("div", { class: `badge-card${done[a.id] ? " on" : ""}` }, [
      el("span", { class: "badge-icon", text: done[a.id] ? a.icon : "🔒" }),
      el("span", { class: "badge-text" }, [el("span", { class: "badge-title", text: a.title }), el("span", { class: "badge-desc", text: a.desc })]),
    ]))),
  ]);

  show(
    el("h2", { text: "Le mie statistiche" }),
    head,
    strengths,
    games,
    badges,
    el("div", { class: "spacer" }),
    el("button", { text: "Indietro", class: "secondary", onclick: () => showHome() })
  );
}
