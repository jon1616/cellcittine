/*
  Pesca: il galleggiante ondeggia sull'acqua. Quando il pesce abbocca (il
  galleggiante affonda di colpo) tocca subito: più sei rapido, più punti.
  Se tocchi prima, il pesce scappa. Cinque pesci; i tempi sono uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, fitCanvas } from "./shell.js";

const ATTEMPTS = 5;
const W = 360, H = 420;
const SETTINGS = {
  facile: { min: 1800, max: 4500, window: 900, nibbles: 0 },
  normale: { min: 1500, max: 5500, window: 700, nibbles: 1 },
  difficile: { min: 1200, max: 6500, window: 520, nibbles: 2 },
};
const PAUSE = 1100; // tra un pesce e l'altro

let shell = null;
let raf = null;
let timer = null;
let nibbleTimers = [];

export default {
  id: "pesca",
  order: "desc",
  maxSeconds: 42,

  createParams(rng, difficulty) {
    const s = SETTINGS[difficulty] || SETTINGS.normale;
    const fish = Array.from({ length: ATTEMPTS }, () => {
      const delay = s.min + Math.floor(rng() * (s.max - s.min));
      // Finti morsi: piccoli scossoni prima del vero
      const nibbles = Array.from({ length: s.nibbles }, () => 600 + Math.floor(rng() * Math.max(200, delay - 900)));
      return { delay, nibbles: nibbles.filter((t) => t < delay - 400) };
    });
    return { fish, window: s.window };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "punto" : "punti"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore() {
    return ATTEMPTS * 100;
  },

  mount(container, ctx) {
    const { fish, window: win } = ctx.params;
    shell = createShell(container, { title: "Pesca", hint: "Tocca quando il pesce abbocca!", color: "#1b1a2e" });
    const canvas = el("canvas", { class: "run-canvas" });
    const feedback = el("div", { class: "pesca-feedback", text: "" });
    shell.body.append(canvas, feedback);
    const g = fitCanvas(canvas, shell.body, W, H);

    let attempt = 0;
    let score = 0, caught = 0;
    let phase = "wait";       // wait -> bite -> gap -> done
    let biteAt = 0;           // istante del morso
    let dip = 0;              // quanto il galleggiante affonda (0..1)
    let nibbleUntil = 0;
    let t0 = performance.now();
    let done = false;
    let started = null;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, `${caught} ${caught === 1 ? "pesce preso" : "pesci presi"} su ${ATTEMPTS}`);
    };

    const say = (text, cls = "") => { feedback.textContent = text; feedback.className = `pesca-feedback ${cls}`; };

    const startAttempt = () => {
      if (done) return;
      if (attempt >= ATTEMPTS) { finish(); return; }
      const f = fish[attempt];
      phase = "wait";
      dip = 0;
      started = performance.now();
      shell.setHint(`Pesce ${attempt + 1} di ${ATTEMPTS} · aspetta…`);
      say("");
      nibbleTimers.forEach(clearTimeout);
      nibbleTimers = f.nibbles.map((n) => setTimeout(() => { if (!done && phase === "wait") { nibbleUntil = performance.now() + 220; sfx.play("blip"); } }, n));
      timer = setTimeout(() => {
        if (done || phase !== "wait") return;
        phase = "bite";
        biteAt = performance.now();
        sfx.play("splash");
        vibrate(30);
        timer = setTimeout(() => { if (phase === "bite") escaped("Scappato, troppo tardi!"); }, win);
      }, f.delay);
    };

    const escaped = (text) => {
      phase = "gap";
      clearTimeout(timer);
      sfx.play("bad");
      vibrate([60, 30, 60]);
      say(text, "bad");
      attempt++;
      timer = setTimeout(startAttempt, PAUSE);
    };

    canvas.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      if (done) return;
      if (phase === "wait") { escaped("Troppo presto: il pesce è scappato!"); return; }
      if (phase !== "bite") return;
      const ms = performance.now() - biteAt;
      const pts = Math.max(10, Math.round(100 * (1 - ms / win)));
      phase = "gap";
      clearTimeout(timer);
      score += pts;
      caught++;
      vibrate(40);
      sfx.play(pts >= 80 ? "perfect" : "good");
      say(`Preso! +${pts} (${Math.round(ms)} ms)`, pts >= 80 ? "great" : "");
      shell.setHint(`Punti: ${score}`);
      attempt++;
      timer = setTimeout(startAttempt, PAUSE);
    });

    const draw = (now) => {
      const t = (now - t0) / 1000;
      // cielo e acqua
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#2b2a5e");
      sky.addColorStop(0.45, "#3f3d8a");
      sky.addColorStop(0.46, "#1982c4");
      sky.addColorStop(1, "#0b4f7a");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      // onde
      g.strokeStyle = "rgba(255,255,255,0.25)";
      g.lineWidth = 2;
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        for (let x = 0; x <= W; x += 8) g.lineTo(x, H * 0.46 + 30 + k * 60 + Math.sin(x / 28 + t * 1.5 + k) * 4);
        g.stroke();
      }
      // galleggiante
      const bob = Math.sin(t * 2.2) * 4;
      const nib = now < nibbleUntil ? 10 : 0;
      if (phase === "bite") dip = Math.min(1, dip + 0.25); else dip = Math.max(0, dip - 0.1);
      const fy = H * 0.46 + bob + nib + dip * 34;
      const fx = W / 2;
      // lenza
      g.strokeStyle = "rgba(255,255,255,0.6)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(fx, 0);
      g.lineTo(fx, fy - 26);
      g.stroke();
      g.fillStyle = "#f6f3ff";
      g.beginPath();
      g.ellipse(fx, fy - 8, 11, 18, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#ff4d6d";
      g.beginPath();
      g.ellipse(fx, fy - 18, 11, 9, 0, Math.PI, 0);
      g.fill();
      g.fillStyle = "#ffb703";
      g.fillRect(fx - 2, fy - 34, 4, 10);
      // pesce (quando abbocca)
      if (dip > 0.2) {
        g.globalAlpha = dip;
        g.fillStyle = "#ff924c";
        g.beginPath();
        g.ellipse(fx + 6, fy + 22, 22, 11, 0.2, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.moveTo(fx + 26, fy + 22);
        g.lineTo(fx + 40, fy + 12);
        g.lineTo(fx + 40, fy + 32);
        g.closePath();
        g.fill();
        g.fillStyle = "#1b1a2e";
        g.beginPath();
        g.arc(fx - 6, fy + 19, 2.2, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }
      // contatore pesci
      for (let i = 0; i < ATTEMPTS; i++) {
        g.fillStyle = i < caught ? "#ffb703" : i < attempt ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.45)";
        g.beginPath();
        g.arc(24 + i * 22, 24, 7, 0, Math.PI * 2);
        g.fill();
      }
    };

    const loop = (now) => {
      if (done) return;
      draw(now);
      shell.setTimer(`${caught}/${ATTEMPTS} 🐟`);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    startAttempt();
  },

  unmount() {
    clearTimeout(timer);
    nibbleTimers.forEach(clearTimeout);
    nibbleTimers = [];
    cancelAnimationFrame(raf);
    shell?.remove();
    shell = null;
  },
};
