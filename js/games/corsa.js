/*
  Corsa: tre corsie, ostacoli che scendono sempre più veloci. Tocca a sinistra
  o a destra dello schermo per cambiare corsia e resisti fino alla fine.
  Punteggio: secondi di corsa (max 30). Ostacoli uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, fitCanvas, canvasPoint } from "./shell.js";

const DURATION = 30;
const W = 360, H = 520;
const LANES = 3;
const SPEED = { facile: 230, normale: 290, difficile: 350 }; // px/s all'inizio
const GAP = { facile: 1.15, normale: 0.95, difficile: 0.8 }; // secondi tra un ostacolo e l'altro

let shell = null;
let raf = null;

export default {
  id: "corsa",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    // Ostacoli: istante di comparsa e corsia; mai tutte e tre le corsie chiuse nello stesso momento
    const gap = GAP[difficulty] || GAP.normale;
    const obstacles = [];
    let t = 1.2, lastLane = 1;
    while (t < DURATION + 2) {
      let lane = Math.floor(rng() * LANES);
      if (rng() < 0.35 && lane === lastLane) lane = (lane + 1 + Math.floor(rng() * 2)) % LANES;
      obstacles.push({ t, lane });
      if (rng() < 0.3) obstacles.push({ t, lane: (lane + 1 + Math.floor(rng() * 2)) % LANES }); // due insieme
      lastLane = lane;
      t += gap * (0.7 + rng() * 0.6);
    }
    return { obstacles, speed: SPEED[difficulty] || SPEED.normale };
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
    shell = createShell(container, { title: "Corsa", hint: "Tocca a sinistra o a destra per cambiare corsia", color: "#1b1a2e" });
    const canvas = el("canvas", { class: "run-canvas" });
    shell.body.append(canvas);
    const g = fitCanvas(canvas, shell.body, W, H);
    const laneX = (i) => (W / LANES) * (i + 0.5);
    const CAR_Y = H - 90;

    let lane = 1, targetLane = 1, carX = laneX(1);
    let elapsed = 0, done = false, last = performance.now();
    let road = 0;
    const active = []; // { lane, y }
    let next = 0;

    canvas.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      if (done) return;
      const q = canvasPoint(canvas, ev, W, H);
      targetLane = Math.max(0, Math.min(LANES - 1, targetLane + (q.x < W / 2 ? -1 : 1)));
      sfx.play("swoosh");
    });

    const finish = (crashed) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      const score = Math.round(Math.min(DURATION, elapsed) * 10) / 10;
      if (crashed) { vibrate([80, 40, 80]); sfx.play("crash"); } else { vibrate(30); sfx.play("perfect"); }
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, crashed ? `schianto dopo ${score.toFixed(1)} s` : "Traguardo senza un graffio!");
    };

    const step = (now) => {
      if (done) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;
      const speed = p.speed * (1 + elapsed / DURATION * 0.8);
      road = (road + speed * dt) % 60;
      shell.setTimer(`${Math.max(0, DURATION - elapsed).toFixed(0)} s`);
      shell.setProgress(1 - elapsed / DURATION);
      while (next < p.obstacles.length && p.obstacles[next].t <= elapsed) { active.push({ lane: p.obstacles[next].lane, y: -30 }); next++; }
      for (const o of active) o.y += speed * dt;
      for (let i = active.length - 1; i >= 0; i--) if (active[i].y > H + 40) active.splice(i, 1);
      // macchina scivola verso la corsia scelta
      lane = targetLane;
      carX += (laneX(lane) - carX) * Math.min(1, dt * 14);
      // collisione
      for (const o of active) {
        if (Math.abs(laneX(o.lane) - carX) < 40 && o.y > CAR_Y - 34 && o.y < CAR_Y + 30) { finish(true); return; }
      }
      if (elapsed >= DURATION) { finish(false); return; }
      draw(speed);
      raf = requestAnimationFrame(step);
    };

    const draw = () => {
      g.clearRect(0, 0, W, H);
      g.fillStyle = "#2b2a5e"; g.fillRect(0, 0, W, H);
      g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 3; g.setLineDash([24, 36]); g.lineDashOffset = -road;
      for (let i = 1; i < LANES; i++) { g.beginPath(); g.moveTo((W / LANES) * i, 0); g.lineTo((W / LANES) * i, H); g.stroke(); }
      g.setLineDash([]);
      for (const o of active) {
        g.fillStyle = "#ff4d6d"; g.beginPath(); g.roundRect(laneX(o.lane) - 28, o.y - 24, 56, 48, 10); g.fill();
        g.fillStyle = "#1b1a2e"; g.fillRect(laneX(o.lane) - 18, o.y - 6, 36, 12);
      }
      g.fillStyle = "#ffb703"; g.beginPath(); g.roundRect(carX - 26, CAR_Y - 34, 52, 68, 14); g.fill();
      g.fillStyle = "#36cfc9"; g.fillRect(carX - 18, CAR_Y - 22, 36, 16);
      g.fillStyle = "#1b1a2e"; g.fillRect(carX - 24, CAR_Y + 14, 12, 14); g.fillRect(carX + 12, CAR_Y + 14, 12, 14);
    };
    raf = requestAnimationFrame((t) => { last = t; step(t); });
  },

  unmount() {
    cancelAnimationFrame(raf);
    shell?.remove();
    shell = null;
  },
};
