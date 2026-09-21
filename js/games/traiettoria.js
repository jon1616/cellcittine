/*
  Traiettoria: un bersaglio si muove in alto. Fai scorrere il dito dalla
  palla verso il bersaglio per lanciarla: la palla parte nella direzione
  dello scorrimento. Otto lanci; punti per la precisione (max 100 l'uno).
  Il movimento del bersaglio è uguale per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, fitCanvas, canvasPoint } from "./shell.js";

const DURATION = 35;
const SHOTS = 8;
const W = 360, H = 520;
const BALL = { x: W / 2, y: H - 70, r: 16 };
const TARGET = { y: 80, r: 36 };
const SPEED = { facile: 0.7, normale: 1.0, difficile: 1.35 }; // velocità del bersaglio
const IDLE_LIMIT = 6000; // senza lanci: il tiro si perde

let shell = null;
let stopTimer = null;
let raf = null;
let idleTimer = null;

export default {
  id: "traiettoria",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const k = SPEED[difficulty] || SPEED.normale;
    // Moto del bersaglio: somma di due onde, diverse per ogni sfida
    return {
      motion: { a1: 90 + rng() * 40, w1: (0.9 + rng() * 0.5) * k, p1: rng() * 6.28, a2: 20 + rng() * 25, w2: (2 + rng() * 1.2) * k, p2: rng() * 6.28 },
    };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "punto" : "punti"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore() {
    return SHOTS * 100;
  },

  mount(container, ctx) {
    const { motion } = ctx.params;
    shell = createShell(container, { title: "Traiettoria", hint: "Scorri dalla palla verso il bersaglio", color: "#1b1a2e" });
    const canvas = el("canvas", { class: "run-canvas" });
    shell.body.append(canvas);
    const g = fitCanvas(canvas, shell.body, W, H);

    let shot = 0, score = 0, hits = 0;
    let ball = null;        // { x, y, vx, vy } in volo
    let drag = null;        // { x, y } inizio dello scorrimento
    let dragNow = null;
    let elapsed = 0;
    let last = performance.now();
    let done = false;
    let burst = null;       // effetto al colpo
    let lastText = "";

    const targetX = (t) => W / 2 + motion.a1 * Math.sin(motion.w1 * t + motion.p1) + motion.a2 * Math.sin(motion.w2 * t + motion.p2);

    const finish = () => {
      if (done) return;
      done = true;
      stopTimer?.();
      clearTimeout(idleTimer);
      cancelAnimationFrame(raf);
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, `${hits} ${hits === 1 ? "centro" : "centri"} su ${SHOTS}`);
    };

    const armIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (done || ball) return;
        shot++;
        lastText = "Tiro perso";
        sfx.play("bad");
        if (shot >= SHOTS) finish(); else armIdle();
      }, IDLE_LIMIT);
    };

    const launch = (dx, dy) => {
      const len = Math.hypot(dx, dy);
      if (len < 20 || dy > -10) return; // scorrimento troppo corto o non verso l'alto
      const v = 620;
      ball = { x: BALL.x, y: BALL.y, vx: (dx / len) * v, vy: (dy / len) * v };
      clearTimeout(idleTimer);
      vibrate(15);
      sfx.play("jump");
    };

    canvas.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      if (done || ball) return;
      try { canvas.setPointerCapture?.(ev.pointerId); } catch (_) { /* puntatore sintetico */ }
      drag = canvasPoint(canvas, ev, W, H);
      dragNow = drag;
    });
    canvas.addEventListener("pointermove", (ev) => { if (drag) dragNow = canvasPoint(canvas, ev, W, H); });
    const release = (ev) => {
      if (!drag) return;
      const p = canvasPoint(canvas, ev, W, H);
      const start = drag;
      drag = null;
      dragNow = null;
      launch(p.x - start.x, p.y - start.y);
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", () => { drag = null; dragNow = null; });

    const scoreShot = (dist) => {
      const pts = dist <= 12 ? 100 : dist <= 24 ? 60 : dist <= TARGET.r ? 30 : 0;
      shot++;
      if (pts > 0) { hits++; score += pts; burst = { x: ball.x, y: ball.y, life: 1 }; vibrate(30); sfx.play(pts === 100 ? "perfect" : "hit"); lastText = pts === 100 ? "Centro pieno! +100" : `Colpito +${pts}`; }
      else { sfx.play("bad"); lastText = "Mancato"; }
      shell.setHint(`Punti: ${score} · tiri ${shot}/${SHOTS}`);
      ball = null;
      if (shot >= SHOTS) finish(); else armIdle();
    };

    const draw = (tx) => {
      g.fillStyle = "#26254a";
      g.fillRect(0, 0, W, H);
      // bersaglio
      const rings = ["#f6f3ff", "#ff4d6d", "#f6f3ff", "#ff4d6d"];
      rings.forEach((c, i) => {
        g.fillStyle = c;
        g.beginPath();
        g.arc(tx, TARGET.y, TARGET.r - i * 9, 0, Math.PI * 2);
        g.fill();
      });
      g.fillStyle = "#ffb703";
      g.beginPath();
      g.arc(tx, TARGET.y, 5, 0, Math.PI * 2);
      g.fill();
      // guida dello scorrimento
      if (drag && dragNow) {
        g.strokeStyle = "rgba(255,255,255,0.4)";
        g.setLineDash([8, 8]);
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(BALL.x, BALL.y);
        g.lineTo(BALL.x + (dragNow.x - drag.x) * 1.6, BALL.y + (dragNow.y - drag.y) * 1.6);
        g.stroke();
        g.setLineDash([]);
      }
      // palla
      const b = ball || BALL;
      g.fillStyle = "#4cc9f0";
      g.beginPath();
      g.arc(b.x, b.y, BALL.r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.4)";
      g.beginPath();
      g.arc(b.x - 5, b.y - 5, 5, 0, Math.PI * 2);
      g.fill();
      // effetto colpo
      if (burst) {
        g.strokeStyle = `rgba(255, 183, 3, ${burst.life})`;
        g.lineWidth = 4;
        g.beginPath();
        g.arc(burst.x, burst.y, 20 + (1 - burst.life) * 40, 0, Math.PI * 2);
        g.stroke();
      }
      // testo ultimo tiro e contatore
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.font = "bold 18px Fredoka, sans-serif";
      g.textAlign = "center";
      g.fillText(lastText, W / 2, H - 22);
      for (let i = 0; i < SHOTS; i++) {
        g.fillStyle = i < shot ? "rgba(255,255,255,0.25)" : "#ffb703";
        g.beginPath();
        g.arc(20 + i * 18, 20, 5, 0, Math.PI * 2);
        g.fill();
      }
    };

    const step = (now) => {
      if (done) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      elapsed += dt;
      const tx = targetX(elapsed);
      if (ball) {
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        const d = Math.hypot(ball.x - tx, ball.y - TARGET.y);
        if (d <= TARGET.r + BALL.r * 0.3 && ball.y <= TARGET.y + TARGET.r) scoreShot(d);
        else if (ball.y < -BALL.r || ball.x < -BALL.r || ball.x > W + BALL.r) scoreShot(999);
      }
      if (burst) { burst.life -= dt * 2.5; if (burst.life <= 0) burst = null; }
      draw(tx);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame((t) => { last = t; step(t); });

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => finish()
    );
    armIdle();
  },

  unmount() {
    stopTimer?.();
    clearTimeout(idleTimer);
    cancelAnimationFrame(raf);
    shell?.remove();
    shell = null;
  },
};
