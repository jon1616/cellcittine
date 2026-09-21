/*
  Contrari: una parola; tra le quattro sotto, il suo contrario. +1 giusta,
  −1 sbagliata. 25 secondi. Parole uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, shuffle } from "./shell.js";

const DURATION = 25;
const PAIRS = [
  ["CALDO", "FREDDO"], ["ALTO", "BASSO"], ["GRANDE", "PICCOLO"], ["VELOCE", "LENTO"], ["GIORNO", "NOTTE"], ["PIENO", "VUOTO"],
  ["APERTO", "CHIUSO"], ["LEGGERO", "PESANTE"], ["BAGNATO", "ASCIUTTO"], ["DOLCE", "AMARO"], ["FORTE", "DEBOLE"], ["RICCO", "POVERO"],
  ["VICINO", "LONTANO"], ["PULITO", "SPORCO"], ["FACILE", "DIFFICILE"], ["SOPRA", "SOTTO"], ["DENTRO", "FUORI"], ["PRIMA", "DOPO"],
  ["INIZIO", "FINE"], ["ACCESO", "SPENTO"], ["CHIARO", "SCURO"], ["LUNGO", "CORTO"], ["LARGO", "STRETTO"], ["GIOVANE", "VECCHIO"],
  ["NUOVO", "USATO"], ["MORBIDO", "DURO"], ["SALITA", "DISCESA"], ["ENTRATA", "USCITA"], ["SILENZIO", "RUMORE"], ["PACE", "GUERRA"],
  ["AMICO", "NEMICO"], ["VERO", "FALSO"], ["TANTO", "POCO"], ["SEMPRE", "MAI"], ["PRESTO", "TARDI"], ["LISCIO", "RUVIDO"],
  ["ALLEGRO", "TRISTE"], ["CORAGGIO", "PAURA"], ["MAGRO", "GRASSO"], ["DRITTO", "STORTO"],
];

let shell = null;
let stopTimer = null;

export default {
  id: "contrari",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng) {
    const order = shuffle(PAIRS.map((_, i) => i), rng);
    const questions = [];
    for (let k = 0; k < 40; k++) {
      const pi = order[k % order.length];
      const flip = rng() < 0.5;
      const word = PAIRS[pi][flip ? 1 : 0], answer = PAIRS[pi][flip ? 0 : 1];
      const others = shuffle(PAIRS.filter((_, i) => i !== pi).map((p) => p[Math.floor(rng() * 2)]), rng).slice(0, 3);
      questions.push({ word, answer, options: shuffle([answer, ...others], rng) });
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
    shell = createShell(container, { title: "Contrari", hint: "Punti: 0" });
    const target = el("div", { class: "word-target" });
    const answers = el("div", { class: "quiz-answers" });
    shell.body.append(el("p", { class: "rime-label", text: "Il contrario di…" }), target, answers);

    let index = 0, score = 0, ok = 0, ko = 0;
    let done = false;

    const cap = (w) => w.charAt(0) + w.slice(1).toLowerCase();
    const show = () => {
      const q = questions[index % questions.length];
      target.textContent = cap(q.word);
      answers.replaceChildren(...q.options.map((opt) => {
        const btn = el("button", { class: "quiz-answer", text: cap(opt) });
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

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => {
        done = true;
        shell.showDone(this.formatScore(score));
        ctx.onFinish(score, `${ok} giuste, ${ko} sbagliate`);
      }
    );
    show();
  },

  unmount() {
    stopTimer?.();
    shell?.remove();
    shell = null;
  },
};
