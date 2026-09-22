/*
  Ricalco: una forma tratteggiata; ripassala col dito senza staccarlo.
  Fino a 100 punti per forma in base a quanto il tuo tratto le sta vicino.
  Tre forme, forme uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, fitCanvas, canvasPoint, shuffle } from "./shell.js";

const SHAPES = 3;
const W = 340, H = 400;
const SHAPE_SECONDS = 9;
const TOL = { facile: 26, normale: 20, difficile: 15 };

// Forme come sequenze di punti (chiuse o aperte), centrate
function makeShape(rng, kind) {
  const cx = W / 2, cy = H / 2 - 10, R = 120;
  const pts = [];
  if (kind === 0) { // stella
    const n = 5;
    for (let i = 0; i <= n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n; const r = i % 2 ? R * 0.48 : R; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  } else if (kind === 1) { // onda
    const amp = 60 + rng() * 40, waves = 1 + Math.floor(rng() * 2);
    for (let i = 0; i <= 40; i++) { const x = 30 + (i / 40) * (W - 60); pts.push([x, cy + Math.sin((i / 40) * Math.PI * 2 * waves) * amp]); }
  } else if (kind === 2) { // zigzag
    const n = 4 + Math.floor(rng() * 3);
    for (let i = 0; i <= n; i++) pts.push([30 + (i / n) * (W - 60), i % 2 ? cy + 90 : cy - 90]);
  } else if (kind === 3) { // cuore
    for (let i = 0; i <= 60; i++) { const t = (i / 60) * Math.PI * 2; pts.push([cx + 16 * Math.pow(Math.sin(t), 3) * 7, cy - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 7]); }
  } else { // spirale
    for (let i = 0; i <= 80; i++) { const t = (i / 80) * Math.PI * 4; const r = 10 + (i / 80) * R; pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); }
  }
  return pts.map(([x, y]) => [Math.round(x), Math.round(y)]);
}

// Distanza punto-segmento
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function distToPath(x, y, path) {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) best = Math.min(best, segDist(x, y, path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]));
  return best;
}

let shell = null;
let raf = null;
let timer = null;

export default {
  id: "ricalco",
  order: "desc",
  maxSeconds: SHAPES * SHAPE_SECONDS + 4,

  createParams(rng, difficulty) {
    const kinds = shuffle([0, 1, 2, 3, 4], rng).slice(0, SHAPES);
    return { shapes: kinds.map((k) => makeShape(rng, k)), tol: TOL[difficulty] || TOL.normale };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "punto" : "punti"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore() {
    return SHAPES * 100;
  },

  mount(container, ctx) {
    const { shapes, tol } = ctx.params;
    shell = createShell(container, { title: "Ricalco", hint: "Ripassa la forma col dito, senza staccarlo", color: "#1b1a2e" });
    const canvas = el("canvas", { class: "run-canvas" });
    shell.body.append(canvas);
    const g = fitCanvas(canvas, shell.body, W, H);

    let idx = 0, score = 0, done = false;
    let stroke = [], drawing = false;
    let timeLeft = SHAPE_SECONDS;
    let flash = 0, flashText = "";

    const evaluate = () => {
      const path = shapes[idx];
      if (stroke.length < 5) return 0;
      // precisione: quanto i punti del tratto stanno vicino alla forma
      let near = 0;
      for (const [x, y] of stroke) if (distToPath(x, y, path) <= tol) near++;
      const precision = near / stroke.length;
      // copertura: quanti punti della forma hanno un tratto vicino
      let covered = 0;
      for (const [x, y] of path) { let ok = false; for (let i = 1; i < stroke.length && !ok; i++) if (segDist(x, y, stroke[i - 1][0], stroke[i - 1][1], stroke[i][0], stroke[i][1]) <= tol) ok = true; if (ok) covered++; }
      const coverage = covered / path.length;
      return Math.round(100 * Math.min(1, precision * 0.5 + coverage * 0.5));
    };

    const nextShape = () => {
      const pts = evaluate();
      score += pts;
      flash = 1; flashText = pts >= 90 ? "Perfetto!" : pts >= 60 ? `${pts}` : pts > 0 ? `${pts}` : "Niente";
      if (pts >= 90) { vibrate(30); sfx.play("bell"); } else if (pts >= 40) { vibrate(15); sfx.play("good"); } else { vibrate([50, 30, 50]); sfx.play("bad"); }
      idx++;
      stroke = []; drawing = false;
      clearInterval(timer);
      if (idx >= shapes.length) { setTimeout(finish, 600); return; }
      timeLeft = SHAPE_SECONDS;
      shell.setHint(`Forma ${idx + 1} di ${SHAPES} · ${score} punti`);
      armTimer();
    };

    const armTimer = () => {
      clearInterval(timer);
      timer = setInterval(() => {
        if (done) return;
        timeLeft -= 1;
        shell.setTimer(`${timeLeft} s`);
        if (timeLeft <= 0) nextShape();
      }, 1000);
    };

    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      clearInterval(timer);
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, `${score} su ${SHAPES * 100}`);
    };

    canvas.addEventListener("pointerdown", (ev) => { ev.preventDefault(); if (done) return; const q = canvasPoint(canvas, ev, W, H); stroke = [[q.x, q.y]]; drawing = true; try { canvas.setPointerCapture(ev.pointerId); } catch (_) { /* sintetico */ } });
    canvas.addEventListener("pointermove", (ev) => { if (!drawing || done) return; const q = canvasPoint(canvas, ev, W, H); const l = stroke[stroke.length - 1]; if (!l || Math.hypot(q.x - l[0], q.y - l[1]) > 3) stroke.push([q.x, q.y]); });
    const up = () => { if (drawing && !done) { drawing = false; if (stroke.length > 5) nextShape(); } };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    const draw = () => {
      if (done) return;
      g.clearRect(0, 0, W, H);
      const path = shapes[Math.min(idx, shapes.length - 1)];
      g.setLineDash([10, 8]); g.lineWidth = 6; g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineCap = "round"; g.lineJoin = "round";
      g.beginPath(); path.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      g.setLineDash([]);
      if (stroke.length > 1) { g.strokeStyle = "#36cfc9"; g.lineWidth = 8; g.beginPath(); stroke.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
      if (flash > 0) { g.globalAlpha = Math.min(1, flash * 1.5); g.fillStyle = "#ffb703"; g.font = "800 30px Fredoka, sans-serif"; g.textAlign = "center"; g.fillText(flashText, W / 2, 36); g.globalAlpha = 1; flash -= 0.02; }
      raf = requestAnimationFrame(draw);
    };
    shell.setHint(`Forma 1 di ${SHAPES} · 0 punti`);
    shell.setTimer(`${SHAPE_SECONDS} s`);
    armTimer();
    raf = requestAnimationFrame(draw);
  },

  unmount() {
    cancelAnimationFrame(raf);
    clearInterval(timer);
    shell?.remove();
    shell = null;
  },
};
