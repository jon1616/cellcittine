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
import { toast } from "../ui.js";
import { rivals } from "../story.js";
import { getClientId } from "../storage.js";

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
    el("p", { class: "small", text: `✨ Stelle raccolte: ${s.stars} su ${s.starsMax}${s.experts ? ` · Esperto sbloccato in ${s.experts} ${s.experts === 1 ? "minigioco" : "minigiochi"}` : ""}` }),
    s.weeks ? el("p", { class: "small", text: `🗓️ Settimane con tutte le missioni: ${s.weeks}` }) : el("span"),
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

  const riv = rivals(getClientId()).slice(0, 5);
  const rivalsCard = el("div", { class: "card" }, [
    el("h2", { text: "Rivali" }),
    riv.length
      ? el("ol", { class: "ranking compact" }, riv.map((r, i) => el("li", {}, [
          el("span", { class: "pos", text: String(i + 1) }),
          el("span", { class: "who" }, [el("span", { text: r.name })]),
          el("span", { class: "score", text: `${r.together} ${r.together === 1 ? "sfida" : "sfide"} · ${r.myWins} – ${r.theirWins}` }),
        ])))
      : el("p", { class: "small", text: "Gioca in gruppo: qui vedrai con chi giochi di più e il bilancio testa a testa." }),
    riv.length ? el("p", { class: "small", text: "Bilancio: le volte che sei arrivato davanti a quella persona contro le volte che è arrivata davanti lei." }) : el("span"),
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

  const share = el("button", { text: "📤 Condividi le statistiche", class: "secondary small-btn" });
  share.addEventListener("click", async () => {
    const lines = [
      `Cellcittine · le statistiche di ${(localStorage.getItem("name") || "").trim() || "chi gioca"}`,
      `🏅 ${t.title}`,
      `Manche ${s.rounds} · Sfide ${s.challenges} · Vittorie ${s.victories} · Record ${s.records}`,
      cats.length ? `Punti forti: ${cats.slice(0, 3).map((c) => `${c.icon} ${c.label} ${c.avg}%`).join(" · ")}` : null,
      `Traguardi ${unlocked.length}/${ACHIEVEMENTS.length}${unlocked.length ? `: ${unlocked.slice(0, 5).map((a) => a.icon).join(" ")}` : ""}`,
      s.dailies ? `Sfida del giorno: miglior totale ${formatPoints(s.dailyBest)}${s.streak > 1 ? ` · 🔥 ${s.streak} giorni di fila` : ""}` : null,
      "https://jon1616.github.io/cellcittine/",
    ].filter(Boolean);
    const text = lines.join("\n");
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (_) { /* copia */ } }
    try { await navigator.clipboard.writeText(text); toast("Statistiche copiate: incollale in chat"); } catch (_) { toast("Non riesco a copiare"); }
  });

  show(
    el("h2", { text: "Le mie statistiche" }),
    head,
    strengths,
    games,
    rivalsCard,
    badges,
    share,
    el("div", { class: "spacer" }),
    el("button", { text: "Indietro", class: "secondary", onclick: () => showHome() })
  );
}
