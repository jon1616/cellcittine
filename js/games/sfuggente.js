/*
  Sfuggente: una pallina rimbalza per lo schermo. Toccala! Ogni volta che la
  prendi diventa più veloce e più piccola. 20 secondi. Traiettorie uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, fitCanvas, canvasPoint } from "./shell.js";

const DURATION = 20;
const W = 360, H = 480;
const SETTINGS = {
  facile: { speed: 170, radius: 34, grow: 1.07, shrink: 0.96, minR: 18 },
  normale: { speed: 220, radius: 30, grow: 1.09, shrink: 0.95, minR: 15 },
  difficile: { speed: 280, radius: 26, grow: 1.1, shrink: 0.94, minR: 12 },
};

let shell = null;
let stopTimer = null;
let raf = null;

export default {
  id: "sfuggente",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const s = SETTINGS[difficulty] || SETTINGS.normale;
    // Una direzione nuova a ogni cattura (e per la partenza)
    const angles = Array.from({ length: 80 }, () => 0.5 + rng() * 2.1 + (rng() < 0.5 ? Math.PI : 0));
    return { ...s, angles, startX: 60 + rng() * (W - 120), startY: 80 + rng() * (H - 160) };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "presa" : "prese"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const p = ctx.params;
    shell = createShell(container, { title: "Sfuggente", hint: "Tocca la pallina!", color: "#1b1a2e" });
    const canvas = el("canvas", { class: "run-canvas" });
    shell.body.append(canvas);
    const g = fitCanvas(canvas, shell.body, W, H);

    let x = p.startX, y = p.startY, r = p.radius, speed = p.speed;
    let k = 0;
    let vx = Math.cos(p.angles[0]) * speed, vy = Math.sin(p.angles[0]) * speed;
    let score = 0, misses = 0;
    let done = false;
    let last = performance.now();
    let flash = null;
    let hue = 0;

    canvas.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      if (done) return;
      const q = canvasPoint(canvas, ev, W, H);
      if (Math.hypot(q.x - x, q.y - y) <= r + 6) {
        score++;
        vibrate(15);
        sfx.play("hit");
        flash = { x, y, life: 1 };
        speed *= p.grow;
        r = Math.max(p.minR, r * p.shrink);
        k = (k + 1) % p.angles.length;
        vx = Math.cos(p.angles[k]) * speed;
        vy = Math.sin(p.angles[k]) * speed;
        hue = (hue + 47) % 360;
        shell.setHint(`Prese: ${score}`);
      } else {
        misses++;
        sfx.play("blip");
      }
    });

    const step = (now) => {
      if (done) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      x += vx * dt; y += vy * dt;
      if (x < r) { x = r; vx = Math.abs(vx); sfx.play("tock"); }
      if (x > W - r) { x = W - r; vx = -Math.abs(vx); sfx.play("tock"); }
      if (y < r) { y = r; vy = Math.abs(vy); sfx.play("tock"); }
      if (y > H - r) { y = H - r; vy = -Math.abs(vy); sfx.play("tock"); }

      g.fillStyle = "#26254a";
      g.fillRect(0, 0, W, H);
      if (flash) {
        g.strokeStyle = `rgba(255,255,255,${flash.life})`;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(flash.x, flash.y, 20 + (1 - flash.life) * 50, 0, Math.PI * 2);
        g.stroke();
        flash.life -= dt * 3;
        if (flash.life <= 0) flash = null;
      }
      g.fillStyle = `hsl(${hue + 40} 90% 60%)`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.45)";
      g.beginPath();
      g.arc(x - r * 0.3, y - r * 0.3, r * 0.28, 0, Math.PI * 2);
      g.fill();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame((t) => { last = t; step(t); });

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => {
        done = true;
        cancelAnimationFrame(raf);
        shell.showDone(this.formatScore(score));
        ctx.onFinish(score, `${misses} ${misses === 1 ? "tocco a vuoto" : "tocchi a vuoto"}`);
      }
    );
  },

  unmount() {
    stopTimer?.();
    cancelAnimationFrame(raf);
    shell?.remove();
    shell = null;
  },
};
