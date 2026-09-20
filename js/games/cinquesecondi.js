/*
  Cinque secondi: tocca per far partire il cronometro. Dopo un secondo i
  numeri spariscono: tocca di nuovo quando pensi che siano passati esattamente
  5 secondi (a difficile il bersaglio cambia: 3, 4, 6, 7…). Tre tentativi.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell } from "./shell.js";

const TRIES = 3;
const VISIBLE_MS = 1000;
const TOLERANCE = 1.5; // secondi di scarto per arrivare a zero punti
const IDLE_LIMIT = 10000;   // ms senza avviare: il tentativo vale zero
const RUN_LIMIT = 15000;    // ms di cronometro senza fermarlo: si ferma da solo

let shell = null;
let raf = null;
let nextTimer = null;
let guard = null;

export default {
  id: "cinquesecondi",
  order: "desc",
  maxSeconds: 60,

  createParams(rng, difficulty) {
    const targets = Array.from({ length: TRIES }, () => {
      if (difficulty === "difficile") return [3, 4, 6, 7, 8][Math.floor(rng() * 5)];
      if (difficulty === "normale") return [4, 5, 6][Math.floor(rng() * 3)];
      return 5;
    });
    return { targets, visible: difficulty === "facile" ? 2000 : VISIBLE_MS };
  },

  formatScore(score) {
    return `${score} / ${TRIES * 100}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore() {
    return TRIES * 100;
  },

  mount(container, ctx) {
    const { targets, visible } = ctx.params;
    shell = createShell(container, { title: "Cronometro cieco", hint: "" });
    const target = el("div", { class: "clock-target" });
    const display = el("div", { class: "clock-display", text: "0.00" });
    const feedback = el("div", { class: "prec-feedback" });
    const help = el("div", { class: "hint", text: "Tocca per far partire il cronometro" });
    shell.body.append(target, display, feedback, help);

    let index = 0;
    let total = 0;
    let errSum = 0;
    let perfects = 0;
    let startedAt = null;
    let phase = "ready"; // ready -> running -> shown
    let done = false;

    const setup = () => {
      phase = "ready";
      startedAt = null;
      clearTimeout(guard);
      guard = setTimeout(() => { if (!done && phase === "ready") stop(true); }, IDLE_LIMIT);
      target.textContent = `Ferma a ${targets[index].toFixed(2)} s`;
      display.textContent = "0.00";
      display.classList.remove("hidden");
      feedback.textContent = "";
      help.textContent = "Tocca per far partire il cronometro";
      shell.setHint(`Tentativo ${index + 1} di ${TRIES}`);
    };

    const frame = () => {
      if (phase !== "running") return;
      const t = (performance.now() - startedAt) / 1000;
      if (t * 1000 < visible) display.textContent = t.toFixed(2);
      else display.classList.add("hidden");
      raf = requestAnimationFrame(frame);
    };

    shell.area.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      if (done) return;
      if (phase === "ready") {
        phase = "running";
        startedAt = performance.now();
        help.textContent = "…tocca quando è il momento";
        sfx.play("tick");
        vibrate(10);
        raf = requestAnimationFrame(frame);
        clearTimeout(guard);
        guard = setTimeout(() => { if (!done && phase === "running") stop(false); }, RUN_LIMIT);
        return;
      }
      if (phase !== "running") return;
      stop(false);
    });

    // Chiude il tentativo corrente. forfeit = mai avviato (zero punti).
    const stop = (forfeit) => {
      phase = "shown";
      cancelAnimationFrame(raf);
      clearTimeout(guard);
      const t = forfeit ? Infinity : (performance.now() - startedAt) / 1000;
      const err = Math.abs(t - targets[index]);
      const points = Math.max(0, Math.round(100 * (1 - err / TOLERANCE)));
      total += points;
      errSum += forfeit ? TOLERANCE : err;
      if (points >= 90) perfects++;
      display.classList.remove("hidden");
      display.textContent = forfeit ? "—" : t.toFixed(2);
      feedback.textContent = forfeit ? "Tempo scaduto" : points >= 90 ? `+${points} Perfetto!` : points > 0 ? `+${points} (${err >= 0 ? "" : ""}${(t - targets[index] >= 0 ? "+" : "−")}${err.toFixed(2)} s)` : "Fuori di molto!";
      feedback.className = `prec-feedback ${points >= 90 ? "great" : points === 0 ? "bad" : ""}`;
      sfx.play(points >= 90 ? "perfect" : points >= 40 ? "good" : "bad");
      vibrate(points >= 40 ? 12 : [60, 30, 60]);
      shell.setTimer(String(total));
      index++;
      nextTimer = setTimeout(() => {
        if (index >= TRIES) {
          done = true;
          shell.showDone(this.formatScore(total));
          ctx.onFinish(total, `${perfects} ${perfects === 1 ? "perfetto" : "perfetti"} · scarto medio ${(errSum / TRIES).toFixed(2)} s`);
        } else {
          setup();
        }
      }, 1400);
    };

    shell.setTimer("0");
    setup();
  },

  unmount() {
    cancelAnimationFrame(raf);
    clearTimeout(nextTimer);
    clearTimeout(guard);
    shell?.remove();
    shell = null;
  },
};
