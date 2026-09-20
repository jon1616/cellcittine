/*
  Salta: corsa infinita a un tasto. Tocca per saltare gli ostacoli che
  arrivano sempre più veloci. Il punteggio è quanti ostacoli hai superato.
  La sequenza di ostacoli è uguale per tutti; dura al massimo 30 secondi.
*/

import { el, vibrate } from "../utils.js";
import { createShell } from "./shell.js";

const DURATION = 30;
const W = 360;          // larghezza logica del mondo
const H = 420;          // altezza logica
const GROUND = 340;     // y del terreno
const HERO = { x: 64, size: 30 };
const GRAVITY = 1900;   // px/s²
const JUMP = 640;       // velocità iniziale del salto px/s
const SETTINGS = {
  facile: { speed: 220, accel: 2, gapMin: 300, gapMax: 460 },
  normale: { speed: 260, accel: 3, gapMin: 260, gapMax: 420 },
  difficile: { speed: 300, accel: 4.5, gapMin: 235, gapMax: 380 },
};

let shell = null;
let raf = null;

export default {
  id: "salta",
  title: "Salta",
  icon: "🦘",
  description: "Tocca per saltare gli ostacoli. Resisti 30 secondi!",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const s = SETTINGS[difficulty] || SETTINGS.normale;
    // Ostacoli: distanza dal precedente, larghezza, altezza (in "punte")
    const obstacles = Array.from({ length: 80 }, (_, i) => ({
      gap: s.gapMin + rng() * (s.gapMax - s.gapMin) + (i < 3 ? 120 : 0),
      width: 22 + Math.floor(rng() * 3) * 14,
      height: 1 + (rng() < (difficulty === "difficile" ? 0.35 : 0.2) ? 1 : 0),
    }));
    return { ...s, obstacles };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "ostacolo" : "ostacoli"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const { speed: baseSpeed, accel, obstacles } = ctx.params;
    shell = createShell(container, { title: "Salta", hint: "Superati: 0", color: "#1b1a2e" });

    const canvas = el("canvas", { class: "run-canvas" });
    shell.body.append(canvas);
    const g = canvas.getContext("2d");

    // Adatta il canvas all'area disponibile mantenendo le proporzioni logiche
    const fit = () => {
      const rect = shell.body.getBoundingClientRect();
      const scale = Math.min(rect.width / W, rect.height / H);
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${W * scale}px`;
      canvas.style.height = `${H * scale}px`;
      canvas.width = Math.round(W * scale * dpr);
      canvas.height = Math.round(H * scale * dpr);
      g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    };
    fit();

    // Stato del mondo
    let heroY = GROUND - HERO.size;
    let vy = 0;
    let onGround = true;
    let jumpQueued = false;
    let distance = 0;
    let passed = 0;
    let elapsed = 0;
    let done = false;
    let last = performance.now();

    // Posizioni assolute degli ostacoli lungo la corsa
    const obs = [];
    let x = W + 320;
    for (const o of obstacles) {
      x += o.gap;
      obs.push({ x, width: o.width, height: o.height, passed: false });
    }

    const jump = () => {
      if (done) return;
      if (onGround) {
        vy = -JUMP;
        onGround = false;
        vibrate(8);
      } else {
        jumpQueued = true; // salto "in memoria" se tocchi poco prima di atterrare
      }
    };
    shell.area.addEventListener("pointerdown", (ev) => { ev.preventDefault(); jump(); });

    const finish = (score) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      setTimeout(() => {
        shell.showDone(this.formatScore(score));
        ctx.onFinish(score);
      }, 500);
    };

    const draw = () => {
      // cielo
      const sky = g.createLinearGradient(0, 0, 0, GROUND);
      sky.addColorStop(0, "#2b2a5e");
      sky.addColorStop(1, "#5a4fcf");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, GROUND);

      // colline (parallasse)
      for (const [layer, color, amp, freq, par] of [[0, "#3f3b8f", 26, 0.012, 0.25], [1, "#4b47a8", 18, 0.02, 0.5]]) {
        g.fillStyle = color;
        g.beginPath();
        g.moveTo(0, GROUND);
        for (let px = 0; px <= W; px += 8) {
          const wx = px + distance * par;
          g.lineTo(px, GROUND - 40 - layer * 20 - Math.sin(wx * freq) * amp - Math.sin(wx * freq * 2.7) * amp * 0.4);
        }
        g.lineTo(W, GROUND);
        g.closePath();
        g.fill();
      }

      // terreno
      g.fillStyle = "#2dc653";
      g.fillRect(0, GROUND, W, 10);
      g.fillStyle = "#6b4f2a";
      g.fillRect(0, GROUND + 10, W, H - GROUND - 10);
      g.fillStyle = "#5a4222";
      for (let px = -((distance) % 40); px < W; px += 40) g.fillRect(px, GROUND + 22, 20, 4);

      // ostacoli: blocchi con punte
      for (const o of obs) {
        const sx = o.x - distance;
        if (sx > W + 60 || sx + o.width < -60) continue;
        const h = 26 * o.height;
        g.fillStyle = "#ff595e";
        g.fillRect(sx, GROUND - h, o.width, h);
        g.fillStyle = "#ffb3b5";
        g.beginPath();
        const spikes = Math.max(1, Math.round(o.width / 12));
        for (let i = 0; i < spikes; i++) {
          const bx = sx + (i * o.width) / spikes;
          g.moveTo(bx, GROUND - h);
          g.lineTo(bx + o.width / spikes / 2, GROUND - h - 10);
          g.lineTo(bx + o.width / spikes, GROUND - h);
        }
        g.fill();
      }

      // eroe: quadrato arrotondato con occhi
      const hx = HERO.x, hy = heroY, s = HERO.size;
      g.fillStyle = "#ffca3a";
      g.beginPath();
      g.roundRect(hx, hy, s, s, 7);
      g.fill();
      g.fillStyle = "#1b1a2e";
      g.beginPath();
      g.arc(hx + s * 0.65, hy + s * 0.38, 3.2, 0, Math.PI * 2);
      g.arc(hx + s * 0.35, hy + s * 0.38, 3.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#1b1a2e";
      g.fillRect(hx + s * 0.35, hy + s * 0.65, s * 0.3, 3);
    };

    const step = (now) => {
      if (done) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      elapsed += dt;

      const speed = baseSpeed + accel * elapsed;
      distance += speed * dt;

      // fisica del salto
      vy += GRAVITY * dt;
      heroY += vy * dt;
      if (heroY >= GROUND - HERO.size) {
        heroY = GROUND - HERO.size;
        vy = 0;
        if (!onGround && jumpQueued) {
          jumpQueued = false;
          vy = -JUMP;
        } else {
          onGround = true;
        }
      }

      // collisioni e conteggio
      const hx1 = HERO.x + 4, hx2 = HERO.x + HERO.size - 4, hy2 = heroY + HERO.size - 2;
      for (const o of obs) {
        const sx = o.x - distance;
        const h = 26 * o.height;
        if (!o.passed && sx + o.width < HERO.x) {
          o.passed = true;
          passed++;
          shell.setHint(`Superati: ${passed}`);
        }
        if (hx2 > sx && hx1 < sx + o.width && hy2 > GROUND - h) {
          draw();
          g.fillStyle = "rgba(255,80,80,0.35)";
          g.fillRect(0, 0, W, H);
          vibrate([80, 40, 80]);
          finish(passed);
          return;
        }
      }

      shell.setTimer(`${Math.max(0, Math.ceil(DURATION - elapsed))} s`);
      draw();
      if (elapsed >= DURATION) {
        finish(passed);
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
