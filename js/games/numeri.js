/*
  Numeri: una griglia di numeri in disordine. Toccali in ordine crescente
  il più in fretta possibile. Ogni errore costa un secondo.
*/

import { el, vibrate } from "../utils.js";
import { createShell, runStopwatch, formatSeconds, shuffle } from "./shell.js";

const NOT_FINISHED = 9999;
const COUNT = { facile: 12, normale: 16, difficile: 20 };
const PENALTY = 1.0;

let shell = null;
let stopwatch = null;

export default {
  id: "numeri",
  order: "asc",
  maxSeconds: 60,

  createParams(rng, difficulty) {
    const count = COUNT[difficulty] || COUNT.normale;
    const order = shuffle(Array.from({ length: count }, (_, i) => i + 1), rng);
    return { count, order };
  },

  formatScore(score) {
    return score >= NOT_FINISHED ? "Non finito" : formatSeconds(score / 10);
  },

  isValidScore(score) {
    return score < NOT_FINISHED;
  },

  mount(container, ctx) {
    const { count, order } = ctx.params;
    shell = createShell(container, { title: "Numeri", hint: "Prossimo: 1" });

    const grid = el("div", { class: "num-grid" });
    grid.style.gridTemplateColumns = "repeat(4, 1fr)";
    shell.body.append(grid);

    let next = 1;
    let penalty = 0;
    let done = false;

    const finish = (score) => {
      if (done) return;
      done = true;
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score);
    };

    for (const n of order) {
      const cell = el("div", { class: "num-cell", text: String(n) });
      cell.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        if (done || cell.classList.contains("hit")) return;
        if (n === next) {
          cell.classList.add("hit");
          vibrate(10);
          next++;
          shell.setHint(next > count ? "Fatto!" : `Prossimo: ${next}`);
          if (next > count) {
            const seconds = stopwatch.stop() + penalty;
            finish(Math.round(seconds * 10));
          }
        } else {
          penalty += PENALTY;
          cell.classList.add("wrong");
          setTimeout(() => cell.classList.remove("wrong"), 300);
          vibrate([60, 30, 60]);
        }
      });
      grid.append(cell);
    }

    stopwatch = runStopwatch((s) => {
      shell.setTimer(formatSeconds(s + penalty));
      if (s + penalty >= this.maxSeconds) {
        stopwatch.stop();
        finish(NOT_FINISHED);
      }
    });
  },

  unmount() {
    stopwatch?.stop();
    shell?.remove();
    shell = null;
  },
};
