/*
  Frenata: l'auto parte e accelera verso la riga di arrivo. Tocca per frenare:
  più ti fermi vicino alla riga (senza superarla), più punti. Cinque tentativi,
  con accelerazioni diverse ma uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, fitCanvas } from "./shell.js";

const W = 360, H = 240;
const TRIES = 5;
const START_X = 20;
const LINE_X = 300;
const CAR_W = 44, CAR_H = 22;
const BRAKE = { facile: 240, normale: 300, difficile: 360 }; // decelerazione px/s²
const ACCEL_RANGE = { facile: [55, 85], normale: [80, 120], difficile: [110, 160] };
const BAND = 120; // px prima della riga entro cui si fanno punti

let shell = null;
let raf = null;
let nextTimer = null;

export default {
  id: "frenata",
  order: "desc",
  maxSeconds: 50,

  createParams(rng, difficulty) {
    const [lo, hi] = ACCEL_RANGE[difficulty] || ACCEL_RANGE.normale;
    const tries = Array.from({ length: TRIES }, () => ({ accel: lo + rng() * (hi - lo) }));
    return { tries, brake: BRAKE[difficulty] || BRAKE.normale };
  },

  formatScore(score) {
    return `${score} / ${TRIES * 100}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore() {
    return TRIES * 100;
  },

  mount(container, ctx) {
    const { tries, brake } = ctx.params;
    shell = createShell(container, { title: "Frenata", hint: `Tentativo 1 di ${TRIES} · tocca per frenare`, color: "#1b1a2e" });
    const feedback = el("div", { class: "prec-feedback" });
    const canvas = el("canvas", { class: "run-canvas" });
    shell.body.append(feedback, canvas);
    const g = fitCanvas(canvas, shell.body, W, H);

    let attempt = 0;
    let total = 0;
    let perfects = 0;
    let crashes = 0;
    let x = START_X, v = 0;
    let braking = false;
    let settled = false;
    let done = false;
    let last = performance.now();
    let wheel = 0;

    const reset = () => {
      x = START_X; v = 0; braking = false; settled = false;
      feedback.textContent = "";
      shell.setHint(`Tentativo ${attempt + 1} di ${TRIES} · tocca per frenare`);
      sfx.inflateStart();
    };

    const finish = () => {
      done = true;
      sfx.inflateStop();
      shell.showDone(this.formatScore(total));
      ctx.onFinish(total, `${perfects} ${perfects === 1 ? "perfetto" : "perfetti"}, ${crashes} ${crashes === 1 ? "schianto" : "schianti"}`);
    };

    const settle = () => {
      settled = true;
      sfx.inflateStop();
      const front = x + CAR_W;
      let points;
      if (front > LINE_X) {
        points = 0;
        crashes++;
        feedback.textContent = "Oltre la riga!";
        feedback.className = "prec-feedback bad";
        sfx.play("crash");
        vibrate([80, 40, 80]);
      } else {
        const dist = LINE_X - front; // 0 = perfetto
        points = Math.max(0, Math.round(100 - (dist / BAND) * 100));
        if (points >= 90) perfects++;
        feedback.textContent = points >= 90 ? `+${points} Perfetto!` : `+${points}`;
        feedback.className = `prec-feedback ${points >= 90 ? "great" : ""}`;
        sfx.play(points >= 90 ? "perfect" : points > 0 ? "good" : "bad");
        vibrate(15);
      }
      total += points;
      shell.setTimer(String(total));
      attempt++;
      nextTimer = setTimeout(() => {
        if (attempt >= TRIES) finish();
        else reset();
      }, 1000);
    };

    shell.area.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      if (done || settled || braking) return;
      braking = true;
      sfx.play("blip");
    });

    const draw = () => {
      g.fillStyle = "#1b1a2e";
      g.fillRect(0, 0, W, H);
      // strada
      g.fillStyle = "#3a3870";
      g.fillRect(0, 120, W, 80);
      g.fillStyle = "#f6f3ff";
      for (let px = -((x * 0.5) % 40); px < W; px += 40) g.fillRect(px, 158, 20, 4);
      // riga d'arrivo
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? "#f6f3ff" : "#1b1a2e";
        g.fillRect(LINE_X, 120 + i * 10, 8, 10);
      }
      // muro dopo la riga
      g.fillStyle = "#ff595e";
      g.fillRect(LINE_X + 40, 100, 12, 100);
      // auto
      const y = 140;
      g.fillStyle = braking ? "#ff924c" : "#ffca3a";
      g.beginPath();
      g.roundRect(x, y, CAR_W, CAR_H, 6);
      g.fill();
      g.fillStyle = "#36cfc9";
      g.fillRect(x + 10, y + 3, 18, 8);
      g.fillStyle = "#1b1a2e";
      for (const wx of [x + 9, x + CAR_W - 9]) {
        g.beginPath();
        g.arc(wx, y + CAR_H, 6, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "#f6f3ff";
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(wx, y + CAR_H);
        g.lineTo(wx + Math.cos(wheel) * 5, y + CAR_H + Math.sin(wheel) * 5);
        g.stroke();
      }
      // luci freno
      if (braking) {
        g.fillStyle = "#ff595e";
        g.fillRect(x - 3, y + 4, 4, 5);
        g.fillRect(x - 3, y + CAR_H - 9, 4, 5);
      }
      // velocità
      g.fillStyle = "rgba(255,255,255,0.7)";
      g.font = "bold 14px system-ui";
      g.textAlign = "left";
      g.fillText(`${Math.round(v)} km/h`, 12, 30);
    };

    const step = (now) => {
      if (done) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (!settled) {
        if (!braking) {
          v += tries[attempt].accel * dt;
        } else {
          v = Math.max(0, v - brake * dt);
        }
        x += v * dt;
        wheel += v * dt * 0.15;
        sfx.inflateUpdate(Math.min(1, v / 260));
        if ((braking && v === 0) || x + CAR_W > LINE_X + 40) settle();
      }
      draw();
      raf = requestAnimationFrame(step);
    };

    shell.setTimer("0");
    reset();
    raf = requestAnimationFrame((t) => { last = t; step(t); });
  },

  unmount() {
    cancelAnimationFrame(raf);
    clearTimeout(nextTimer);
    sfx.inflateStop();
    shell?.remove();
    shell = null;
  },
};
