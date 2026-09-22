/*
  Al volo: un cursore corre avanti e indietro su una barra. Tocca quando è
  dentro la zona verde: più sei al centro, più punti. 8 tentativi, la zona
  si restringe e il cursore accelera. Zone uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, fitCanvas } from "./shell.js";

const TRIES = 8;
const W = 360, H = 360;
const BAR_X = 30, BAR_W = W - 60;
const SPEED = { facile: 0.55, normale: 0.75, difficile: 1.0 }; // barre al secondo, all'inizio
const SWEEPS_MAX = 2.5; // senza tocco, il tentativo si chiude dopo tante corse

let shell = null;
let raf = null;

export default {
  id: "alvolo",
  order: "desc",
  maxSeconds: 40,

  createParams(rng, difficulty) {
    const speed = SPEED[difficulty] || SPEED.normale;
    const tries = [];
    for (let i = 0; i < TRIES; i++) {
      const width = Math.max(0.07, 0.24 - i * 0.022); // frazione della barra
      const center = width / 2 + 0.08 + rng() * (1 - width - 0.16);
      tries.push({ center, width, speed: speed * (1 + i * 0.12) });
    }
    return { tries };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "punto" : "punti"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore() {
    return TRIES * 100;
  },

  mount(container, ctx) {
    const { tries } = ctx.params;
    shell = createShell(container, { title: "Al volo", hint: "Tocca quando il cursore è nella zona verde", color: "#1b1a2e" });
    const canvas = el("canvas", { class: "run-canvas" });
    shell.body.append(canvas);
    const g = fitCanvas(canvas, shell.body, W, H);

    let idx = 0, score = 0, hits = 0;
    let pos = 0, dir = 1, travelled = 0;
    let done = false, last = performance.now();
    let flash = 0, flashText = "", flashColor = "#fff";
    let pauseUntil = 0;

    const next = () => {
      idx++;
      pos = 0; dir = 1; travelled = 0;
      pauseUntil = performance.now() + 500;
      if (idx >= tries.length) setTimeout(finish, 600);
      else shell.setHint(`Tentativo ${idx + 1} di ${TRIES} · ${score} punti`);
    };

    const tap = () => {
      if (done || idx >= tries.length || performance.now() < pauseUntil) return;
      const t = tries[idx];
      const d = Math.abs(pos - t.center) / (t.width / 2); // 0 = centro, 1 = bordo
      const pts = d <= 1 ? Math.round(100 - d * 40) : 0;
      score += pts;
      if (pts > 0) hits++;
      flash = 1; flashText = pts === 0 ? "Fuori!" : pts >= 90 ? "Centro!" : `${pts}`; flashColor = pts === 0 ? "#ff4d6d" : pts >= 90 ? "#43d17a" : "#f6f3ff";
      if (pts >= 90) { vibrate(30); sfx.play("perfect"); } else if (pts > 0) { vibrate(15); sfx.play("good"); } else { vibrate([50, 30, 50]); sfx.play("bad"); }
      next();
    };
    canvas.addEventListener("pointerdown", (ev) => { ev.preventDefault(); tap(); });

    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, `${hits} su ${TRIES} nella zona · ${score} su ${TRIES * 100}`);
    };

    const step = (now) => {
      if (done) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (idx < tries.length && now >= pauseUntil) {
        const t = tries[idx];
        pos += dir * t.speed * dt;
        travelled += t.speed * dt;
        if (pos >= 1) { pos = 1; dir = -1; } else if (pos <= 0) { pos = 0; dir = 1; }
        if (travelled >= SWEEPS_MAX) { // nessun tocco: tentativo perso
          flash = 1; flashText = "Troppo lento!"; flashColor = "#ff4d6d";
          sfx.play("bad");
          next();
        }
      }
      draw();
      raf = requestAnimationFrame(step);
    };

    const draw = () => {
      g.clearRect(0, 0, W, H);
      const t = tries[Math.min(idx, tries.length - 1)];
      const y = H / 2;
      // barra
      g.fillStyle = "#26254a"; g.beginPath(); g.roundRect(BAR_X, y - 22, BAR_W, 44, 22); g.fill();
      // zona verde
      const zx = BAR_X + (t.center - t.width / 2) * BAR_W, zw = t.width * BAR_W;
      g.fillStyle = "#43d17a"; g.beginPath(); g.roundRect(zx, y - 22, zw, 44, 12); g.fill();
      g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(BAR_X + t.center * BAR_W - 1.5, y - 22, 3, 44);
      // cursore
      const x = BAR_X + pos * BAR_W;
      g.fillStyle = "#ffb703"; g.beginPath(); g.moveTo(x, y - 40); g.lineTo(x + 12, y - 58); g.lineTo(x - 12, y - 58); g.closePath(); g.fill();
      g.fillStyle = "#f6f3ff"; g.fillRect(x - 3, y - 34, 6, 68);
      // esito
      if (flash > 0) {
        g.globalAlpha = Math.min(1, flash * 1.5);
        g.fillStyle = flashColor; g.font = "800 32px Fredoka, sans-serif"; g.textAlign = "center";
        g.fillText(flashText, W / 2, y - 90);
        g.globalAlpha = 1; flash -= 0.02;
      }
      g.fillStyle = "rgba(255,255,255,0.7)"; g.font = "600 16px Fredoka, sans-serif"; g.textAlign = "center";
      g.fillText(`${Math.min(idx + 1, TRIES)} / ${TRIES}`, W / 2, y + 80);
    };
    shell.setHint(`Tentativo 1 di ${TRIES} · 0 punti`);
    pauseUntil = performance.now() + 400;
    raf = requestAnimationFrame((t) => { last = t; step(t); });
  },

  unmount() {
    cancelAnimationFrame(raf);
    shell?.remove();
    shell = null;
  },
};
