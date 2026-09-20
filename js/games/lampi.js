/*
  Lampi: sullo schermo appaiono in rapida successione alcuni lampi di luce.
  Quanti erano? Rispondi col tastierino. Otto giri, sempre più veloci.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell } from "./shell.js";

const ROUNDS = 8;
const RANGE = { facile: [3, 7], normale: [4, 9], difficile: [5, 12] };
const FLASH = { facile: 260, normale: 200, difficile: 150 }; // ms per lampo
const COLORS = ["#ffca3a", "#36cfc9", "#f15bb5", "#8ac926", "#ff924c"];

let shell = null;
let timers = [];

export default {
  id: "lampi",
  order: "desc",
  maxSeconds: 60,

  createParams(rng, difficulty) {
    const [lo, hi] = RANGE[difficulty] || RANGE.normale;
    const flash = FLASH[difficulty] || FLASH.normale;
    const rounds = Array.from({ length: ROUNDS }, (_, r) => {
      const count = lo + Math.floor(rng() * (hi - lo + 1));
      return {
        count,
        // ogni lampo: posizione (percentuali), colore, ritardo dal precedente
        flashes: Array.from({ length: count }, () => ({
          x: 0.1 + rng() * 0.8,
          y: 0.1 + rng() * 0.8,
          color: COLORS[Math.floor(rng() * COLORS.length)],
          gap: flash * (0.7 + rng() * 0.6) * Math.max(0.55, 1 - r * 0.06),
        })),
      };
    });
    return { rounds, flash, maxAnswer: hi + 2 };
  },

  formatScore(score) {
    return `${score} / ${ROUNDS}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore() {
    return ROUNDS;
  },

  mount(container, ctx) {
    const { rounds, flash, maxAnswer } = ctx.params;
    shell = createShell(container, { title: "Lampi", hint: "Conta i lampi…" });
    const stage = el("div", { class: "flash-stage" });
    const keypad = el("div", { class: "keypad" });
    shell.body.append(stage, keypad);

    let index = 0;
    let correct = 0;
    let done = false;

    const finish = () => {
      done = true;
      shell.showDone(this.formatScore(correct));
      ctx.onFinish(correct);
    };

    const playRound = () => {
      const r = rounds[index];
      keypad.replaceChildren();
      stage.replaceChildren();
      shell.setHint("Conta i lampi…");
      shell.setTimer(`${index + 1} / ${ROUNDS}`);
      let t = 500;
      r.flashes.forEach((f, i) => {
        t += f.gap;
        timers.push(setTimeout(() => {
          if (done) return;
          const dot = el("div", { class: "flash" });
          dot.style.cssText = `left:${f.x * 100}%;top:${f.y * 100}%;background:${f.color};`;
          stage.append(dot);
          sfx.play("blip");
          timers.push(setTimeout(() => dot.remove(), flash * 0.75));
        }, t));
      });
      timers.push(setTimeout(askAnswer, t + flash + 300));
    };

    const askAnswer = () => {
      if (done) return;
      shell.setHint("Quanti erano?");
      const r = rounds[index];
      keypad.replaceChildren(
        ...Array.from({ length: maxAnswer }, (_, i) => {
          const n = i + 1;
          const key = el("button", { class: "key", text: String(n) });
          key.addEventListener("pointerdown", (ev) => {
            ev.preventDefault();
            if (done || keypad.dataset.locked) return;
            keypad.dataset.locked = "1";
            const ok = n === r.count;
            if (ok) { correct++; sfx.play("good"); vibrate(10); key.classList.add("ok"); }
            else { sfx.play("bad"); vibrate([60, 30, 60]); key.classList.add("ko"); }
            shell.setHint(ok ? "Giusto!" : `Erano ${r.count}`);
            // Mostra la risposta giusta
            [...keypad.children].find((k) => k.textContent === String(r.count))?.classList.add("ok");
            index++;
            timers.push(setTimeout(() => {
              delete keypad.dataset.locked;
              if (index >= ROUNDS) finish();
              else playRound();
            }, 900));
          });
          return key;
        })
      );
    };

    playRound();
  },

  unmount() {
    timers.forEach(clearTimeout);
    timers = [];
    shell?.remove();
    shell = null;
  },
};
