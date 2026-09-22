/*
  Cerchi: un cerchio si restringe verso un anello. Tocca nell'istante in cui
  il cerchio ha la stessa grandezza dell'anello. 8 giri, sempre più veloci;
  fino a 100 punti per giro. Anelli uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, fitCanvas } from "./shell.js";

const TRIES = 8;
const W = 360, H = 360;
const DUR = { facile: 2.0, normale: 1.6, difficile: 1.25 }; // secondi dal massimo a zero, al primo giro

let shell = null;
let raf = null;

export default {
  id: "cerchi",
  order: "desc",
  maxSeconds: 30,

  createParams(rng, difficulty) {
    const base = DUR[difficulty] || DUR.normale;
    const tries = Array.from({ length: TRIES }, (_, i) => ({
      ring: 40 + Math.floor(rng() * 80),           // raggio dell'anello
      dur: base * Math.max(0.55, 1 - i * 0.07),    // durata della discesa
    }));
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
    shell = createShell(container, { title: "Cerchi", hint: "Tocca quando il cerchio combacia con l'anello", color: "#1b1a2e" });
    const canvas = el("canvas", { class: "run-canvas" });
    shell.body.append(canvas);
    const g = fitCanvas(canvas, shell.body, W, H);
    const cx = W / 2, cy = H / 2;
    const START = 170;

    let idx = 0, score = 0, hits = 0;
    let t0 = performance.now() + 500;
    let done = false;
    let flash = 0, flashText = "", flashColor = "#fff";

    const radiusNow = (now) => {
      const t = tries[idx];
      const k = Math.min(1, Math.max(0, (now - t0) / (t.dur * 1000)));
      return START * (1 - k);
    };

    const next = () => {
      idx++;
      t0 = performance.now() + 450;
      if (idx >= tries.length) setTimeout(finish, 600);
      else shell.setHint(`Giro ${idx + 1} di ${TRIES} · ${score} punti`);
    };

    const tap = () => {
      if (done || idx >= tries.length) return;
      const now = performance.now();
      if (now < t0) return; // non ancora partito
      const t = tries[idx];
      const r = radiusNow(now);
      const err = Math.abs(r - t.ring) / t.ring; // 0 = perfetto
      const pts = err <= 0.05 ? 100 : Math.max(0, Math.round(100 - (err - 0.05) * 250));
      score += pts;
      if (pts > 0) hits++;
      flash = 1; flashText = pts === 100 ? "Perfetto!" : pts === 0 ? "Mancato" : `${pts}`; flashColor = pts === 100 ? "#43d17a" : pts === 0 ? "#ff4d6d" : "#f6f3ff";
      if (pts === 100) { vibrate(30); sfx.play("perfect"); } else if (pts > 0) { vibrate(15); sfx.play("good"); } else { vibrate([50, 30, 50]); sfx.play("bad"); }
      next();
    };
    canvas.addEventListener("pointerdown", (ev) => { ev.preventDefault(); tap(); });

    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, `${hits} su ${TRIES} colpiti · ${score} su ${TRIES * 100}`);
    };

    const draw = (now) => {
      if (done) return;
      g.clearRect(0, 0, W, H);
      const t = tries[Math.min(idx, tries.length - 1)];
      // anello
      g.beginPath(); g.arc(cx, cy, t.ring, 0, Math.PI * 2);
      g.lineWidth = 6; g.strokeStyle = "#ffb703"; g.stroke();
      // cerchio che scende
      if (idx < tries.length) {
        const r = radiusNow(now);
        if (now >= t0 && r <= 0.5) { // arrivato a zero senza tocco
          flash = 1; flashText = "Troppo tardi!"; flashColor = "#ff4d6d";
          sfx.play("bad");
          next();
        } else if (now >= t0) {
          g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2);
          g.fillStyle = "rgba(54,207,201,0.25)"; g.fill();
          g.lineWidth = 4; g.strokeStyle = "#36cfc9"; g.stroke();
        }
      }
      if (flash > 0) {
        g.globalAlpha = Math.min(1, flash * 1.5);
        g.fillStyle = flashColor; g.font = "800 30px Fredoka, sans-serif"; g.textAlign = "center";
        g.fillText(flashText, cx, 40);
        g.globalAlpha = 1; flash -= 0.02;
      }
      g.fillStyle = "rgba(255,255,255,0.7)"; g.font = "600 16px Fredoka, sans-serif"; g.textAlign = "center";
      g.fillText(`${Math.min(idx + 1, TRIES)} / ${TRIES}`, cx, H - 16);
      raf = requestAnimationFrame(draw);
    };
    shell.setHint(`Giro 1 di ${TRIES} · 0 punti`);
    raf = requestAnimationFrame(draw);
  },

  unmount() {
    cancelAnimationFrame(raf);
    shell?.remove();
    shell = null;
  },
};
