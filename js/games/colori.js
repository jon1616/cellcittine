/*
  Colori (effetto Stroop): appare il nome di un colore scritto con un
  inchiostro che spesso non corrisponde. Tocca il tasto del colore
  dell'INCHIOSTRO, ignorando la parola. 20 secondi, +1 / -1.
*/

import { el, vibrate } from "../utils.js";
import { createShell, runTimer } from "./shell.js";

const DURATION = 20;
const COLORS = [
  { id: "rosso", label: "ROSSO", hex: "#ff595e" },
  { id: "blu", label: "BLU", hex: "#1982c4" },
  { id: "verde", label: "VERDE", hex: "#8ac926" },
  { id: "giallo", label: "GIALLO", hex: "#ffca3a" },
];
// Quante volte parola e inchiostro NON coincidono
const MISMATCH = { facile: 0.5, normale: 0.7, difficile: 0.85 };

let shell = null;
let stopTimer = null;

export default {
  id: "colori",
  title: "Colori",
  icon: "🎨",
  description: "Tocca il colore con cui è SCRITTA la parola, non quello che dice. 20 secondi.",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const mismatch = MISMATCH[difficulty] || MISMATCH.normale;
    const items = Array.from({ length: 80 }, () => {
      const word = Math.floor(rng() * 4);
      let ink = word;
      if (rng() < mismatch) {
        ink = (word + 1 + Math.floor(rng() * 3)) % 4;
      }
      // Ordine dei tasti mescolato ogni tanto, per non andare a memoria
      return { word, ink };
    });
    const shuffleEvery = difficulty === "difficile" ? 1 : difficulty === "normale" ? 3 : 1000;
    return { items, shuffleEvery };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "punto" : "punti"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const { items, shuffleEvery } = ctx.params;
    shell = createShell(container, { title: "Colori", hint: "Punti: 0" });

    const word = el("div", { class: "stroop-word" });
    const pads = el("div", { class: "stroop-pads" });
    shell.body.append(word, pads);

    let index = 0;
    let score = 0;
    let done = false;
    let order = [0, 1, 2, 3];

    const rotate = () => {
      // rotazione semplice e deterministica dell'ordine dei tasti
      order.push(order.shift());
      if (index % 2 === 0) order.reverse();
    };

    const next = () => {
      const item = items[index % items.length];
      word.textContent = COLORS[item.word].label;
      word.style.color = COLORS[item.ink].hex;
      if (index > 0 && index % shuffleEvery === 0) rotate();
      pads.replaceChildren(
        ...order.map((ci) => {
          const pad = el("button", { class: "stroop-pad" });
          pad.style.background = COLORS[ci].hex;
          pad.addEventListener("pointerdown", (ev) => {
            ev.preventDefault();
            if (done) return;
            if (ci === item.ink) {
              score++;
              vibrate(10);
            } else {
              score = Math.max(0, score - 1);
              vibrate([60, 30, 60]);
              word.classList.add("shake");
              setTimeout(() => word.classList.remove("shake"), 250);
            }
            shell.setHint(`Punti: ${score}`);
            index++;
            next();
          });
          return pad;
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
    next();
  },

  unmount() {
    stopTimer?.();
    shell?.remove();
    shell = null;
  },
};
