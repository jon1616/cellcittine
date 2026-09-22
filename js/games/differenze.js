/*
  Differenze: due griglie di simboli quasi uguali; nella griglia di destra
  tre caselle sono diverse. Toccale. Giri su giri per 40 secondi.
  Griglie uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, shuffle } from "./shell.js";

const DURATION = 40;
const ROUNDS = 8;
const DIFFS = 3;
const SIZE = { facile: 3, normale: 4, difficile: 4 };
const ITEMS = ["🍎", "🍐", "🍋", "🍇", "🍓", "🍒", "🥝", "🍑", "🌶️", "🥕", "🍄", "🌽", "⭐", "🌙", "☀️", "❄️", "🔥", "💧", "🌈", "⚡"];

let shell = null;
let stopTimer = null;

export default {
  id: "differenze",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const size = SIZE[difficulty] || SIZE.normale;
    const rounds = [];
    for (let r = 0; r < ROUNDS; r++) {
      const pool = shuffle(ITEMS, rng).slice(0, difficulty === "difficile" ? 5 : 8);
      const left = Array.from({ length: size * size }, () => pool[Math.floor(rng() * pool.length)]);
      const right = [...left];
      const cells = new Set();
      while (cells.size < DIFFS) cells.add(Math.floor(rng() * left.length));
      for (const c of cells) { let v; do { v = pool[Math.floor(rng() * pool.length)]; } while (v === left[c]); right[c] = v; }
      rounds.push({ left, right, diffs: [...cells] });
    }
    return { size, rounds };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "differenza" : "differenze"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore(params) {
    return params.rounds.length * DIFFS;
  },

  mount(container, ctx) {
    const { size, rounds } = ctx.params;
    shell = createShell(container, { title: "Differenze", hint: "Tocca le 3 caselle diverse nella griglia di destra" });
    const gridL = el("div", { class: "diff-grid" }), gridR = el("div", { class: "diff-grid right" });
    gridL.style.gridTemplateColumns = gridR.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    shell.body.append(el("div", { class: "diff-wrap" }, [gridL, gridR]));

    let index = 0, score = 0, errors = 0, done = false;
    let found = new Set();

    const show = () => {
      const r = rounds[index % rounds.length];
      found = new Set();
      gridL.replaceChildren(...r.left.map((v) => el("div", { class: "diff-cell", text: v })));
      gridR.replaceChildren(...r.right.map((v, i) => {
        const c = el("div", { class: "diff-cell", text: v });
        c.addEventListener("pointerdown", (ev) => {
          ev.preventDefault();
          if (done || found.has(i)) return;
          if (r.diffs.includes(i)) {
            found.add(i); c.classList.add("ok"); score++; vibrate(10); sfx.play("good");
            shell.setHint(`Differenze: ${score}`);
            if (found.size === DIFFS) { index++; if (index >= rounds.length) finish(); else setTimeout(() => { if (!done) show(); }, 350); }
          } else { errors++; c.classList.add("ko"); vibrate([60, 30, 60]); sfx.play("bad"); setTimeout(() => c.classList.remove("ko"), 300); }
        });
        return c;
      }));
    };

    const finish = () => {
      if (done) return;
      done = true;
      stopTimer?.();
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, `${score} su ${rounds.length * DIFFS}${errors ? ` · ${errors} ${errors === 1 ? "errore" : "errori"}` : " · nessun errore"}`);
    };

    stopTimer = runTimer(DURATION, (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`), finish);
    show();
  },

  unmount() {
    stopTimer?.();
    shell?.remove();
    shell = null;
  },
};
