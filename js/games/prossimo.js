/*
  Prossimo: una sequenza di numeri segue una regola (salti uguali, raddoppi,
  salti alternati…). Qual è il numero che viene dopo? Tre risposte, 25 secondi.
  +1 giusta, −1 sbagliata. Sequenze uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, shuffle } from "./shell.js";

const DURATION = 25;

function makeSequence(rng, difficulty) {
  const pick = (max) => 1 + Math.floor(rng() * max);
  const kinds = difficulty === "facile" ? ["add", "add", "sub"] : difficulty === "normale" ? ["add", "sub", "mul", "alt"] : ["add", "sub", "mul", "alt", "grow", "square"];
  const kind = kinds[Math.floor(rng() * kinds.length)];
  let seq = [];
  if (kind === "add") { const s = pick(difficulty === "facile" ? 5 : 12), k = pick(difficulty === "facile" ? 4 : 9); seq = [0, 1, 2, 3, 4].map((i) => s + i * k); }
  else if (kind === "sub") { const k = pick(difficulty === "facile" ? 3 : 8), s = 4 * k + pick(20); seq = [0, 1, 2, 3, 4].map((i) => s - i * k); }
  else if (kind === "mul") { const s = pick(3), f = 2 + Math.floor(rng() * 2); seq = [0, 1, 2, 3, 4].map((i) => s * Math.pow(f, i)); }
  else if (kind === "alt") { const a = pick(6), b = pick(6) + 6, s = pick(10); seq = [s]; for (let i = 0; i < 4; i++) seq.push(seq[i] + (i % 2 === 0 ? a : b)); }
  else if (kind === "grow") { const s = pick(5); seq = [s]; for (let i = 0; i < 4; i++) seq.push(seq[i] + (i + 1)); }
  else { const s = pick(4); seq = [0, 1, 2, 3, 4].map((i) => (s + i) * (s + i)); }
  const answer = seq[4];
  const shown = seq.slice(0, 4);
  const wrong = new Set();
  const deltas = [1, 2, 3, -1, -2, seq[4] - seq[3], -(seq[4] - seq[3]) || 4];
  let guard = 0;
  while (wrong.size < 2 && guard++ < 30) {
    const d = deltas[Math.floor(rng() * deltas.length)] * (1 + Math.floor(rng() * 2));
    const w = answer + d;
    if (w !== answer && !shown.includes(w) && w >= 0) wrong.add(w);
  }
  while (wrong.size < 2) wrong.add(answer + 10 + wrong.size);
  return { shown, answer, options: shuffle([answer, ...wrong], rng) };
}

let shell = null;
let stopTimer = null;

export default {
  id: "prossimo",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    return { questions: Array.from({ length: 40 }, () => makeSequence(rng, difficulty)) };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "punto" : "punti"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const { questions } = ctx.params;
    shell = createShell(container, { title: "Prossimo", hint: "Punti: 0" });
    const seq = el("div", { class: "seq-line" });
    const answers = el("div", { class: "calc-answers" });
    shell.body.append(seq, answers);

    let index = 0, score = 0, ok = 0, ko = 0;
    let done = false;

    const show = () => {
      const q = questions[index % questions.length];
      seq.replaceChildren(...q.shown.map((n) => el("span", { class: "seq-num", text: String(n) })), el("span", { class: "seq-num q", text: "?" }));
      answers.replaceChildren(...q.options.map((opt) => {
        const btn = el("button", { class: "calc-answer", text: String(opt) });
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
