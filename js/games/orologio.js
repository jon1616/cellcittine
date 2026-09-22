/*
  Orologio: un orologio a lancette segna un'ora. Quale, tra le quattro scritte
  in cifre? +1 giusta, −1 sbagliata. 25 secondi. Ore uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, shuffle, fitCanvas } from "./shell.js";

const DURATION = 25;
const STEP = { facile: 30, normale: 15, difficile: 5 }; // minuti
const S = 220;

const fmt = (h, m) => `${h}:${String(m).padStart(2, "0")}`;

let shell = null;
let stopTimer = null;

export default {
  id: "orologio",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const step = STEP[difficulty] || STEP.normale;
    const slots = 60 / step;
    const questions = [];
    for (let i = 0; i < 40; i++) {
      const h = 1 + Math.floor(rng() * 12), m = Math.floor(rng() * slots) * step;
      const wrong = new Set();
      let guard = 0;
      while (wrong.size < 3 && guard++ < 40) {
        const r = rng();
        let wh = h, wm = m;
        if (r < 0.35) wh = 1 + ((h - 1 + 1 + Math.floor(rng() * 11)) % 12);          // ora diversa
        else if (r < 0.7) wm = (m + step * (1 + Math.floor(rng() * (slots - 1)))) % 60; // minuti diversi
        else { wh = 1 + ((m / 5) % 12 || 12) - 1; wm = (h % 12) * 5; if (wh === 0) wh = 12; } // lancette scambiate
        const t = fmt(wh, wm);
        if (t !== fmt(h, m)) wrong.add(t);
      }
      while (wrong.size < 3) wrong.add(fmt(1 + wrong.size, m));
      questions.push({ h, m, options: shuffle([fmt(h, m), ...wrong], rng) });
    }
    return { questions };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "punto" : "punti"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const { questions } = ctx.params;
    shell = createShell(container, { title: "Orologio", hint: "Punti: 0" });
    const canvas = el("canvas", { class: "clock-face" });
    const answers = el("div", { class: "quiz-answers" });
    shell.body.append(canvas, answers);
    const g = fitCanvas(canvas, shell.body, S, S);

    let index = 0, score = 0, ok = 0, ko = 0;
    let done = false;

    const drawClock = (h, m) => {
      const c = S / 2, r = S / 2 - 6;
      g.clearRect(0, 0, S, S);
      g.fillStyle = "#f6f3ff";
      g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#1b1a2e"; g.lineWidth = 5;
      g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2, big = i % 5 === 0;
        g.lineWidth = big ? 3 : 1;
        g.beginPath();
        g.moveTo(c + Math.sin(a) * (r - (big ? 16 : 8)), c - Math.cos(a) * (r - (big ? 16 : 8)));
        g.lineTo(c + Math.sin(a) * (r - 3), c - Math.cos(a) * (r - 3));
        g.stroke();
      }
      g.fillStyle = "#1b1a2e";
      g.font = "bold 18px Fredoka, sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      for (let i = 1; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.fillText(String(i), c + Math.sin(a) * (r - 32), c - Math.cos(a) * (r - 32));
      }
      const ha = ((h % 12) / 12 + m / 720) * Math.PI * 2, ma = (m / 60) * Math.PI * 2;
      g.lineCap = "round";
      g.strokeStyle = "#1b1a2e"; g.lineWidth = 7;
      g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.sin(ha) * r * 0.5, c - Math.cos(ha) * r * 0.5); g.stroke();
      g.strokeStyle = "#ff4d6d"; g.lineWidth = 4;
      g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.sin(ma) * r * 0.78, c - Math.cos(ma) * r * 0.78); g.stroke();
      g.fillStyle = "#ffb703";
      g.beginPath(); g.arc(c, c, 6, 0, Math.PI * 2); g.fill();
    };

    const show = () => {
      const q = questions[index % questions.length];
      drawClock(q.h, q.m);
      answers.replaceChildren(...q.options.map((opt) => {
        const btn = el("button", { class: "quiz-answer", text: opt });
        btn.addEventListener("pointerdown", (ev) => {
          ev.preventDefault();
          if (done) return;
          if (opt === fmt(q.h, q.m)) { score++; ok++; vibrate(10); sfx.play("ding"); }
          else { score = Math.max(0, score - 1); ko++; vibrate([60, 30, 60]); sfx.play("bad"); }
          shell.setHint(`Punti: ${score}`);
          index++;
          show();
        });
        return btn;
      }));
    };

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => {
        done = true;
        shell.showDone(this.formatScore(score));
        ctx.onFinish(score, `${ok} giuste, ${ko} sbagliate`);
      }
    );
    show();
  },

  unmount() {
    stopTimer?.();
    shell?.remove();
    shell = null;
  },
};
