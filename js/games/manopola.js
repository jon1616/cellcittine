/*
  Manopola: una manopola e una tacca da raggiungere. Trascina intorno alla
  manopola per ruotare la lancetta e lasciala il più vicino possibile alla
  tacca. 6 tentativi, fino a 100 punti ciascuno. Tacche uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, fitCanvas, canvasPoint } from "./shell.js";

const TRIES = 6;
const W = 360, H = 400;
const TRY_SECONDS = 7; // senza rilascio, il tentativo si chiude da solo
const TOL = { facile: 14, normale: 10, difficile: 7 }; // gradi per prendere 100

let shell = null;
let raf = null;
let tryTimer = null;

export default {
  id: "manopola",
  order: "desc",
  maxSeconds: TRIES * TRY_SECONDS + 3,

  createParams(rng, difficulty) {
    const targets = [];
    let last = 0;
    for (let i = 0; i < TRIES; i++) {
      let a;
      do { a = Math.floor(rng() * 360); } while (Math.abs(a - last) < 60);
      targets.push(a);
      last = a;
    }
    return { targets, tol: TOL[difficulty] || TOL.normale };
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
    const { targets, tol } = ctx.params;
    shell = createShell(container, { title: "Manopola", hint: "Trascina intorno alla manopola fino alla tacca", color: "#1b1a2e" });
    const canvas = el("canvas", { class: "run-canvas" });
    shell.body.append(canvas);
    const g = fitCanvas(canvas, shell.body, W, H);
    const cx = W / 2, cy = H / 2 + 10, R = 120;

    let idx = 0, score = 0;
    let angle = 90;   // lancetta (gradi, 0 = destra, in senso orario)
    let dragging = false;
    let lastPointer = null;
    let done = false;
    let flash = 0, flashText = "";
    const results = [];

    const angleOf = (ev) => {
      const q = canvasPoint(canvas, ev, W, H);
      return ((Math.atan2(q.y - cy, q.x - cx) * 180) / Math.PI + 360) % 360;
    };
    const diff = (a, b) => { const d = Math.abs(((a - b) % 360 + 540) % 360 - 180); return d; };

    const armTry = () => {
      clearTimeout(tryTimer);
      tryTimer = setTimeout(() => { if (!done) confirm(); }, TRY_SECONDS * 1000);
    };

    const confirm = () => {
      if (done || idx >= targets.length) return;
      clearTimeout(tryTimer);
      const d = diff(angle, targets[idx]);
      const pts = d <= tol ? 100 : Math.max(0, Math.round(100 - (d - tol) * 2.5));
      score += pts;
      results.push(d);
      flash = 1; flashText = pts === 100 ? "Perfetto!" : `${pts}`;
      if (pts === 100) { vibrate(30); sfx.play("perfect"); } else if (pts >= 60) { vibrate(15); sfx.play("good"); } else { vibrate([50, 30, 50]); sfx.play("bad"); }
      idx++;
      shell.setHint(`Tentativo ${Math.min(idx + 1, TRIES)} di ${TRIES} · ${score} punti`);
      if (idx >= targets.length) { setTimeout(finish, 600); return; }
      armTry();
    };

    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      clearTimeout(tryTimer);
      shell.showDone(this.formatScore(score));
      const avg = results.length ? Math.round(results.reduce((a, b) => a + b, 0) / results.length) : 0;
      ctx.onFinish(score, `${score} su ${TRIES * 100} · errore medio ${avg}°`);
    };

    canvas.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      if (done) return;
      dragging = true;
      lastPointer = angleOf(ev);
      try { canvas.setPointerCapture(ev.pointerId); } catch (_) { /* puntatore sintetico */ }
    });
    canvas.addEventListener("pointermove", (ev) => {
      if (!dragging || done) return;
      const a = angleOf(ev);
      let delta = a - lastPointer;
      if (delta > 180) delta -= 360; else if (delta < -180) delta += 360;
      angle = (angle + delta + 360) % 360;
      lastPointer = a;
      if (Math.abs(delta) > 2) sfx.play("blip");
    });
    const up = () => { if (dragging && !done) { dragging = false; confirm(); } };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    const draw = () => {
      g.clearRect(0, 0, W, H);
      const target = targets[Math.min(idx, targets.length - 1)];
      // corona con la tacca
      g.beginPath(); g.arc(cx, cy, R + 26, 0, Math.PI * 2); g.fillStyle = "#26254a"; g.fill();
      const ta = (target * Math.PI) / 180;
      g.save(); g.translate(cx, cy); g.rotate(ta);
      g.fillStyle = "#ffb703"; g.beginPath(); g.moveTo(R + 6, -9); g.lineTo(R + 28, 0); g.lineTo(R + 6, 9); g.closePath(); g.fill();
      g.restore();
      // manopola
      const grad = g.createRadialGradient(cx - 30, cy - 30, 10, cx, cy, R);
      grad.addColorStop(0, "#5a4fcf"); grad.addColorStop(1, "#2f2e5c");
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = grad; g.fill();
      g.lineWidth = 4; g.strokeStyle = "#1b1a2e"; g.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i * 30 * Math.PI) / 180;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - 14), cy + Math.sin(a) * (R - 14)); g.lineTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4));
        g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 2; g.stroke();
      }
      // lancetta
      const la = (angle * Math.PI) / 180;
      g.save(); g.translate(cx, cy); g.rotate(la);
      g.strokeStyle = "#f6f3ff"; g.lineWidth = 8; g.lineCap = "round";
      g.beginPath(); g.moveTo(0, 0); g.lineTo(R - 18, 0); g.stroke();
      g.restore();
      g.beginPath(); g.arc(cx, cy, 12, 0, Math.PI * 2); g.fillStyle = "#1b1a2e"; g.fill();
      // esito
      if (flash > 0) {
        g.globalAlpha = Math.min(1, flash * 1.5);
        g.fillStyle = flashText === "Perfetto!" ? "#43d17a" : "#f6f3ff";
        g.font = "800 30px Fredoka, sans-serif"; g.textAlign = "center";
        g.fillText(flashText, cx, 44);
        g.globalAlpha = 1;
        flash -= 0.02;
      }
      raf = requestAnimationFrame(draw);
    };
    shell.setHint(`Tentativo 1 di ${TRIES} · 0 punti`);
    armTry();
    raf = requestAnimationFrame(draw);
  },

  unmount() {
    cancelAnimationFrame(raf);
    clearTimeout(tryTimer);
    shell?.remove();
    shell = null;
  },
};
