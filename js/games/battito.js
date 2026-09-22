/*
  Battito: le note scendono verso la linea; tocca quando ci passano sopra.
  Fino a 100 punti a nota (più sei preciso, più prendi). 16 note, sempre più
  fitte. Note uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, fitCanvas } from "./shell.js";

const NOTES = 16;
const W = 360, H = 480;
const LINE_Y = H - 90;
const FALL = { facile: 1.6, normale: 1.3, difficile: 1.0 }; // secondi dall'alto alla linea
const WINDOW_MS = 180; // oltre questo scarto la nota è mancata

let shell = null;
let raf = null;

export default {
  id: "battito",
  order: "desc",
  maxSeconds: 40,

  createParams(rng, difficulty) {
    const times = [];
    let t = 1.5;
    for (let i = 0; i < NOTES; i++) { times.push(Math.round(t * 100) / 100); t += Math.max(0.42, 0.95 - i * 0.03) * (rng() < 0.3 ? 0.5 : 1); }
    return { times, fall: FALL[difficulty] || FALL.normale };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "punto" : "punti"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore() {
    return NOTES * 100;
  },

  mount(container, ctx) {
    const { times, fall } = ctx.params;
    shell = createShell(container, { title: "Battito", hint: "Tocca quando la nota è sulla linea", color: "#1b1a2e" });
    const canvas = el("canvas", { class: "run-canvas" });
    shell.body.append(canvas);
    const g = fitCanvas(canvas, shell.body, W, H);

    const t0 = performance.now();
    const notes = times.map((t) => ({ t, hit: null }));
    let score = 0, hits = 0, done = false;
    let flash = 0, flashText = "", flashColor = "#fff";
    const elapsed = () => (performance.now() - t0) / 1000;

    canvas.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      if (done) return;
      const now = elapsed();
      // la nota non ancora giudicata più vicina alla linea
      let best = null, bestD = Infinity;
      for (const n of notes) { if (n.hit !== null) continue; const d = Math.abs(now - n.t) * 1000; if (d < bestD) { bestD = d; best = n; } }
      if (!best || bestD > WINDOW_MS * 1.6) { sfx.play("blip"); return; } // tocco a vuoto
      const pts = bestD <= WINDOW_MS ? Math.round(100 - (bestD / WINDOW_MS) * 60) : 0;
      best.hit = pts;
      score += pts; if (pts > 0) hits++;
      flash = 1; flashText = pts >= 95 ? "Perfetto!" : pts > 0 ? `${pts}` : "Fuori tempo"; flashColor = pts >= 95 ? "#43d17a" : pts > 0 ? "#f6f3ff" : "#ff4d6d";
      if (pts >= 95) { vibrate(20); sfx.pad(1, 0.18); } else if (pts > 0) { vibrate(10); sfx.pad(0, 0.15); } else { vibrate([40, 30, 40]); sfx.play("bad"); }
      shell.setHint(`Note: ${hits} · ${score} punti`);
    });

    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, `${hits} note su ${NOTES} · ${score} su ${NOTES * 100}`);
    };

    const draw = () => {
      if (done) return;
      const now = elapsed();
      // note passate senza tocco
      for (const n of notes) if (n.hit === null && now - n.t > WINDOW_MS / 1000) { n.hit = 0; flash = 1; flashText = "Persa"; flashColor = "#ff4d6d"; sfx.play("bad"); }
      g.clearRect(0, 0, W, H);
      g.fillStyle = "#26254a"; g.fillRect(W / 2 - 60, 0, 120, H);
      g.fillStyle = "#ffb703"; g.fillRect(W / 2 - 80, LINE_Y - 3, 160, 6);
      for (const n of notes) {
        const y = LINE_Y - ((n.t - now) / fall) * LINE_Y;
        if (y < -20 || y > H + 20) continue;
        g.beginPath(); g.arc(W / 2, y, 18, 0, Math.PI * 2);
        g.fillStyle = n.hit === null ? "#36cfc9" : n.hit > 0 ? "rgba(67,209,122,0.5)" : "rgba(255,77,109,0.5)"; g.fill();
      }
      if (flash > 0) { g.globalAlpha = Math.min(1, flash * 1.5); g.fillStyle = flashColor; g.font = "800 28px Fredoka, sans-serif"; g.textAlign = "center"; g.fillText(flashText, W / 2, 40); g.globalAlpha = 1; flash -= 0.025; }
      const remaining = notes.filter((n) => n.hit === null).length;
      shell.setTimer(`${remaining} note`);
      if (remaining === 0) { setTimeout(finish, 500); return; }
      raf = requestAnimationFrame(draw);
    };
    shell.setHint(`Note: 0 · 0 punti`);
    raf = requestAnimationFrame(draw);
  },

  unmount() {
    cancelAnimationFrame(raf);
    shell?.remove();
    shell = null;
  },
};
