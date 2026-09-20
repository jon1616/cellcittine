/*
  Precisione: un cursore scorre avanti e indietro su una barra. Tocca quando
  è dentro la zona colorata: più sei vicino al centro, più punti (max 100).
  Cinque tiri, zone e velocità uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { createShell } from "./shell.js";

const SHOTS = 5;
const SETTINGS = {
  facile: { zone: 0.22, period: 2200 },
  normale: { zone: 0.16, period: 1600 },
  difficile: { zone: 0.11, period: 1150 },
};

let shell = null;
let raf = null;

export default {
  id: "precisione",
  order: "desc",
  maxSeconds: 40,

  createParams(rng, difficulty) {
    const s = SETTINGS[difficulty] || SETTINGS.normale;
    const shots = Array.from({ length: SHOTS }, () => ({
      center: 0.15 + rng() * 0.7,
      period: s.period * (0.85 + rng() * 0.3),
    }));
    return { zone: s.zone, shots };
  },

  formatScore(score) {
    return `${score} / ${SHOTS * 100}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const { zone, shots } = ctx.params;
    shell = createShell(container, { title: "Precisione", hint: `Tiro 1 di ${SHOTS}` });

    const feedback = el("div", { class: "prec-feedback", text: "" });
    const bar = el("div", { class: "prec-bar" });
    const target = el("div", { class: "prec-zone" });
    const marker = el("div", { class: "prec-marker" });
    bar.append(target, marker);
    const tapArea = el("div", { class: "prec-tap", text: "TOCCA" });
    shell.body.append(feedback, bar, tapArea);

    let shot = 0;
    let total = 0;
    let startedAt = performance.now();
    let armed = true;
    let done = false;

    const setup = () => {
      const s = shots[shot];
      target.style.left = `${(s.center - zone / 2) * 100}%`;
      target.style.width = `${zone * 100}%`;
      startedAt = performance.now();
      armed = true;
      shell.setHint(`Tiro ${shot + 1} di ${SHOTS}`);
    };

    // Posizione del cursore: onda triangolare nel tempo
    const position = () => {
      const s = shots[shot];
      const t = ((performance.now() - startedAt) % s.period) / s.period;
      return t < 0.5 ? t * 2 : 2 - t * 2;
    };

    const frame = () => {
      if (done) return;
      if (armed) marker.style.left = `${position() * 100}%`;
      raf = requestAnimationFrame(frame);
    };

    const fire = () => {
      if (!armed || done) return;
      armed = false;
      const pos = position();
      marker.style.left = `${pos * 100}%`;
      const dist = Math.abs(pos - shots[shot].center) / (zone / 2); // 0 = centro, 1 = bordo
      const points = dist >= 1 ? 0 : Math.round(100 * (1 - dist));
      total += points;
      feedback.textContent = points === 0 ? "Fuori!" : points >= 90 ? `+${points} Perfetto!` : `+${points}`;
      feedback.className = `prec-feedback ${points === 0 ? "bad" : points >= 90 ? "great" : ""}`;
      vibrate(points === 0 ? [60, 30, 60] : 15);
      shell.setTimer(`${total}`);

      shot++;
      setTimeout(() => {
        if (done) return;
        if (shot >= SHOTS) {
          done = true;
          shell.showDone(this.formatScore(total));
          ctx.onFinish(total);
        } else {
          feedback.textContent = "";
          setup();
        }
      }, 700);
    };

    tapArea.addEventListener("pointerdown", (ev) => { ev.preventDefault(); fire(); });
    bar.addEventListener("pointerdown", (ev) => { ev.preventDefault(); fire(); });

    shell.setTimer("0");
    setup();
    frame();
  },

  unmount() {
    cancelAnimationFrame(raf);
    shell?.remove();
    shell = null;
  },
};
