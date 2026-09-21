/*
  Strada: la strada scende e curva; tieni la macchina sull'asfalto toccando
  a sinistra o a destra. Uscire di strada ferma la corsa. Punteggio: metri
  percorsi (max 300). Le curve sono uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, fitCanvas, canvasPoint } from "./shell.js";

const DURATION = 30;
const W = 360, H = 520;
const SETTINGS = {
  facile: { width: 150, scroll: 220, steer: 260, wiggle: 70 },
  normale: { width: 120, scroll: 280, steer: 300, wiggle: 95 },
  difficile: { width: 96, scroll: 340, steer: 330, wiggle: 115 },
};
const CAR_Y = H - 90, CAR_W = 34, CAR_H = 54;

let shell = null;
let raf = null;

export default {
  id: "strada",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const s = SETTINGS[difficulty] || SETTINGS.normale;
    // Il centro della strada in funzione della distanza: somma di onde dal seme
    const waves = Array.from({ length: 3 }, (_, i) => ({ a: s.wiggle * (i === 0 ? 1 : 0.45), k: (0.003 + rng() * 0.003) / (i + 1), p: rng() * 6.28 }));
    return { ...s, waves };
  },

  formatScore(score) {
    return `${score} m`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore() {
    return DURATION * 10;
  },

  mount(container, ctx) {
    const p = ctx.params;
    shell = createShell(container, { title: "Strada", hint: "Resta sull'asfalto", color: "#1b1a2e" });
    const canvas = el("canvas", { class: "run-canvas" });
    shell.body.append(canvas);
    const g = fitCanvas(canvas, shell.body, W, H);

    const centerAt = (d) => W / 2 + p.waves.reduce((acc, w) => acc + w.a * Math.sin(w.k * d + w.p), 0);

    let dist = 0;             // distanza percorsa (px)
    let carX = centerAt(H - CAR_Y); // la macchina parte al centro della strada
    let holding = null;
    let elapsed = 0;
    let done = false;
    let last = performance.now();

    const setHold = (ev) => { const q = canvasPoint(canvas, ev, W, H); holding = q.x < W / 2 ? -1 : 1; };
    canvas.addEventListener("pointerdown", (ev) => { ev.preventDefault(); if (!done) setHold(ev); });
    canvas.addEventListener("pointermove", (ev) => { if (holding !== null && (ev.pressure > 0 || ev.buttons)) setHold(ev); });
    const release = () => { holding = null; };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("pointerleave", release);

    const meters = () => Math.round(Math.min(DURATION, elapsed) * 10);

    const finish = (crashed) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      if (crashed) { vibrate([90, 40, 90]); sfx.play("crash"); } else { vibrate(30); sfx.play("perfect"); }
      shell.showDone(this.formatScore(meters()));
      ctx.onFinish(meters(), crashed ? `fuori strada dopo ${meters()} m` : "Arrivo senza uscire di strada!");
    };

    const draw = () => {
      // prato
      g.fillStyle = "#2d6a4f";
      g.fillRect(0, 0, W, H);
      // strada: una striscia per ogni riga di schermo (dal basso verso l'alto la distanza cresce)
      g.fillStyle = "#3a3960";
      for (let y = 0; y < H; y += 4) {
        const c = centerAt(dist + (H - y));
        g.fillRect(c - p.width / 2, y, p.width, 4);
      }
      // linea di mezzeria tratteggiata
      g.fillStyle = "rgba(255,255,255,0.5)";
      for (let y = -((dist * 1) % 40); y < H; y += 40) {
        const c = centerAt(dist + (H - y));
        g.fillRect(c - 2, y, 4, 18);
      }
      // macchina
      g.fillStyle = "#ffb703";
      g.beginPath();
      g.roundRect(carX - CAR_W / 2, CAR_Y - CAR_H / 2, CAR_W, CAR_H, 8);
      g.fill();
      g.fillStyle = "#1b1a2e";
      g.fillRect(carX - CAR_W / 2 + 5, CAR_Y - CAR_H / 2 + 8, CAR_W - 10, 12);
      g.fillRect(carX - CAR_W / 2 + 5, CAR_Y + CAR_H / 2 - 16, CAR_W - 10, 8);
      if (holding !== null) {
        g.fillStyle = "rgba(255,255,255,0.05)";
        g.fillRect(holding < 0 ? 0 : W / 2, 0, W / 2, H);
      }
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.font = "bold 16px Fredoka, sans-serif";
      g.textAlign = "center";
      g.fillText("◀", W * 0.15, H - 16);
      g.fillText("▶", W * 0.85, H - 16);
    };

    const step = (now) => {
      if (done) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      elapsed += dt;
      dist += p.scroll * dt;
      if (holding !== null) carX += holding * p.steer * dt;
      carX = Math.max(CAR_W / 2, Math.min(W - CAR_W / 2, carX));
      shell.setTimer(`${meters()} m`);
      draw();
      const c = centerAt(dist + (H - CAR_Y));
      if (Math.abs(carX - c) > p.width / 2 - CAR_W / 2 + 6) { finish(true); return; }
      if (elapsed >= DURATION) { finish(false); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame((t) => { last = t; step(t); });
  },

  unmount() {
    cancelAnimationFrame(raf);
    shell?.remove();
    shell = null;
  },
};
