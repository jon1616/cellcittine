/*
  Memory: carte coperte a coppie di forme colorate. Trova tutte le coppie
  nel minor tempo possibile. Le carte sono disposte allo stesso modo su
  tutti i telefoni (stesso seme).
*/

import { el, vibrate } from "../utils.js";
import { createShell, runStopwatch, formatSeconds, shuffle } from "./shell.js";

const NOT_FINISHED = 9999;
const PAIRS = { facile: 6, normale: 8, difficile: 10 };

// Forme disegnate in CSS (vedi .shape-* in style.css)
const SHAPES = [
  { shape: "circle", color: "#ff595e" },
  { shape: "square", color: "#1982c4" },
  { shape: "triangle", color: "#8ac926" },
  { shape: "star", color: "#ffca3a" },
  { shape: "diamond", color: "#6a4c93" },
  { shape: "hexagon", color: "#ff924c" },
  { shape: "cross", color: "#36cfc9" },
  { shape: "pentagon", color: "#f15bb5" },
  { shape: "ring", color: "#00bbf9" },
  { shape: "pill", color: "#c9a227" },
];

let shell = null;
let stopwatch = null;
let flipBackTimer = null;

export default {
  id: "memory",
  order: "asc",
  maxSeconds: 60,

  createParams(rng, difficulty) {
    const pairs = PAIRS[difficulty] || PAIRS.normale;
    const chosen = shuffle(SHAPES, rng).slice(0, pairs);
    const deck = shuffle([...chosen, ...chosen].map((s, i) => ({ ...s, key: i })), rng);
    return { deck, pairs };
  },

  formatScore(score) {
    return score >= NOT_FINISHED ? "Non finito" : formatSeconds(score / 10);
  },

  isValidScore(score) {
    return score < NOT_FINISHED;
  },

  mount(container, ctx) {
    const { deck, pairs } = ctx.params;
    shell = createShell(container, { title: "Memory", hint: `Coppie trovate: 0 / ${pairs}` });

    const cols = 4;
    const grid = el("div", { class: "memory-grid" });
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    shell.body.append(grid);

    let open = [];
    let found = 0;
    let locked = false;
    let done = false;

    const finish = (score) => {
      if (done) return;
      done = true;
      clearTimeout(flipBackTimer);
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score);
    };

    const cards = deck.map((item) => {
      const face = el("div", { class: `memory-face shape-${item.shape}` });
      face.style.setProperty("--shape-color", item.color);
      const card = el("div", { class: "memory-card" }, [el("div", { class: "memory-back" }), face]);

      card.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        if (locked || done || card.classList.contains("open") || card.classList.contains("found")) return;
        card.classList.add("open");
        open.push({ card, item });
        vibrate(10);

        if (open.length === 2) {
          const [a, b] = open;
          if (a.item.shape === b.item.shape) {
            a.card.classList.add("found");
            b.card.classList.add("found");
            open = [];
            found++;
            shell.setHint(`Coppie trovate: ${found} / ${pairs}`);
            if (found === pairs) {
              const seconds = stopwatch.stop();
              finish(Math.round(seconds * 10));
            }
          } else {
            locked = true;
            flipBackTimer = setTimeout(() => {
              a.card.classList.remove("open");
              b.card.classList.remove("open");
              open = [];
              locked = false;
            }, 650);
          }
        }
      });
      return card;
    });
    grid.append(...cards);

    stopwatch = runStopwatch((s) => {
      shell.setTimer(formatSeconds(s));
      if (s >= this.maxSeconds) {
        stopwatch.stop();
        finish(NOT_FINISHED);
      }
    });
  },

  unmount() {
    clearTimeout(flipBackTimer);
    stopwatch?.stop();
    shell?.remove();
    shell = null;
  },
};
