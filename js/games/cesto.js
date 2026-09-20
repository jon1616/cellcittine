/*
  Cesto: la frutta cade dall'alto. Trascina il dito per muovere il cesto e
  prenderne più che puoi in 20 secondi. Posizioni e tempi uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, fitCanvas, canvasPoint } from "./shell.js";

const W = 360, H = 520;
const DURATION = 20;
const BASKET_W = 84, BASKET_H = 30, BASKET_Y = H - 60;
const SETTINGS = {
  facile: { gap: 900, speed: 170 },
  normale: { gap: 700, speed: 220 },
  difficile: { gap: 520, speed: 280 },
};
const FRUITS = [
  { color: "#ff595e", leaf: "#8ac926", r: 14 }, // mela
  { color: "#ffca3a", leaf: "#8ac926", r: 13 }, // limone
  { color: "#ff924c", leaf: "#8ac926", r: 15 }, // arancia
  { color: "#6a4c93", leaf: "#8ac926", r: 11 }, // prugna
  { color: "#8ac926", leaf: "#5a8a1a", r: 13 }, // lime
];

let shell = null;
let raf = null;

export default {
  id: "cesto",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const s = SETTINGS[difficulty] || SETTINGS.normale;
    const fallTime = (BASKET_Y / s.speed) * 1000;
    const drops = [];
    for (let t = 300; t + fallTime <= DURATION * 1000; t += s.gap) {
      drops.push({ t, x: 30 + rng() * (W - 60), kind: Math.floor(rng() * FRUITS.length), wobble: rng() * 6.28 });
    }
    return { ...s, drops };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "frutto" : "frutti"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore(params) {
    return params.drops.length;
  },

  mount(container, ctx) {
    const { speed, drops } = ctx.params;
    shell = createShell(container, { title: "Cesto", hint: "Trascina il cesto sotto la frutta", color: "#1b1a2e" });
    const canvas = el("canvas", { class: "run-canvas" });
    shell.body.append(canvas);
    const g = fitCanvas(canvas, shell.body, W, H);

    let basketX = W / 2;
    let caught = 0, missed = 0;
    let done = false;
    let elapsed = 0;
    let last = performance.now();
    const active = []; // frutti in caduta
    let nextDrop = 0;
    const splashes = [];

    const move = (ev) => {
      const p = canvasPoint(canvas, ev, W, H);
      basketX = Math.max(BASKET_W / 2, Math.min(W - BASKET_W / 2, p.x));
    };
    canvas.addEventListener("pointerdown", (ev) => { ev.preventDefault(); canvas.setPointerCapture?.(ev.pointerId); move(ev); });
    canvas.addEventListener("pointermove", (ev) => { if (ev.pressure > 0 || ev.buttons) move(ev); });

    const draw = () => {
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#2b2a5e");
      sky.addColorStop(1, "#3f3d8a");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      // erba
      g.fillStyle = "#2dc653";
      g.fillRect(0, H - 22, W, 22);

      // frutti
      for (const f of active) {
        const k = FRUITS[f.kind];
        const wob = Math.sin(f.wobble + f.y * 0.03) * 6;
        g.fillStyle = k.color;
        g.beginPath();
        g.arc(f.x + wob, f.y, k.r, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = k.leaf;
        g.beginPath();
        g.ellipse(f.x + wob + 4, f.y - k.r - 2, 6, 3, -0.6, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.35)";
        g.beginPath();
        g.arc(f.x + wob - k.r * 0.35, f.y - k.r * 0.35, k.r * 0.28, 0, Math.PI * 2);
        g.fill();
      }
      // schizzi a terra
      for (const s of splashes) {
        g.globalAlpha = s.life;
        g.fillStyle = s.color;
        g.beginPath();
        g.ellipse(s.x, H - 24, 14 * (1.4 - s.life), 4, 0, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }
      // cesto
      const bx = basketX - BASKET_W / 2;
      g.fillStyle = "#a9743a";
      g.beginPath();
      g.roundRect(bx, BASKET_Y, BASKET_W, BASKET_H, [4, 4, 14, 14]);
      g.fill();
      g.strokeStyle = "rgba(0,0,0,0.25)";
      g.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        g.beginPath();
        g.moveTo(bx + (BASKET_W / 4) * i, BASKET_Y);
        g.lineTo(bx + (BASKET_W / 4) * i, BASKET_Y + BASKET_H);
        g.stroke();
      }
      g.fillStyle = "#c98f4f";
      g.fillRect(bx - 4, BASKET_Y - 4, BASKET_W + 8, 8);
    };

    const step = (now) => {
      if (done) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      elapsed += dt;
      const ms = elapsed * 1000;

      while (nextDrop < drops.length && drops[nextDrop].t <= ms) {
        active.push({ ...drops[nextDrop], y: -20 });
        nextDrop++;
      }
      for (let i = active.length - 1; i >= 0; i--) {
        const f = active[i];
        f.y += speed * dt;
        const wob = Math.sin(f.wobble + f.y * 0.03) * 6;
        const fx = f.x + wob;
        if (f.y >= BASKET_Y - 4 && f.y <= BASKET_Y + 14 && Math.abs(fx - basketX) <= BASKET_W / 2 + 4) {
          active.splice(i, 1);
          caught++;
          shell.setHint(`Presi: ${caught}`);
          sfx.play("good");
          vibrate(8);
        } else if (f.y > H - 20) {
          active.splice(i, 1);
          missed++;
          splashes.push({ x: fx, color: FRUITS[f.kind].color, life: 1 });
          sfx.play("blip");
        }
      }
      for (let i = splashes.length - 1; i >= 0; i--) {
        splashes[i].life -= dt * 2;
        if (splashes[i].life <= 0) splashes.splice(i, 1);
      }

      shell.setTimer(`${Math.max(0, Math.ceil(DURATION - elapsed))} s`);
      draw();
      if (elapsed >= DURATION) {
        done = true;
        shell.showDone(this.formatScore(caught));
        ctx.onFinish(caught, `${missed} ${missed === 1 ? "perso" : "persi"}`);
        return;
      }
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
