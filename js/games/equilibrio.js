/*
  Equilibrio: una pallina sta su un'asse in bilico. Tocca a sinistra o a
  destra per inclinare l'asse e tenerla al centro. Se cade, finisce.
  Punteggio: secondi in equilibrio (max 30). Le spinte sono uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, fitCanvas, canvasPoint } from "./shell.js";

const DURATION = 30;
const W = 360, H = 420;
const SETTINGS = {
  facile: { gravity: 2.2, tilt: 1.6, gust: 0.35 },
  normale: { gravity: 3.0, tilt: 2.0, gust: 0.6 },
  difficile: { gravity: 3.8, tilt: 2.4, gust: 0.9 },
};

let shell = null;
let raf = null;

export default {
  id: "equilibrio",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const s = SETTINGS[difficulty] || SETTINGS.normale;
    // Raffiche: piccole spinte alla pallina, nei momenti e nelle direzioni decisi dal seme
    const gusts = [];
    for (let t = 1.5; t < DURATION; t += 1.2 + rng() * 2.2) gusts.push({ t, f: (rng() < 0.5 ? -1 : 1) * s.gust * (0.6 + rng() * 0.8) });
    return { ...s, gusts };
  },

  formatScore(score) {
    return `${score.toFixed(1)} s`;
  },

  isValidScore(score) {
    return score > 0.5;
  },

  maxScore() {
    return DURATION;
  },

  mount(container, ctx) {
    const p = ctx.params;
    shell = createShell(container, { title: "Equilibrio", hint: "Tocca a sinistra o a destra per inclinare", color: "#1b1a2e" });
    const canvas = el("canvas", { class: "run-canvas" });
    shell.body.append(canvas);
    const g = fitCanvas(canvas, shell.body, W, H);

    let x = 0, v = 0;        // posizione (-1..1) e velocità della pallina sull'asse
    let angle = 0;           // inclinazione dell'asse (radianti)
    let target = 0;          // inclinazione voluta col tocco
    let elapsed = 0, gustIdx = 0;
    let done = false;
    let last = performance.now();
    let holding = null;      // -1 sinistra, 1 destra, null

    const setHold = (ev) => {
      const q = canvasPoint(canvas, ev, W, H);
      holding = q.x < W / 2 ? -1 : 1;
    };
    canvas.addEventListener("pointerdown", (ev) => { ev.preventDefault(); if (!done) { setHold(ev); sfx.play("blip"); } });
    canvas.addEventListener("pointermove", (ev) => { if (holding !== null && (ev.pressure > 0 || ev.buttons)) setHold(ev); });
    const release = () => { holding = null; };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("pointerleave", release);

    const finish = (fell) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      const score = Math.round(Math.min(DURATION, elapsed) * 10) / 10;
      if (fell) { vibrate([80, 40, 80]); sfx.play("crash"); } else { vibrate(30); sfx.play("perfect"); }
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, fell ? `caduta dopo ${score.toFixed(1)} s` : "In equilibrio fino alla fine!");
    };

    const draw = () => {
      g.fillStyle = "#26254a";
      g.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H * 0.62, half = 140;
      // fulcro
      g.fillStyle = "#3f3d8a";
      g.beginPath();
      g.moveTo(cx - 26, cy + 60);
      g.lineTo(cx + 26, cy + 60);
      g.lineTo(cx, cy + 6);
      g.closePath();
      g.fill();
      // asse
      g.save();
      g.translate(cx, cy);
      g.rotate(angle);
      g.fillStyle = "#c98f4f";
      g.fillRect(-half, -6, half * 2, 12);
      g.fillStyle = "rgba(255,255,255,0.15)";
      g.fillRect(-4, -6, 8, 12);
      // pallina
      g.fillStyle = "#4cc9f0";
      g.beginPath();
      g.arc(x * half, -22, 16, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.4)";
      g.beginPath();
      g.arc(x * half - 5, -27, 5, 0, Math.PI * 2);
      g.fill();
      g.restore();
      // indicazione del tocco
      if (holding !== null) {
        g.fillStyle = "rgba(255,255,255,0.06)";
        g.fillRect(holding < 0 ? 0 : W / 2, 0, W / 2, H);
      }
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.font = "bold 16px Fredoka, sans-serif";
      g.textAlign = "center";
      g.fillText("◀ inclina", W * 0.25, H - 18);
      g.fillText("inclina ▶", W * 0.75, H - 18);
    };

    const step = (now) => {
      if (done) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      elapsed += dt;
      // inclinazione: il tocco la sposta, senza tocco torna lentamente piatta
      target = holding === null ? 0 : holding * 0.35;
      angle += (target - angle) * Math.min(1, p.tilt * dt);
      // raffiche
      while (gustIdx < p.gusts.length && p.gusts[gustIdx].t <= elapsed) { v += p.gusts[gustIdx].f; gustIdx++; sfx.play("blip"); }
      // fisica: la pallina scivola verso il basso dell'asse
      v += Math.sin(angle) * p.gravity * dt;
      v *= 1 - 0.15 * dt;
      x += v * dt;
      shell.setTimer(`${Math.ceil(DURATION - elapsed)} s`);
      draw();
      if (Math.abs(x) > 1.05) { finish(true); return; }
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
