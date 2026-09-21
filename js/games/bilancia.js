/*
  Bilancia: due conti, uno per piatto. Quale pesa di più? Tocca il piatto
  più pesante, o "Uguali". +1 giusta, −1 sbagliata. 25 secondi.
  Conti uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer } from "./shell.js";

const DURATION = 25;

function expr(rng, difficulty) {
  const pick = (max) => 1 + Math.floor(rng() * max);
  if (difficulty === "facile") {
    const a = pick(12), b = pick(12);
    return { text: `${a} + ${b}`, value: a + b };
  }
  const r = rng();
  if (r < 0.35) { const a = pick(9), b = pick(9); return { text: `${a} × ${b}`, value: a * b }; }
  if (r < 0.7) { const a = pick(difficulty === "difficile" ? 80 : 40), b = pick(difficulty === "difficile" ? 60 : 30); return { text: `${a} + ${b}`, value: a + b }; }
  let a = pick(difficulty === "difficile" ? 90 : 50), b = pick(difficulty === "difficile" ? 50 : 30);
  if (b > a) [a, b] = [b, a];
  return { text: `${a} − ${b}`, value: a - b };
}

let shell = null;
let stopTimer = null;

export default {
  id: "bilancia",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const questions = [];
    for (let i = 0; i < 40; i++) {
      const left = expr(rng, difficulty);
      let right = expr(rng, difficulty);
      // ogni tanto un pareggio vero, altrimenti valori vicini per far pensare
      if (rng() < 0.18) { right = { text: right.text, value: left.value }; right.text = tweakTo(right, rng); }
      questions.push({ left, right });
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
    shell = createShell(container, { title: "Bilancia", hint: "Punti: 0" });
    const left = el("button", { class: "bil-pan" });
    const right = el("button", { class: "bil-pan" });
    const beam = el("div", { class: "bil-beam" }, [left, el("div", { class: "bil-pivot" }), right]);
    const equal = el("button", { class: "bil-equal", text: "= Uguali" });
    shell.body.append(beam, equal);

    let index = 0, score = 0, ok = 0, ko = 0;
    let done = false;

    const show = () => {
      const q = questions[index % questions.length];
      left.textContent = q.left.text;
      right.textContent = q.right.text;
      beam.classList.remove("tilt-l", "tilt-r");
    };

    const answer = (choice) => {
      if (done) return;
      const q = questions[index % questions.length];
      const truth = q.left.value > q.right.value ? "l" : q.left.value < q.right.value ? "r" : "=";
      if (choice === truth) { score++; ok++; vibrate(10); sfx.play("good"); }
      else { score = Math.max(0, score - 1); ko++; vibrate([60, 30, 60]); sfx.play("bad"); }
      beam.classList.toggle("tilt-l", truth === "l");
      beam.classList.toggle("tilt-r", truth === "r");
      shell.setHint(`Punti: ${score}`);
      index++;
      setTimeout(show, 180);
    };
    left.addEventListener("pointerdown", (ev) => { ev.preventDefault(); answer("l"); });
    right.addEventListener("pointerdown", (ev) => { ev.preventDefault(); answer("r"); });
    equal.addEventListener("pointerdown", (ev) => { ev.preventDefault(); answer("="); });

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

// Riscrive un conto in modo che valga `value` (per i pareggi): a + (value - a)
function tweakTo(e, rng) {
  const a = 1 + Math.floor(rng() * Math.max(1, e.value - 1));
  const b = e.value - a;
  return b >= 0 ? `${a} + ${b}` : `${e.value} + 0`;
}
