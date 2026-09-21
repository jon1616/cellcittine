/*
  Palloncini: una riga tratteggiata indica quanto gonfiare. Tieni premuto per
  gonfiare e lascia quando il palloncino arriva alla riga: più sei preciso,
  più punti. Se lo gonfi troppo oltre la riga, scoppia (zero). Cinque
  palloncini, con altezze diverse (uguali per tutti). Nessuna fortuna: la riga
  si vede sempre, conta il controllo.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell } from "./shell.js";

const BALLOONS = 5;
const SETTINGS = {
  facile: { min: 0.45, max: 0.9, rate: 0.28, margin: 0.14 },
  normale: { min: 0.4, max: 0.95, rate: 0.36, margin: 0.09 },
  difficile: { min: 0.35, max: 1.0, rate: 0.46, margin: 0.06 },
};
const COLORS = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#f15bb5"];
const IDLE_LIMIT = 8000; // senza tocchi: il palloncino vale zero e si passa al prossimo
const MIN_PX = 40, GROW_PX = 220, KNOT_STRING_PX = 70; // misure del disegno (vedi css)

let shell = null;
let raf = null;
let idleTimer = null;
let nextTimer = null;

export default {
  id: "palloncini",
  order: "desc",
  maxSeconds: 50,

  createParams(rng, difficulty) {
    const s = SETTINGS[difficulty] || SETTINGS.normale;
    const targets = Array.from({ length: BALLOONS }, () => Math.round((s.min + rng() * (s.max - s.min)) * 100) / 100);
    return { targets, rate: s.rate, margin: s.margin };
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
    const { targets, rate, margin } = ctx.params;
    shell = createShell(container, { title: "Palloncini", hint: `Palloncino 1 di ${BALLOONS} · gonfia fino alla riga` });

    const feedback = el("div", { class: "balloon-feedback" });
    const stage = el("div", { class: "balloon-stage" });
    const targetLine = el("div", { class: "balloon-target" }, [el("span", { text: "▼ fin qui ▼" })]);
    const balloon = el("div", { class: "balloon" });
    const knot = el("div", { class: "balloon-knot" });
    const string = el("div", { class: "balloon-string" });
    stage.append(targetLine, balloon, knot, string);
    const help = el("div", { class: "hint", text: "Tieni premuto per gonfiare, lascia alla riga" });
    shell.body.append(feedback, stage, help);

    let index = 0;
    let total = 0;
    let poppedCount = 0, perfectCount = 0;
    let size = 0;          // 0..1
    let holding = false;
    let settled = false;   // palloncino corrente concluso
    let done = false;
    let last = 0;

    const heightPx = (s) => (MIN_PX + s * GROW_PX) * 1.15;

    const render = () => {
      const px = MIN_PX + size * GROW_PX;
      balloon.style.width = `${px}px`;
      balloon.style.height = `${px * 1.15}px`;
      balloon.style.background = COLORS[index % COLORS.length];
      balloon.style.opacity = 0.9;
    };

    const placeTarget = () => {
      targetLine.style.bottom = `${KNOT_STRING_PX + heightPx(targets[index])}px`;
    };

    const armIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { if (!done && !settled) settle(0, false, "Tempo scaduto"); }, IDLE_LIMIT);
    };

    const nextBalloon = () => {
      index++;
      if (index >= BALLOONS) {
        done = true;
        clearTimeout(idleTimer);
        shell.showDone(this.formatScore(total));
        const parts = [];
        if (perfectCount) parts.push(`${perfectCount} ${perfectCount === 1 ? "perfetto" : "perfetti"}`);
        parts.push(poppedCount === 0 ? "nessuno scoppiato" : `${poppedCount} ${poppedCount === 1 ? "scoppiato" : "scoppiati"}`);
        ctx.onFinish(total, parts.join(", "));
        return;
      }
      size = 0;
      settled = false;
      balloon.classList.remove("pop");
      feedback.textContent = "";
      shell.setHint(`Palloncino ${index + 1} di ${BALLOONS} · gonfia fino alla riga`);
      placeTarget();
      render();
      armIdle();
    };

    const settle = (points, popped, text = null) => {
      if (settled) return;
      settled = true;
      holding = false;
      clearTimeout(idleTimer);
      total += points;
      shell.setTimer(`${total}`);
      sfx.inflateStop();
      if (popped) {
        poppedCount++;
        sfx.play("pop");
        balloon.classList.add("pop");
        feedback.textContent = "BOOM! Troppo oltre la riga";
        feedback.className = "balloon-feedback bad";
        vibrate([90, 40, 90]);
      } else if (points === 0) {
        feedback.textContent = text || "0";
        feedback.className = "balloon-feedback bad";
        sfx.play("bad");
      } else {
        if (points >= 95) perfectCount++;
        feedback.textContent = points >= 95 ? `Perfetto! +${points}` : `+${points}`;
        feedback.className = `balloon-feedback ${points >= 80 ? "great" : ""}`;
        vibrate(15);
        sfx.play(points >= 80 ? "perfect" : "good");
      }
      nextTimer = setTimeout(nextBalloon, 900);
    };

    const loop = (now) => {
      if (done) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (holding && !settled) {
        size = Math.min(1.2, size + rate * dt);
        sfx.inflateUpdate(Math.min(1, size));
        render();
        if (size >= targets[index] + margin) settle(0, true);
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
      // Punti per la vicinanza alla riga: 2% di scarto ≈ 90, 20% = 0
      const diff = Math.abs(size - targets[index]);
      settle(Math.max(0, Math.round(100 - diff * 500)), false);
    };
    shell.area.addEventListener("pointerdown", press);
    shell.area.addEventListener("pointerup", release);
    shell.area.addEventListener("pointercancel", release);
    shell.area.addEventListener("pointerleave", release);

    shell.setTimer("0");
    placeTarget();
    render();
    armIdle();
    raf = requestAnimationFrame((t) => { last = t; loop(t); });
  },

  unmount() {
    cancelAnimationFrame(raf);
    clearTimeout(idleTimer);
    clearTimeout(nextTimer);
    sfx.inflateStop();
    shell?.remove();
    shell = null;
  },
};
