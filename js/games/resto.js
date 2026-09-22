/*
  Resto: paghi con una banconota, quanto ti torna indietro? Tocca il resto
  giusto tra quattro. +1 giusta, −1 sbagliata, 25 secondi. Conti uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, shuffle } from "./shell.js";

const DURATION = 25;
const QUESTIONS = 40;
const NOTES = { facile: [10, 20], normale: [10, 20, 50], difficile: [20, 50, 100] };

const euro = (cents) => `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")} €`;

let shell = null;
let stopTimer = null;

export default {
  id: "resto",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const notes = NOTES[difficulty] || NOTES.normale;
    const step = difficulty === "facile" ? 100 : difficulty === "normale" ? 50 : 10; // centesimi
    const questions = [];
    while (questions.length < QUESTIONS) {
      const note = notes[Math.floor(rng() * notes.length)] * 100;
      const price = step * (1 + Math.floor(rng() * ((note - step) / step)));
      const change = note - price;
      const wrong = new Set();
      const deltas = [step, -step, 2 * step, -2 * step, 100, -100, 500, -500, 1000, -1000];
      let guard = 0;
      while (wrong.size < 3 && guard++ < 50) {
        const d = deltas[Math.floor(rng() * deltas.length)];
        const v = change + d;
        if (v > 0 && v !== change && v < note) wrong.add(v);
      }
      if (wrong.size < 3) continue;
      questions.push({ price, note, answer: change, options: shuffle([change, ...wrong], rng) });
    }
    return { questions };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "punto" : "punti"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const { questions } = ctx.params;
    shell = createShell(container, { title: "Resto", hint: "Punti: 0" });
    const price = el("div", { class: "resto-price" });
    const note = el("div", { class: "resto-note" });
    const answers = el("div", { class: "quiz-answers" });
    shell.body.append(el("div", { class: "resto-box" }, [el("span", { class: "rime-label", text: "Costa" }), price, el("span", { class: "rime-label", text: "Paghi con" }), note]), el("p", { class: "rime-label", text: "Quanto è il resto?" }), answers);

    let index = 0, score = 0, ok = 0, ko = 0;
    let done = false;

    const show = () => {
      const q = questions[index % questions.length];
      price.textContent = euro(q.price);
      note.textContent = `${q.note / 100} €`;
      answers.replaceChildren(...q.options.map((opt) => {
        const btn = el("button", { class: "quiz-answer", text: euro(opt) });
        btn.addEventListener("pointerdown", (ev) => {
          ev.preventDefault();
          if (done) return;
          if (opt === q.answer) { score++; ok++; vibrate(10); sfx.play("good"); }
          else { score = Math.max(0, score - 1); ko++; vibrate([60, 30, 60]); sfx.play("bad"); }
          shell.setHint(`Punti: ${score}`);
          index++;
          show();
        });
        return btn;
      }));
    };

    stopTimer = runTimer(DURATION, (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`), () => {
      done = true;
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, `${ok} giuste, ${ko} sbagliate`);
    });
    show();
  },

  unmount() {
    stopTimer?.();
    shell?.remove();
    shell = null;
  },
};
