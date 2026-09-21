/*
  Labirinto: trascina il dito dall'ingresso (verde) all'uscita (oro) senza
  toccare i muri. Ogni tocco a un muro riporta all'ingresso e costa 1 secondo.
  Punteggio: tempo impiegato (meno è meglio). Il labirinto è uguale per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, fitCanvas, canvasPoint } from "./shell.js";

const DURATION = 40;
const NOT_FINISHED = 999;
const SIZES = { facile: [7, 9], normale: [9, 12], difficile: [11, 15] }; // colonne, righe
const W = 360;
const N = 1, E = 2, S = 4, O = 8; // muri di una cella

let shell = null;
let stopTimer = null;
let raf = null;

// Labirinto "perfetto" (un solo percorso) scavato con il metodo del backtracking
function carve(cols, rows, rng) {
  const walls = new Array(cols * rows).fill(N | E | S | O);
  const seen = new Array(cols * rows).fill(false);
  const stack = [0];
  seen[0] = true;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const x = cur % cols, y = Math.floor(cur / cols);
    const next = [];
    if (y > 0 && !seen[cur - cols]) next.push([cur - cols, N, S]);
    if (x < cols - 1 && !seen[cur + 1]) next.push([cur + 1, E, O]);
    if (y < rows - 1 && !seen[cur + cols]) next.push([cur + cols, S, N]);
    if (x > 0 && !seen[cur - 1]) next.push([cur - 1, O, E]);
    if (next.length === 0) { stack.pop(); continue; }
    const [n, wall, back] = next[Math.floor(rng() * next.length)];
    walls[cur] &= ~wall;
    walls[n] &= ~back;
    seen[n] = true;
    stack.push(n);
  }
  return walls;
}

export default {
  id: "labirinto",
  order: "asc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const [cols, rows] = SIZES[difficulty] || SIZES.normale;
    return { cols, rows, walls: carve(cols, rows, rng) };
  },

  formatScore(score) {
    return score >= NOT_FINISHED ? "Non finito" : `${score.toFixed(1)} s`;
  },

  isValidScore(score) {
    return score < NOT_FINISHED;
  },

  mount(container, ctx) {
    const { cols, rows, walls } = ctx.params;
    shell = createShell(container, { title: "Labirinto", hint: "Dal verde all'oro, senza toccare i muri", color: "#1b1a2e" });
    const canvas = el("canvas", { class: "run-canvas" });
    shell.body.append(canvas);
    const cs = W / cols;
    const H = Math.round(cs * rows);
    const g = fitCanvas(canvas, shell.body, W, H);
    const WALL = Math.max(3, Math.round(cs * 0.12)); // spessore dei muri
    const end = cols * rows - 1;

    // Segmenti dei muri, per misurare la distanza del dito
    const segs = [];
    for (let i = 0; i < walls.length; i++) {
      const x = (i % cols) * cs, y = Math.floor(i / cols) * cs;
      if (walls[i] & N) segs.push([x, y, x + cs, y]);
      if (walls[i] & O) segs.push([x, y, x, y + cs]);
      if (walls[i] & S) segs.push([x, y + cs, x + cs, y + cs]);
      if (walls[i] & E) segs.push([x + cs, y, x + cs, y + cs]);
    }
    const distToSeg = (px, py, [ax, ay, bx, by]) => {
      const dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    };
    const touchesWall = (px, py) => segs.some((s) => distToSeg(px, py, s) < WALL / 2 + 2);
    const cellAt = (px, py) => Math.floor(px / cs) + Math.floor(py / cs) * cols;
    const center = (i) => ({ x: (i % cols) * cs + cs / 2, y: Math.floor(i / cols) * cs + cs / 2 });

    let pos = center(0);
    let trail = [pos];
    let tracking = false;
    let hits = 0;
    let started = null; // istante del primo movimento
    let done = false;
    let flash = 0;

    const finish = (score) => {
      if (done) return;
      done = true;
      stopTimer?.();
      cancelAnimationFrame(raf);
      draw();
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, score >= NOT_FINISHED ? "Uscita non raggiunta" : hits === 0 ? "Nessun tocco al muro!" : `${hits} ${hits === 1 ? "tocco" : "tocchi"} al muro`);
    };

    const hitWall = () => {
      hits++;
      flash = 1;
      vibrate([60, 30, 60]);
      sfx.play("bad");
      pos = center(0);
      trail = [pos];
      tracking = false;
      shell.setHint(`Tocco al muro! Riparti dal verde (${hits})`);
    };

    const moveTo = (p) => {
      if (done || !tracking) return;
      // Il dito può saltare più pixel tra due eventi: controlliamo il tragitto a passi piccoli
      const steps = Math.max(1, Math.ceil(Math.hypot(p.x - pos.x, p.y - pos.y) / 4));
      for (let k = 1; k <= steps; k++) {
        const x = pos.x + ((p.x - pos.x) * k) / steps;
        const y = pos.y + ((p.y - pos.y) * k) / steps;
        if (x < 0 || y < 0 || x >= W || y >= H) { tracking = false; return; }
        if (touchesWall(x, y)) { hitWall(); return; }
        pos = { x, y };
      }
      if (!started) started = performance.now();
      trail.push(pos);
      if (cellAt(pos.x, pos.y) === end) {
        vibrate(40);
        sfx.play("perfect");
        finish(Math.round(((performance.now() - started) / 1000 + hits) * 10) / 10);
      }
    };

    canvas.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      try { canvas.setPointerCapture?.(ev.pointerId); } catch (_) { /* puntatore sintetico */ }
      const p = canvasPoint(canvas, ev, W, H);
      if (Math.hypot(p.x - pos.x, p.y - pos.y) < cs * 0.9) { tracking = true; sfx.play("blip"); moveTo(p); }
    });
    canvas.addEventListener("pointermove", (ev) => { if (tracking && (ev.pressure > 0 || ev.buttons)) moveTo(canvasPoint(canvas, ev, W, H)); });
    canvas.addEventListener("pointerup", () => { tracking = false; });
    canvas.addEventListener("pointercancel", () => { tracking = false; });

    const draw = () => {
      g.fillStyle = "#26254a";
      g.fillRect(0, 0, W, H);
      if (flash > 0) { g.fillStyle = `rgba(255, 77, 109, ${0.3 * flash})`; g.fillRect(0, 0, W, H); }
      // ingresso e uscita
      const s0 = center(0), s1 = center(end);
      g.fillStyle = "rgba(67, 209, 122, 0.35)";
      g.fillRect(s0.x - cs / 2, s0.y - cs / 2, cs, cs);
      g.fillStyle = "rgba(255, 183, 3, 0.4)";
      g.fillRect(s1.x - cs / 2, s1.y - cs / 2, cs, cs);
      // scia
      if (trail.length > 1) {
        g.strokeStyle = "rgba(76, 201, 240, 0.7)";
        g.lineWidth = Math.max(3, cs * 0.28);
        g.lineCap = "round";
        g.lineJoin = "round";
        g.beginPath();
        g.moveTo(trail[0].x, trail[0].y);
        for (const t of trail) g.lineTo(t.x, t.y);
        g.stroke();
      }
      // muri
      g.strokeStyle = "#f6f3ff";
      g.lineWidth = WALL;
      g.lineCap = "square";
      g.beginPath();
      for (const [ax, ay, bx, by] of segs) { g.moveTo(ax, ay); g.lineTo(bx, by); }
      g.stroke();
      // dito
      g.fillStyle = "#4cc9f0";
      g.beginPath();
      g.arc(pos.x, pos.y, Math.max(5, cs * 0.26), 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#ffb703";
      g.font = `bold ${Math.round(cs * 0.6)}px Fredoka, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("★", s1.x, s1.y + 1);
    };

    const loop = () => {
      if (done) return;
      if (flash > 0) flash = Math.max(0, flash - 0.05);
      draw();
      raf = requestAnimationFrame(loop);
    };
    loop();

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => finish(NOT_FINISHED)
    );
  },

  unmount() {
    stopTimer?.();
    cancelAnimationFrame(raf);
    shell?.remove();
    shell = null;
  },
};
