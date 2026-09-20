/*
  Palloncini: tieni premuto per gonfiare, lascia prima che scoppi.
  Ogni palloncino ha un limite nascosto diverso (uguale per tutti).
  Punti = quanto l'hai gonfiato; se scoppia, zero. Cinque palloncini.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell } from "./shell.js";

const BALLOONS = 5;
const SETTINGS = {
  facile: { min: 0.6, max: 1.0, rate: 0.28 },
  normale: { min: 0.45, max: 1.0, rate: 0.36 },
  difficile: { min: 0.3, max: 0.95, rate: 0.46 },
};
const COLORS = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#f15bb5"];

let shell = null;
let raf = null;

export default {
  id: "palloncini",
  order: "desc",
  maxSeconds: 45,

  createParams(rng, difficulty) {
    const s = SETTINGS[difficulty] || SETTINGS.normale;
    const limits = Array.from({ length: BALLOONS }, () => s.min + rng() * (s.max - s.min));
    return { limits, rate: s.rate };
  },

  formatScore(score) {
    return `${score} / ${BALLOONS * 100}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore() {
    return BALLOONS * 100;
  },

  mount(container, ctx) {
    const { limits, rate } = ctx.params;
    shell = createShell(container, { title: "Palloncini", hint: `Palloncino 1 di ${BALLOONS}` });

    const feedback = el("div", { class: "balloon-feedback" });
    const stage = el("div", { class: "balloon-stage" });
    const balloon = el("div", { class: "balloon" });
    const knot = el("div", { class: "balloon-knot" });
    const string = el("div", { class: "balloon-string" });
    stage.append(balloon, knot, string);
    const help = el("div", { class: "hint", text: "Tieni premuto per gonfiare" });
    shell.body.append(feedback, stage, help);

    let index = 0;
    let total = 0;
    let poppedCount = 0;
    let size = 0;          // 0..1
    let holding = false;
    let settled = false;   // palloncino corrente concluso
    let done = false;
    let last = 0;

    const render = () => {
      const px = 40 + size * 220;
      balloon.style.width = `${px}px`;
      balloon.style.height = `${px * 1.15}px`;
      balloon.style.background = COLORS[index % COLORS.length];
      balloon.style.opacity = 0.9;
    };

    const nextBalloon = () => {
      index++;
      if (index >= BALLOONS) {
        done = true;
        shell.showDone(this.formatScore(total));
        ctx.onFinish(total, poppedCount === 0 ? "Nessuno scoppiato!" : `${poppedCount} ${poppedCount === 1 ? "scoppiato" : "scoppiati"} su ${BALLOONS}`);
        return;
      }
      size = 0;
      settled = false;
      balloon.classList.remove("pop");
      feedback.textContent = "";
      shell.setHint(`Palloncino ${index + 1} di ${BALLOONS}`);
      render();
    };

    const settle = (points, popped) => {
      if (settled) return;
      settled = true;
      holding = false;
      total += points;
      shell.setTimer(`${total}`);
      sfx.inflateStop();
      if (popped) {
        poppedCount++;
        sfx.play("pop");
        balloon.classList.add("pop");
        feedback.textContent = "BOOM! 0";
        feedback.className = "balloon-feedback bad";
        vibrate([90, 40, 90]);
      } else {
        feedback.textContent = `+${points}`;
        feedback.className = `balloon-feedback ${points >= 80 ? "great" : ""}`;
        vibrate(15);
        sfx.play(points >= 80 ? "perfect" : "good");
      }
      setTimeout(nextBalloon, 900);
    };

    const loop = (now) => {
      if (done) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (holding && !settled) {
        size = Math.min(1, size + rate * dt);
        sfx.inflateUpdate(size);
        render();
        if (size >= limits[index]) settle(0, true);
      }
      raf = requestAnimationFrame(loop);
    };

    const press = (ev) => {
      ev.preventDefault();
      if (done || settled) return;
      holding = true;
      sfx.inflateStart();
    };
    const release = () => {
      if (done || settled || !holding) return;
      holding = false;
      settle(Math.round(size * 100), false);
    };
    shell.area.addEventListener("pointerdown", press);
    shell.area.addEventListener("pointerup", release);
    shell.area.addEventListener("pointercancel", release);
    shell.area.addEventListener("pointerleave", release);

    shell.setTimer("0");
    render();
    raf = requestAnimationFrame((t) => { last = t; loop(t); });
  },

  unmount() {
    cancelAnimationFrame(raf);
    sfx.inflateStop();
    shell?.remove();
    shell = null;
  },
};
