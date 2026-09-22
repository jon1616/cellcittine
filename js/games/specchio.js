/*
  Specchio: a sinistra un disegno di caselle accese; a destra riproducilo
  allo specchio (ribaltato) toccando le caselle. Quando è uguale, il prossimo.
  Punteggio: disegni completati in 30 secondi. Disegni uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer } from "./shell.js";

const DURATION = 30;
const COLS = 3, ROWS = 4; // per metà
const PATTERNS = 12;
const LIT = { facile: [3, 4], normale: [4, 6], difficile: [6, 8] };

let shell = null;
let stopTimer = null;

export default {
  id: "specchio",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const [min, max] = LIT[difficulty] || LIT.normale;
    const patterns = [];
    for (let p = 0; p < PATTERNS; p++) {
      const n = min + Math.floor(rng() * (max - min + 1));
      const cells = new Set();
      while (cells.size < n) cells.add(Math.floor(rng() * COLS * ROWS));
      patterns.push([...cells].sort((a, b) => a - b));
    }
    return { patterns };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "disegno" : "disegni"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore(params) {
    return params.patterns.length;
  },

  mount(container, ctx) {
    const { patterns } = ctx.params;
    shell = createShell(container, { title: "Specchio", hint: "Ricopia il disegno allo specchio, a destra" });
    const left = el("div", { class: "mirror-grid" });
    const right = el("div", { class: "mirror-grid right" });
    const wrap = el("div", { class: "mirror-wrap" }, [left, el("div", { class: "mirror-axis" }), right]);
    shell.body.append(wrap);

    let index = 0, score = 0, taps = 0;
    let done = false;
    let mine = new Set();
    const leftCells = [], rightCells = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      leftCells.push(el("div", { class: "mirror-cell" }));
      const rc = el("div", { class: "mirror-cell" });
      rc.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        if (done) return;
        taps++;
        if (mine.has(i)) mine.delete(i); else mine.add(i);
        rc.classList.toggle("on", mine.has(i));
        sfx.play("blip");
        check();
      });
      rightCells.push(rc);
    }
    left.append(...leftCells);
    right.append(...rightCells);

    // La casella (r, c) di sinistra corrisponde a (r, COLS-1-c) di destra
    const mirrored = (cell) => { const r = Math.floor(cell / COLS), c = cell % COLS; return r * COLS + (COLS - 1 - c); };

    const show = () => {
      const pat = patterns[index % patterns.length];
      leftCells.forEach((c, i) => c.classList.toggle("on", pat.includes(i)));
      mine = new Set();
      rightCells.forEach((c) => c.classList.remove("on"));
      shell.setHint(`Disegni: ${score}`);
    };

    const check = () => {
      const pat = patterns[index % patterns.length];
      const target = new Set(pat.map(mirrored));
      if (target.size !== mine.size || [...target].some((i) => !mine.has(i))) return;
      score++;
      vibrate(20);
      sfx.play("good");
      index++;
      if (index >= patterns.length) { finish(); return; }
      show();
    };

    const finish = () => {
      if (done) return;
      done = true;
      stopTimer?.();
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, `${score} su ${patterns.length}${taps ? ` · ${taps} tocchi` : ""}`);
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
