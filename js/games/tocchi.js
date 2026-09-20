/*
  Tocchi: quanti tocchi riesci a fare in 10 secondi? Tutto lo schermo è il
  pulsante. Ogni tocco fa salire una nota e disegna un cerchio che si allarga.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer } from "./shell.js";

const DURATION = 10;

let shell = null;
let stopTimer = null;

export default {
  id: "tocchi",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams() {
    return {};
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "tocco" : "tocchi"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    shell = createShell(container, { title: "Tocchi", hint: "Tocca più veloce che puoi!" });
    const counter = el("div", { class: "tap-counter", text: "0" });
    const pad = el("div", { class: "tap-pad" }, [counter]);
    shell.body.append(pad);

    let taps = 0;
    let done = false;

    pad.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      if (done) return;
      taps++;
      counter.textContent = String(taps);
      sfx.step(taps % 24, 24);
      if (taps % 10 === 0) vibrate(10);

      // Cerchio che si allarga dal punto toccato
      const r = pad.getBoundingClientRect();
      const ripple = el("div", { class: "ripple" });
      ripple.style.left = `${ev.clientX - r.left}px`;
      ripple.style.top = `${ev.clientY - r.top}px`;
      pad.append(ripple);
      setTimeout(() => ripple.remove(), 500);
    });

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${remaining.toFixed(1)} s`),
      () => {
        done = true;
        shell.showDone(this.formatScore(taps));
        ctx.onFinish(taps, `${(taps / DURATION).toFixed(1)} tocchi al secondo`);
      }
    );
  },

  unmount() {
    stopTimer?.();
    shell?.remove();
    shell = null;
  },
};
