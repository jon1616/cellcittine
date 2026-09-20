/*
  Calcoli: 25 secondi di operazioni a raffica, tre risposte tra cui scegliere.
  Ogni risposta giusta vale +1, ogni errore -1. Le domande sono uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { createShell, runTimer, shuffle } from "./shell.js";

const DURATION = 25;

function makeQuestion(rng, difficulty) {
  const pick = (max) => 1 + Math.floor(rng() * max);
  let a, b, op, answer;

  if (difficulty === "facile") {
    op = rng() < 0.6 ? "+" : "−";
    a = pick(20); b = pick(10);
  } else if (difficulty === "difficile") {
    const r = rng();
    op = r < 0.35 ? "×" : r < 0.65 ? "+" : "−";
    a = op === "×" ? pick(12) : pick(60);
    b = op === "×" ? pick(12) : pick(40);
  } else {
    const r = rng();
    op = r < 0.25 ? "×" : r < 0.65 ? "+" : "−";
    a = op === "×" ? pick(9) : pick(40);
    b = op === "×" ? pick(9) : pick(20);
  }
  if (op === "−" && b > a) [a, b] = [b, a];
  answer = op === "+" ? a + b : op === "−" ? a - b : a * b;

  const wrong = new Set();
  while (wrong.size < 2) {
    const delta = (1 + Math.floor(rng() * 4)) * (rng() < 0.5 ? -1 : 1);
    const w = answer + delta;
    if (w !== answer && w >= 0) wrong.add(w);
  }
  const options = shuffle([answer, ...wrong], rng);
  return { text: `${a} ${op} ${b}`, answer, options };
}

let shell = null;
let stopTimer = null;

export default {
  id: "calcoli",
  title: "Calcoli",
  icon: "➕",
  description: "Rispondi a più operazioni che puoi in 25 secondi. Gli errori tolgono un punto.",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const questions = Array.from({ length: 60 }, () => makeQuestion(rng, difficulty));
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
    shell = createShell(container, { title: "Calcoli", hint: "Punti: 0" });

    const questionEl = el("div", { class: "calc-question" });
    const answers = el("div", { class: "calc-answers" });
    shell.body.append(questionEl, answers);

    let index = 0;
    let score = 0;
    let done = false;

    const showQuestion = () => {
      const q = questions[index % questions.length];
      questionEl.textContent = q.text;
      answers.replaceChildren(
        ...q.options.map((opt) => {
          const btn = el("button", { class: "calc-answer", text: String(opt) });
          btn.addEventListener("pointerdown", (ev) => {
            ev.preventDefault();
            if (done) return;
            if (opt === q.answer) {
              score++;
              vibrate(10);
              questionEl.classList.remove("flash-wrong");
            } else {
              score = Math.max(0, score - 1);
              vibrate([60, 30, 60]);
              questionEl.classList.add("flash-wrong");
              setTimeout(() => questionEl.classList.remove("flash-wrong"), 250);
            }
            shell.setHint(`Punti: ${score}`);
            index++;
            showQuestion();
          });
          return btn;
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
    showQuestion();
  },

  unmount() {
    stopTimer?.();
    shell?.remove();
    shell = null;
  },
};
