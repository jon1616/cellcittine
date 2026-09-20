/*
  Alto o basso: una carta con un numero da 1 a 100. Il prossimo sarà più alto
  o più basso? 20 secondi, +1 a risposta giusta, -1 a quella sbagliata.
  La sequenza di carte è uguale per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer } from "./shell.js";

const DURATION = 20;
const MAX = { facile: 20, normale: 100, difficile: 100 };

let shell = null;
let stopTimer = null;
let flipTimer = null;

export default {
  id: "altobasso",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const max = MAX[difficulty] || MAX.normale;
    const cards = [1 + Math.floor(rng() * max)];
    while (cards.length < 60) {
      let n = 1 + Math.floor(rng() * max);
      if (n === cards[cards.length - 1]) n = n === max ? n - 1 : n + 1;
      cards.push(n);
    }
    return { cards, max };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "punto" : "punti"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const { cards, max } = ctx.params;
    shell = createShell(container, { title: "Alto o basso", hint: `Numeri da 1 a ${max} · Punti: 0` });
    const card = el("div", { class: "hl-card", text: String(cards[0]) });
    const prev = el("div", { class: "hl-prev", text: "" });
    const streakEl = el("div", { class: "hl-streak", text: "" });
    const btnHigh = el("button", { class: "hl-btn high", text: "▲ Più alto" });
    const btnLow = el("button", { class: "hl-btn low", text: "▼ Più basso" });
    shell.body.append(prev, card, streakEl, el("div", { class: "hl-buttons" }, [btnHigh, btnLow]));

    let index = 0;
    let score = 0, right = 0, wrong = 0, streak = 0, bestStreak = 0;
    let locked = false;
    let done = false;

    const guess = (high) => {
      if (locked || done) return;
      locked = true;
      const cur = cards[index % cards.length];
      const next = cards[(index + 1) % cards.length];
      const ok = high ? next > cur : next < cur;
      prev.textContent = `prima: ${cur}`;
      card.textContent = String(next);
      card.className = `hl-card ${ok ? "ok" : "ko"}`;
      if (ok) { score++; right++; streak++; bestStreak = Math.max(bestStreak, streak); sfx.play("good"); vibrate(10); }
      else { score = Math.max(0, score - 1); wrong++; streak = 0; sfx.play("bad"); vibrate([60, 30, 60]); }
      streakEl.textContent = streak >= 3 ? `🔥 ${streak} di fila` : "";
      shell.setHint(`Numeri da 1 a ${max} · Punti: ${score}`);
      index++;
      flipTimer = setTimeout(() => { card.className = "hl-card"; locked = false; }, 350);
    };
    btnHigh.addEventListener("pointerdown", (ev) => { ev.preventDefault(); guess(true); });
    btnLow.addEventListener("pointerdown", (ev) => { ev.preventDefault(); guess(false); });

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => {
        done = true;
        shell.showDone(this.formatScore(score));
        ctx.onFinish(score, `${right} giuste, ${wrong} sbagliate · serie migliore ${bestStreak}`);
      }
    );
  },

  unmount() {
    stopTimer?.();
    clearTimeout(flipTimer);
    shell?.remove();
    shell = null;
  },
};
