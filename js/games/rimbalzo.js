/*
  Rimbalzo: una racchetta in basso, una pallina che rimbalza sulle pareti.
  Muovi la racchetta col dito e tienila in gioco: ogni rimbalzo sulla
  racchetta vale un punto e la pallina accelera. Tre palline, 30 secondi.
  Partenza uguale per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, fitCanvas, canvasPoint } from "./shell.js";

const DURATION = 30;
const W = 360, H = 480;
const PADDLE_W = { facile: 110, normale: 84, difficile: 64 };
const SPEED0 = { facile: 240, normale: 290, difficile: 340 };
const BALLS = 3;

let shell = null;
let raf = null;
let stopTimer = null;

export default {
  id: "rimbalzo",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    // Direzioni di partenza delle palline (angolo in gradi rispetto alla verticale)
    const starts = Array.from({ length: BALLS }, () => (rng() < 0.5 ? -1 : 1) * (20 + rng() * 35));
    return { paddle: PADDLE_W[difficulty] || PADDLE_W.normale, speed: SPEED0[difficulty] || SPEED0.normale, starts };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "rimbalzo" : "rimbalzi"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const p = ctx.params;
    shell = createShell(container, { title: "Rimbalzo", hint: "Muovi la racchetta e tieni la pallina in gioco", color: "#1b1a2e" });
    const canvas = el("canvas", { class: "run-canvas" });
    shell.body.append(canvas);
    const g = fitCanvas(canvas, shell.body, W, H);
    const PY = H - 40, R = 10;

    let px = W / 2;
    let ball = null, ballNo = 0, ballsLeft = BALLS;
    let score = 0, done = false, last = performance.now();
    let serveAt = 0;

    const serve = () => {
      const a = ((p.starts[ballNo % p.starts.length]) * Math.PI) / 180;
      const v = p.speed;
      ball = { x: W / 2, y: H / 2 - 40, vx: Math.sin(a) * v, vy: Math.cos(a) * v };
      ballNo++;
    };
    serveAt = performance.now() + 700;

    const move = (ev) => {
      const q = canvasPoint(canvas, ev, W, H);
      px = Math.max(p.paddle / 2, Math.min(W - p.paddle / 2, q.x));
    };
    canvas.addEventListener("pointerdown", (ev) => { ev.preventDefault(); move(ev); try { canvas.setPointerCapture(ev.pointerId); } catch (_) { /* sintetico */ } });
    canvas.addEventListener("pointermove", (ev) => { if (ev.buttons || ev.pressure > 0) move(ev); });

    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      stopTimer?.();
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, ballsLeft > 0 ? `${score} rimbalzi, ${BALLS - ballsLeft} ${BALLS - ballsLeft === 1 ? "pallina persa" : "palline perse"}` : `tutte le palline perse dopo ${score} rimbalzi`);
    };

    const step = (now) => {
      if (done) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (!ball && ballsLeft > 0 && now >= serveAt) serve();
      if (ball) {
        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        if (ball.x < R) { ball.x = R; ball.vx = Math.abs(ball.vx); sfx.play("blip"); }
        if (ball.x > W - R) { ball.x = W - R; ball.vx = -Math.abs(ball.vx); sfx.play("blip"); }
        if (ball.y < R) { ball.y = R; ball.vy = Math.abs(ball.vy); sfx.play("blip"); }
        // racchetta
        if (ball.vy > 0 && ball.y + R >= PY - 6 && ball.y + R <= PY + 14 && Math.abs(ball.x - px) <= p.paddle / 2 + R) {
          const rel = (ball.x - px) / (p.paddle / 2); // -1..1
          const speed = Math.hypot(ball.vx, ball.vy) * 1.04;
          const ang = rel * 1.05; // radianti dalla verticale
          ball.vx = Math.sin(ang) * speed; ball.vy = -Math.cos(ang) * speed;
          ball.y = PY - 6 - R;
          score++;
          vibrate(8);
          sfx.play("hit");
          shell.setHint(`Rimbalzi: ${score} · palline ${ballsLeft}`);
        }
        if (ball.y > H + R) { // persa
          ball = null; ballsLeft--;
          vibrate([60, 30, 60]);
          sfx.play("crash");
          shell.setHint(`Rimbalzi: ${score} · palline ${ballsLeft}`);
          if (ballsLeft <= 0) { setTimeout(finish, 400); }
          else serveAt = now + 800;
        }
      }
      draw();
      raf = requestAnimationFrame(step);
    };

    const draw = () => {
      g.clearRect(0, 0, W, H);
      g.fillStyle = "#26254a"; g.fillRect(0, 0, W, H);
      g.strokeStyle = "rgba(255,255,255,0.12)"; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2);
      // racchetta
      g.fillStyle = "#ffb703"; g.beginPath(); g.roundRect(px - p.paddle / 2, PY - 6, p.paddle, 12, 6); g.fill();
      // pallina
      if (ball) { g.beginPath(); g.arc(ball.x, ball.y, R, 0, Math.PI * 2); g.fillStyle = "#36cfc9"; g.fill(); }
      // palline rimaste
      for (let i = 0; i < ballsLeft; i++) { g.beginPath(); g.arc(18 + i * 18, 18, 6, 0, Math.PI * 2); g.fillStyle = "#f6f3ff"; g.fill(); }
    };

    stopTimer = runTimer(DURATION, (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`), finish);
    raf = requestAnimationFrame((t) => { last = t; step(t); });
  },

  unmount() {
    cancelAnimationFrame(raf);
    stopTimer?.();
    shell?.remove();
    shell = null;
  },
};
