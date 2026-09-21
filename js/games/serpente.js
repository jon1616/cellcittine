/*
  Serpente: scorri per cambiare direzione, mangia i frutti, non sbattere
  contro i bordi o contro te stesso. 30 secondi. I frutti compaiono negli
  stessi posti per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, fitCanvas, canvasPoint } from "./shell.js";

const DURATION = 30;
const COLS = 12, ROWS = 16, CELL = 28;
const W = COLS * CELL, H = ROWS * CELL;
const SPEED = { facile: 4.5, normale: 6, difficile: 7.5 }; // celle al secondo
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

let shell = null;
let stopTimer = null;
let raf = null;

export default {
  id: "serpente",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    // Lista di posizioni dei frutti: si usa la prima libera (uguale per tutti a parità di percorso)
    const fruits = Array.from({ length: 200 }, () => ({ x: Math.floor(rng() * COLS), y: Math.floor(rng() * ROWS) }));
    return { fruits, speed: SPEED[difficulty] || SPEED.normale };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "frutto" : "frutti"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const { fruits, speed } = ctx.params;
    shell = createShell(container, { title: "Serpente", hint: "Scorri per partire", color: "#1b1a2e" });
    const canvas = el("canvas", { class: "run-canvas" });
    shell.body.append(canvas);
    const g = fitCanvas(canvas, shell.body, W, H);

    let snake = [{ x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 }];
    let dir = "right", nextDir = "right";
    let moving = false; // parte al primo scorrimento, così c'è tempo di orientarsi
    let fruitIdx = 0, fruit = null;
    let eaten = 0;
    let acc = 0, last = performance.now();
    let done = false;
    let dragStart = null;

    const placeFruit = () => {
      while (fruitIdx < fruits.length) {
        const f = fruits[fruitIdx++];
        if (!snake.some((s) => s.x === f.x && s.y === f.y)) { fruit = f; return; }
      }
      fruit = { x: 0, y: 0 };
    };
    placeFruit();

    canvas.addEventListener("pointerdown", (ev) => { ev.preventDefault(); dragStart = canvasPoint(canvas, ev, W, H); });
    const endDrag = (ev) => {
      if (!dragStart) return;
      const p = canvasPoint(canvas, ev, W, H);
      const dx = p.x - dragStart.x, dy = p.y - dragStart.y;
      dragStart = null;
      if (Math.hypot(dx, dy) < 14) return;
      const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
      const opposite = { up: "down", down: "up", left: "right", right: "left" };
      if (d !== opposite[dir]) { nextDir = d; sfx.play("blip"); }
      if (!moving) { moving = true; shell.setHint("Frutti: 0"); }
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointermove", (ev) => { if (dragStart && (ev.pressure > 0 || ev.buttons)) { const p = canvasPoint(canvas, ev, W, H); if (Math.hypot(p.x - dragStart.x, p.y - dragStart.y) > 24) endDrag(ev); } });

    const finish = (crashed) => {
      if (done) return;
      done = true;
      stopTimer?.();
      cancelAnimationFrame(raf);
      if (crashed) { vibrate([80, 40, 80]); sfx.play("crash"); }
      shell.showDone(this.formatScore(eaten));
      ctx.onFinish(eaten, crashed ? `sbattuto con ${snake.length} pezzi` : `lunghezza ${snake.length}, mai sbattuto!`);
    };

    const advance = () => {
      dir = nextDir;
      const [dx, dy] = DIRS[dir];
      const head = { x: snake[0].x + dx, y: snake[0].y + dy };
      if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS || snake.some((s) => s.x === head.x && s.y === head.y)) { finish(true); return; }
      snake.unshift(head);
      if (head.x === fruit.x && head.y === fruit.y) {
        eaten++;
        vibrate(15);
        sfx.play("good");
        shell.setHint(`Frutti: ${eaten}`);
        placeFruit();
      } else {
        snake.pop();
      }
    };

    const draw = () => {
      g.fillStyle = "#26254a";
      g.fillRect(0, 0, W, H);
      g.fillStyle = "rgba(255,255,255,0.04)";
      for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) if ((x + y) % 2) g.fillRect(x * CELL, y * CELL, CELL, CELL);
      // frutto
      g.fillStyle = "#ff595e";
      g.beginPath();
      g.arc(fruit.x * CELL + CELL / 2, fruit.y * CELL + CELL / 2, CELL * 0.36, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#8ac926";
      g.fillRect(fruit.x * CELL + CELL / 2 - 2, fruit.y * CELL + 4, 4, 7);
      // serpente
      snake.forEach((s, i) => {
        g.fillStyle = i === 0 ? "#43d17a" : `hsl(${140 + i * 3} 60% ${52 - Math.min(20, i)}%)`;
        g.beginPath();
        g.roundRect(s.x * CELL + 2, s.y * CELL + 2, CELL - 4, CELL - 4, 7);
        g.fill();
      });
      // occhi
      const hd = snake[0];
      g.fillStyle = "#1b1a2e";
      g.beginPath();
      g.arc(hd.x * CELL + CELL * 0.35, hd.y * CELL + CELL * 0.4, 2.5, 0, Math.PI * 2);
      g.arc(hd.x * CELL + CELL * 0.65, hd.y * CELL + CELL * 0.4, 2.5, 0, Math.PI * 2);
      g.fill();
    };

    const loop = (now) => {
      if (done) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (moving) acc += dt * speed;
      while (acc >= 1 && !done) { acc -= 1; advance(); }
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame((t) => { last = t; loop(t); });

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => finish(false)
    );
  },

  unmount() {
    stopTimer?.();
    cancelAnimationFrame(raf);
    shell?.remove();
    shell = null;
  },
};
