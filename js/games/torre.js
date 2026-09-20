/*
  Torre: un blocco scorre avanti e indietro sopra la torre. Tocca per farlo
  cadere: la parte che sporge si stacca e il blocco successivo è più stretto.
  Quando non resta niente su cui appoggiare, la torre finisce. Massimo 20 blocchi.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, fitCanvas } from "./shell.js";

const W = 360, H = 480;
const BLOCK_H = 26;
const BASE_W = 170;
const MAX_BLOCKS = 20;
const PERFECT = 5; // px di tolleranza per il "perfetto"
const SPEED = { facile: 150, normale: 200, difficile: 260 };
const COLORS = ["#ff595e", "#ff924c", "#ffca3a", "#8ac926", "#36cfc9", "#1982c4", "#6a4c93", "#f15bb5"];

let shell = null;
let raf = null;

export default {
  id: "torre",
  order: "desc",
  maxSeconds: 70,

  createParams(rng, difficulty) {
    const speed = SPEED[difficulty] || SPEED.normale;
    // Lato di partenza di ogni blocco (alternato con un po' di caso)
    const sides = Array.from({ length: MAX_BLOCKS }, (_, i) => (rng() < 0.5 ? -1 : 1));
    return { speed, sides };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "blocco" : "blocchi"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore() {
    return MAX_BLOCKS;
  },

  mount(container, ctx) {
    const { speed, sides } = ctx.params;
    shell = createShell(container, { title: "Torre", hint: "Tocca per far cadere il blocco", color: "#1b1a2e" });
    const canvas = el("canvas", { class: "run-canvas" });
    shell.body.append(canvas);
    const g = fitCanvas(canvas, shell.body, W, H);

    // Torre: lista di blocchi appoggiati {x, w}
    const tower = [{ x: (W - BASE_W) / 2, w: BASE_W }];
    let placed = 0;
    let perfects = 0;
    let done = false;
    let last = performance.now();
    let cameraY = 0;          // scorrimento verso l'alto
    let falling = null;       // pezzo che si stacca {x, w, y, vy}
    let moving = { x: 0, dir: 1, w: BASE_W, t: 0 }; // blocco in movimento

    const groundY = H - 40;
    const topOfTower = () => groundY - tower.length * BLOCK_H;

    const newMoving = () => {
      const top = tower[tower.length - 1];
      const side = sides[placed % sides.length];
      moving = { w: top.w, x: side < 0 ? 0 : W - top.w, dir: side < 0 ? 1 : -1, speed: speed + placed * 6 };
    };
    newMoving();

    const finish = (score) => {
      if (done) return;
      done = true;
      setTimeout(() => {
        shell.showDone(this.formatScore(score));
        ctx.onFinish(score, `${perfects} ${perfects === 1 ? "perfetto" : "perfetti"}`);
      }, 600);
    };

    const drop = () => {
      if (done) return;
      const top = tower[tower.length - 1];
      const left = Math.max(moving.x, top.x);
      const right = Math.min(moving.x + moving.w, top.x + top.w);
      const overlap = right - left;

      if (overlap <= 6) {
        // Mancato: il blocco cade e la torre finisce
        falling = { x: moving.x, w: moving.w, y: topOfTower() - BLOCK_H, vy: 0, color: COLORS[placed % COLORS.length] };
        sfx.play("crash");
        vibrate([80, 40, 80]);
        finish(placed);
        return;
      }

      const offset = Math.abs(moving.x - top.x);
      if (offset <= PERFECT) {
        // Perfetto: allineato al blocco sotto, nessuna perdita
        tower.push({ x: top.x, w: top.w });
        perfects++;
        sfx.play("perfect");
        vibrate(15);
        shell.setHint("Perfetto!");
      } else {
        tower.push({ x: left, w: overlap });
        // pezzo che sporge e cade
        const cutX = moving.x < top.x ? moving.x : right;
        falling = { x: cutX, w: moving.w - overlap, y: topOfTower(), vy: 0, color: COLORS[placed % COLORS.length] };
        sfx.play("hit");
        vibrate(8);
        shell.setHint("");
      }
      placed++;
      shell.setTimer(`${placed} / ${MAX_BLOCKS}`);
      if (placed >= MAX_BLOCKS) {
        sfx.play("record");
        finish(placed);
        return;
      }
      newMoving();
    };

    shell.area.addEventListener("pointerdown", (ev) => { ev.preventDefault(); drop(); });

    const draw = () => {
      g.fillStyle = "#1b1a2e";
      g.fillRect(0, 0, W, H);
      // sfondo: gradiente cielo
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#2b2a5e");
      sky.addColorStop(1, "#1b1a2e");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);

      g.save();
      g.translate(0, cameraY);

      // terreno
      g.fillStyle = "#3a3870";
      g.fillRect(0, groundY, W, H);

      // torre
      tower.forEach((b, i) => {
        const y = groundY - (i + 1) * BLOCK_H;
        g.fillStyle = i === 0 ? "#6c6aa8" : COLORS[(i - 1) % COLORS.length];
        g.fillRect(b.x, y, b.w, BLOCK_H - 2);
        g.fillStyle = "rgba(255,255,255,0.18)";
        g.fillRect(b.x, y, b.w, 5);
      });

      // blocco in movimento
      if (!done || falling) {
        const y = topOfTower() - BLOCK_H;
        if (!done) {
          g.fillStyle = COLORS[placed % COLORS.length];
          g.fillRect(moving.x, y, moving.w, BLOCK_H - 2);
          g.fillStyle = "rgba(255,255,255,0.25)";
          g.fillRect(moving.x, y, moving.w, 5);
        }
      }

      // pezzo che cade
      if (falling) {
        g.globalAlpha = Math.max(0, 1 - (falling.vy / 900));
        g.fillStyle = falling.color;
        g.fillRect(falling.x, falling.y, falling.w, BLOCK_H - 2);
        g.globalAlpha = 1;
      }
      g.restore();
    };

    const step = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;

      if (!done) {
        moving.x += moving.dir * moving.speed * dt;
        if (moving.x <= 0) { moving.x = 0; moving.dir = 1; }
        if (moving.x + moving.w >= W) { moving.x = W - moving.w; moving.dir = -1; }
      }
      if (falling) {
        falling.vy += 1400 * dt;
        falling.y += falling.vy * dt;
        if (falling.y > H - cameraY + 100) falling = null;
      }
      // la camera segue la cima della torre
      const targetCam = Math.max(0, (H * 0.45) - topOfTower());
      cameraY += (targetCam - cameraY) * Math.min(1, dt * 6);

      draw();
      if (!done || falling) raf = requestAnimationFrame(step);
    };
    shell.setTimer(`0 / ${MAX_BLOCKS}`);
    raf = requestAnimationFrame((t) => { last = t; step(t); });
  },

  unmount() {
    cancelAnimationFrame(raf);
    shell?.remove();
    shell = null;
  },
};
