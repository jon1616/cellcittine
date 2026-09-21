/*
  Lampadine: sei lampadine si accendono una alla volta, sempre più in fretta.
  Spegni ogni lampadina toccandola prima che si spenga da sola: se la manchi
  o tocchi una lampadina spenta, perdi. 20 secondi. Sequenza uguale per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer } from "./shell.js";

const DURATION = 20;
const SETTINGS = {
  facile: { start: 1300, end: 800 },
  normale: { start: 1100, end: 560 },
  difficile: { start: 900, end: 400 },
};
const COLORS = ["#ffca3a", "#ff595e", "#8ac926", "#36cfc9", "#f15bb5", "#c77dff"];

let shell = null;
let stopTimer = null;
let timer = null;

export default {
  id: "lampadine",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const s = SETTINGS[difficulty] || SETTINGS.normale;
    const seq = [];
    let t = 600, last = -1;
    while (t < DURATION * 1000 - 400) {
      const k = Math.min(1, t / (DURATION * 1000));
      const win = Math.round(s.start + (s.end - s.start) * k); // finestra che si stringe
      let bulb = Math.floor(rng() * 6);
      if (bulb === last) bulb = (bulb + 1 + Math.floor(rng() * 5)) % 6;
      last = bulb;
      seq.push({ t, bulb, win });
      t += win + 120;
    }
    return { seq };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "lampadina" : "lampadine"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore(params) {
    return params.seq.length;
  },

  mount(container, ctx) {
    const { seq } = ctx.params;
    shell = createShell(container, { title: "Lampadine", hint: "Spegnile appena si accendono" });
    const grid = el("div", { class: "bulb-grid" });
    const bulbs = COLORS.map((c) => {
      const b = el("div", { class: "bulb" });
      b.style.setProperty("--c", c);
      return b;
    });
    grid.append(...bulbs);
    shell.body.append(grid);

    let score = 0, off = 0, missed = 0, wrong = 0;
    let lit = -1, step = 0;
    let done = false;

    const light = () => {
      if (done || step >= seq.length) return;
      const e = seq[step];
      lit = e.bulb;
      bulbs[lit].classList.add("on");
      sfx.play("blip");
      timer = setTimeout(() => {
        if (lit === e.bulb) { // non spenta in tempo
          missed++;
          bulbs[lit].classList.remove("on");
          lit = -1;
          sfx.play("bad");
          shell.setHint(`Spente: ${off} · mancate ${missed}`);
        }
        step++;
        timer = setTimeout(light, 120);
      }, e.win);
    };

    bulbs.forEach((b, i) => {
      b.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        if (done) return;
        if (i === lit) {
          lit = -1;
          score++; off++;
          b.classList.remove("on");
          b.classList.add("flash");
          setTimeout(() => b.classList.remove("flash"), 150);
          vibrate(10);
          sfx.play("good");
        } else {
          score = Math.max(0, score - 1); wrong++;
          vibrate([50, 30, 50]);
          sfx.play("bad");
          b.classList.add("shake");
          setTimeout(() => b.classList.remove("shake"), 250);
        }
        shell.setHint(`Spente: ${off}${missed ? ` · mancate ${missed}` : ""}${wrong ? ` · sbagliate ${wrong}` : ""}`);
      });
    });

    timer = setTimeout(light, seq[0]?.t || 600);
    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => {
        done = true;
        clearTimeout(timer);
        shell.showDone(this.formatScore(score));
        ctx.onFinish(score, `${off} spente, ${missed} mancate, ${wrong} ${wrong === 1 ? "tocco sbagliato" : "tocchi sbagliati"}`);
      }
    );
  },

  unmount() {
    stopTimer?.();
    clearTimeout(timer);
    shell?.remove();
    shell = null;
  },
};
