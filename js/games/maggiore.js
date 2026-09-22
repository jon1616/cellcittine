/*
  Maggiore: due numeri o conti, uno a sinistra e uno a destra. Tocca quello
  che vale di più. +1 giusta, −1 sbagliata, 25 secondi. Conti uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer } from "./shell.js";

const DURATION = 25;
const QUESTIONS = 40;

// Un'espressione con il suo valore
function expr(rng, difficulty) {
  const pick = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const kinds = difficulty === "facile" ? ["n", "n", "add"] : difficulty === "difficile" ? ["mul", "add", "sub", "div", "mul"] : ["n", "add", "sub", "mul"];
  const k = kinds[Math.floor(rng() * kinds.length)];
  if (k === "n") { const v = pick(2, difficulty === "facile" ? 30 : 60); return { text: String(v), value: v }; }
  if (k === "add") { const a = pick(2, 30), b = pick(2, 30); return { text: `${a} + ${b}`, value: a + b }; }
  if (k === "sub") { const a = pick(10, 60), b = pick(1, a - 1); return { text: `${a} − ${b}`, value: a - b }; }
  if (k === "div") { const b = pick(2, 9), q = pick(2, 9); return { text: `${b * q} : ${b}`, value: q }; }
  const a = pick(2, difficulty === "difficile" ? 12 : 9), b = pick(2, 9);
  return { text: `${a} × ${b}`, value: a * b };
}

let shell = null;
let stopTimer = null;

export default {
  id: "maggiore",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const questions = [];
    while (questions.length < QUESTIONS) {
      const a = expr(rng, difficulty), b = expr(rng, difficulty);
      if (a.value === b.value) continue;
      // In difficile i due valori sono vicini (più insidioso)
      if (difficulty === "difficile" && Math.abs(a.value - b.value) > 12) continue;
      if (difficulty === "facile" && Math.abs(a.value - b.value) < 3) continue;
      questions.push({ a: a.text, b: b.text, answer: a.value > b.value ? "a" : "b" });
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
    shell = createShell(container, { title: "Maggiore", hint: "Punti: 0" });
    const left = el("button", { class: "vs-card" });
    const right = el("button", { class: "vs-card" });
    shell.body.append(
      el("p", { class: "rime-label", text: "Quale vale di più?" }),
      el("div", { class: "vs-row" }, [left, el("span", { class: "vs-mid", text: "o" }), right])
    );

    let index = 0, score = 0, ok = 0, ko = 0;
    let done = false;

    const show = () => {
      const q = questions[index % questions.length];
      left.textContent = q.a;
      right.textContent = q.b;
    };
    const pick = (side, btn) => {
      if (done) return;
      const q = questions[index % questions.length];
      if (side === q.answer) { score++; ok++; vibrate(10); sfx.play("good"); btn.classList.add("ok"); }
      else { score = Math.max(0, score - 1); ko++; vibrate([60, 30, 60]); sfx.play("bad"); btn.classList.add("ko"); }
      setTimeout(() => btn.classList.remove("ok", "ko"), 200);
      shell.setHint(`Punti: ${score}`);
      index++;
      show();
    };
    left.addEventListener("pointerdown", (ev) => { ev.preventDefault(); pick("a", left); });
    right.addEventListener("pointerdown", (ev) => { ev.preventDefault(); pick("b", right); });

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
