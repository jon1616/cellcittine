/*
  Intruso: una griglia di quadrati dello stesso colore, uno solo è di una
  sfumatura leggermente diversa. Toccalo. 20 secondi, più griglie risolvi
  meglio è; un errore costa un punto.
*/

import { el, vibrate } from "../utils.js";
import { createShell, runTimer } from "./shell.js";

const DURATION = 20;
const SETTINGS = {
  facile: { size: 4, delta: 26 },
  normale: { size: 5, delta: 16 },
  difficile: { size: 6, delta: 9 },
};

let shell = null;
let stopTimer = null;

export default {
  id: "intruso",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const s = SETTINGS[difficulty] || SETTINGS.normale;
    const grids = Array.from({ length: 40 }, (_, i) => {
      // La differenza si riduce man mano che si va avanti
      const delta = Math.max(6, s.delta - i * 0.6);
      return {
        hue: Math.floor(rng() * 360),
        sat: 55 + Math.floor(rng() * 30),
        light: 40 + Math.floor(rng() * 20),
        delta: delta * (rng() < 0.5 ? -1 : 1),
        odd: Math.floor(rng() * s.size * s.size),
      };
    });
    return { size: s.size, grids };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "trovato" : "trovati"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const { size, grids } = ctx.params;
    shell = createShell(container, { title: "Intruso", hint: "Trovati: 0" });

    const grid = el("div", { class: "odd-grid" });
    grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    shell.body.append(grid);

    let index = 0;
    let score = 0;
    let done = false;

    const build = () => {
      const gd = grids[index % grids.length];
      const base = `hsl(${gd.hue} ${gd.sat}% ${gd.light}%)`;
      const odd = `hsl(${gd.hue} ${gd.sat}% ${gd.light + gd.delta}%)`;
      grid.replaceChildren(
        ...Array.from({ length: size * size }, (_, i) => {
          const cell = el("div", { class: "odd-cell" });
          cell.style.background = i === gd.odd ? odd : base;
          cell.addEventListener("pointerdown", (ev) => {
            ev.preventDefault();
            if (done) return;
            if (i === gd.odd) {
              score++;
              vibrate(10);
              index++;
              shell.setHint(`Trovati: ${score}`);
              build();
            } else {
              score = Math.max(0, score - 1);
              vibrate([60, 30, 60]);
              cell.classList.add("wrong");
              setTimeout(() => cell.classList.remove("wrong"), 250);
              shell.setHint(`Trovati: ${score}`);
            }
          });
          return cell;
        })
      );
    };

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => {
        done = true;
        shell.showDone(this.formatScore(score));
        ctx.onFinish(score);
      }
    );
    build();
  },

  unmount() {
    stopTimer?.();
    shell?.remove();
    shell = null;
  },
};
