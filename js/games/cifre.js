/*
  Cifre: un numero compare per qualche secondo, poi sparisce: riscrivilo sul
  tastierino. Ogni volta ha una cifra in più. Si va avanti finché non sbagli
  (o finisce il tempo). Punteggio: cifre ricordate. Numeri uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer } from "./shell.js";

const DURATION = 60;
const START = { facile: 3, normale: 4, difficile: 5 };
const MAX_DIGITS = 12;
const SHOW_PER_DIGIT = { facile: 800, normale: 650, difficile: 500 };
const IDLE_LIMIT = 8000;

let shell = null;
let stopTimer = null;
let timer = null;

export default {
  id: "cifre",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const start = START[difficulty] || START.normale;
    const numbers = [];
    for (let len = start; len <= MAX_DIGITS; len++) {
      let s = String(1 + Math.floor(rng() * 9));
      while (s.length < len) s += String(Math.floor(rng() * 10));
      numbers.push(s);
    }
    return { numbers, showPerDigit: SHOW_PER_DIGIT[difficulty] || SHOW_PER_DIGIT.normale };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "cifra" : "cifre"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore(params) {
    return params.numbers.reduce((a, n) => a + n.length, 0);
  },

  mount(container, ctx) {
    const { numbers, showPerDigit } = ctx.params;
    shell = createShell(container, { title: "Cifre", hint: "Memorizza il numero" });
    const display = el("div", { class: "cif-display" });
    const typed = el("div", { class: "cif-typed" });
    const pad = el("div", { class: "keypad cif-pad" });
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"].map((k) => el("button", { class: "key", text: k }));
    pad.append(...keys);
    shell.body.append(display, typed, pad);

    let level = 0, score = 0, best = 0;
    let input = "";
    let accepting = false;
    let done = false;

    const showNumber = () => {
      if (done) return;
      if (level >= numbers.length) { finish("Tutti i numeri ricordati!"); return; }
      const n = numbers[level];
      input = "";
      typed.textContent = "";
      accepting = false;
      display.textContent = n;
      display.classList.remove("hidden");
      shell.setHint(`${n.length} cifre · memorizza`);
      timer = setTimeout(() => {
        if (done) return;
        display.textContent = "?".repeat(n.length);
        display.classList.add("hidden");
        shell.setHint("Riscrivilo");
        accepting = true;
        sfx.play("flip");
        timer = setTimeout(() => { if (accepting) check(); }, IDLE_LIMIT);
      }, n.length * showPerDigit + 300);
    };

    const check = () => {
      accepting = false;
      clearTimeout(timer);
      const n = numbers[level];
      if (input === n) {
        score += n.length;
        best = n.length;
        vibrate(20);
        sfx.play("perfect");
        display.textContent = n;
        display.classList.remove("hidden");
        typed.classList.add("ok");
        shell.setHint(`Giusto! +${n.length}`);
        level++;
        timer = setTimeout(() => { typed.classList.remove("ok"); showNumber(); }, 800);
      } else {
        vibrate([80, 40, 80]);
        sfx.play("bad");
        display.textContent = n;
        display.classList.remove("hidden");
        typed.classList.add("ko");
        finish(`Era ${n}`);
      }
    };

    keys.forEach((k) => {
      k.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        if (done || !accepting) return;
        const v = k.textContent;
        if (v === "⌫") { input = input.slice(0, -1); sfx.play("blip"); }
        else if (v === "OK") { if (input.length) check(); return; }
        else if (input.length < numbers[level].length) { input += v; sfx.play("blip"); }
        typed.textContent = input;
        if (input.length === numbers[level].length) check();
      });
    });

    const finish = (why) => {
      if (done) return;
      done = true;
      stopTimer?.();
      clearTimeout(timer);
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, best ? `fino a ${best} cifre · ${why}` : why);
    };

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => finish("tempo scaduto")
    );
    showNumber();
  },

  unmount() {
    stopTimer?.();
    clearTimeout(timer);
    shell?.remove();
    shell = null;
  },
};
