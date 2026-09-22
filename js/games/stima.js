/*
  Stima: sei domande "a occhio": quanto è lunga la linea, che angolo fa la
  lancetta, quanto è pieno il cerchio, dopo quanti secondi. Rispondi col
  cursore (o toccando al momento giusto). Fino a 100 punti a domanda.
  Domande uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, fitCanvas, shuffle } from "./shell.js";

const QUESTIONS = 6;
const W = 320, H = 200;
const Q_SECONDS = 9;

let shell = null;
let timer = null;

export default {
  id: "stima",
  order: "desc",
  maxSeconds: QUESTIONS * (Q_SECONDS + 1) + 4,

  createParams(rng, difficulty) {
    const kinds = ["linea", "angolo", "pieno", "tempo"];
    const qs = [];
    for (let i = 0; i < QUESTIONS; i++) {
      const kind = kinds[i % kinds.length];
      if (kind === "linea") qs.push({ kind, value: 15 + Math.floor(rng() * 70) });          // % della larghezza
      else if (kind === "angolo") qs.push({ kind, value: 10 + Math.floor(rng() * 160) });   // gradi
      else if (kind === "pieno") qs.push({ kind, value: 10 + Math.floor(rng() * 80) });     // % del cerchio
      else qs.push({ kind, value: 3 + Math.floor(rng() * 5) });                              // secondi da aspettare
    }
    return { questions: shuffle(qs, rng), tol: difficulty === "facile" ? 1.4 : difficulty === "difficile" ? 0.7 : 1 };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "punto" : "punti"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore() {
    return QUESTIONS * 100;
  },

  mount(container, ctx) {
    const { questions, tol } = ctx.params;
    shell = createShell(container, { title: "Stima", hint: "A occhio: quanto?" });
    const canvas = el("canvas", { class: "run-canvas stima-canvas" });
    const prompt = el("div", { class: "stima-prompt" });
    const slider = el("input", { type: "range", min: "0", max: "100", step: "1", value: "50", class: "stima-slider" });
    const value = el("div", { class: "stima-value" });
    const okBtn = el("button", { class: "stima-ok", text: "Conferma" });
    const tapBtn = el("button", { class: "stima-ok tap", text: "TOCCA ORA" });
    shell.body.append(canvas, prompt, slider, value, okBtn, tapBtn);
    const g = fitCanvas(canvas, shell.body, W, H);

    let idx = 0, score = 0, done = false;
    let q = null, tStart = 0, answered = false;

    const label = () => {
      const v = Number(slider.value);
      if (q.kind === "linea") return `${v}% della larghezza`;
      if (q.kind === "angolo") return `${Math.round((v / 100) * 180)}°`;
      if (q.kind === "pieno") return `${v}%`;
      return "";
    };
    slider.addEventListener("input", () => { value.textContent = label(); });

    const drawQ = () => {
      g.clearRect(0, 0, W, H);
      g.fillStyle = "#26254a"; g.fillRect(0, 0, W, H);
      g.strokeStyle = "#ffb703"; g.lineWidth = 8; g.lineCap = "round";
      if (q.kind === "linea") { g.beginPath(); g.moveTo(20, H / 2); g.lineTo(20 + (q.value / 100) * (W - 40), H / 2); g.stroke(); g.strokeStyle = "rgba(255,255,255,0.15)"; g.lineWidth = 2; g.beginPath(); g.moveTo(20, H / 2 + 30); g.lineTo(W - 20, H / 2 + 30); g.stroke(); }
      else if (q.kind === "angolo") { const cx = W / 2, cy = H - 30, r = 120; g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.stroke(); const a = Math.PI - (q.value * Math.PI) / 180; g.strokeStyle = "#ffb703"; g.lineWidth = 8; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy - Math.sin(a) * r); g.stroke(); }
      else if (q.kind === "pieno") { const cx = W / 2, cy = H / 2, r = 80; g.fillStyle = "rgba(255,255,255,0.12)"; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.fillStyle = "#36cfc9"; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (q.value / 100) * Math.PI * 2); g.closePath(); g.fill(); }
      else { g.fillStyle = "#f6f3ff"; g.font = "800 40px Fredoka, sans-serif"; g.textAlign = "center"; g.fillText(`${q.value} s`, W / 2, H / 2 + 14); g.font = "600 16px Fredoka, sans-serif"; g.fillText("Tocca quando pensi che siano passati", W / 2, H / 2 + 48); }
    };

    const ask = () => {
      q = questions[idx];
      answered = false;
      clearTimeout(timer);
      slider.value = "50";
      const isTime = q.kind === "tempo";
      prompt.textContent = q.kind === "linea" ? "Quanto è lunga la linea gialla, rispetto a quella grigia?" : q.kind === "angolo" ? "Che angolo fa la lancetta con la base?" : q.kind === "pieno" ? "Quanto è pieno il cerchio?" : `Tocca dopo ${q.value} secondi`;
      slider.style.display = isTime ? "none" : "";
      value.style.display = isTime ? "none" : "";
      okBtn.style.display = isTime ? "none" : "";
      tapBtn.style.display = isTime ? "" : "none";
      value.textContent = isTime ? "" : label();
      shell.setHint(`Domanda ${idx + 1} di ${QUESTIONS} · ${score} punti`);
      drawQ();
      tStart = performance.now();
      if (!isTime) timer = setTimeout(() => answer(), Q_SECONDS * 1000);
      else timer = setTimeout(() => answer(), (q.value + 6) * 1000);
    };

    const answer = () => {
      if (done || answered) return;
      answered = true;
      clearTimeout(timer);
      let err;
      const v = Number(slider.value);
      if (q.kind === "linea") err = Math.abs(v - q.value) / 40;
      else if (q.kind === "angolo") err = Math.abs((v / 100) * 180 - q.value) / 70;
      else if (q.kind === "pieno") err = Math.abs(v - q.value) / 40;
      else err = Math.abs((performance.now() - tStart) / 1000 - q.value) / 2.5;
      const pts = Math.max(0, Math.round(100 * (1 - Math.min(1, err / tol))));
      score += pts;
      if (pts >= 90) { vibrate(30); sfx.play("bell"); } else if (pts >= 50) { vibrate(15); sfx.play("good"); } else { vibrate([50, 30, 50]); sfx.play("bad"); }
      const truth = q.kind === "linea" ? `${q.value}%` : q.kind === "angolo" ? `${q.value}°` : q.kind === "pieno" ? `${q.value}%` : `${q.value} s`;
      prompt.textContent = `${pts} punti · era ${truth}`;
      idx++;
      if (idx >= questions.length) { setTimeout(finish, 800); return; }
      timer = setTimeout(ask, 900);
    };
    okBtn.addEventListener("pointerdown", (ev) => { ev.preventDefault(); answer(); });
    tapBtn.addEventListener("pointerdown", (ev) => { ev.preventDefault(); answer(); });

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, `${score} su ${QUESTIONS * 100}`);
    };
    ask();
  },

  unmount() {
    clearTimeout(timer);
    shell?.remove();
    shell = null;
  },
};
