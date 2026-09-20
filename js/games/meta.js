/*
  Metà: appare una barra. Tocca il punto esatto a metà. Cinque barre di
  lunghezza e posizione diverse (a difficile anche inclinate). Punti in base
  alla distanza dal centro vero.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell } from "./shell.js";

const TRIES = 5;
const COLORS = ["#ffca3a", "#36cfc9", "#f15bb5", "#8ac926", "#ff924c"];

let shell = null;
let nextTimer = null;

export default {
  id: "meta",
  order: "desc",
  maxSeconds: 45,

  createParams(rng, difficulty) {
    const bars = Array.from({ length: TRIES }, (_, i) => {
      const len = 0.35 + rng() * 0.5;                    // frazione della larghezza
      const x = (1 - len) * rng();                        // inizio
      const y = 0.2 + rng() * 0.6;                        // altezza nell'area
      const angle = difficulty === "difficile" ? (rng() - 0.5) * 50 : difficulty === "normale" && i >= 3 ? (rng() - 0.5) * 24 : 0;
      return { len, x, y, angle, color: COLORS[i % COLORS.length] };
    });
    return { bars };
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
    const { bars } = ctx.params;
    shell = createShell(container, { title: "Metà", hint: `Barra 1 di ${TRIES} · tocca il punto a metà` });
    const feedback = el("div", { class: "prec-feedback" });
    const stage = el("div", { class: "half-stage" });
    shell.body.append(feedback, stage);

    let index = 0;
    let total = 0;
    let perfects = 0;
    let errSum = 0;
    let locked = false;

    const showBar = () => {
      const b = bars[index];
      stage.replaceChildren();
      const bar = el("div", { class: "half-bar" });
      bar.style.cssText = `left:${b.x * 100}%;width:${b.len * 100}%;top:${b.y * 100}%;background:${b.color};transform:rotate(${b.angle}deg);`;
      stage.append(bar);
      shell.setHint(`Barra ${index + 1} di ${TRIES} · tocca il punto a metà`);
      locked = false;
    };

    stage.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      if (locked) return;
      locked = true;
      const b = bars[index];
      const r = stage.getBoundingClientRect();
      // centro vero della barra, in pixel
      const cx = r.left + (b.x + b.len / 2) * r.width;
      const cy = r.top + b.y * r.height;
      const lenPx = b.len * r.width;
      // proiezione del tocco lungo l'asse della barra (per le barre inclinate)
      const a = (b.angle * Math.PI) / 180;
      const dx = ev.clientX - cx, dy = ev.clientY - cy;
      const along = dx * Math.cos(a) + dy * Math.sin(a);
      const errFrac = Math.abs(along) / (lenPx / 2); // 0 = centro, 1 = estremità
      const points = Math.max(0, Math.round(100 - errFrac * 250));
      total += points;
      errSum += errFrac * 50; // percentuale della lunghezza
      if (points >= 90) perfects++;

      // segno del tocco e del centro
      const mark = el("div", { class: "half-mark" });
      mark.style.cssText = `left:${ev.clientX - r.left}px;top:${ev.clientY - r.top}px;`;
      const truth = el("div", { class: "half-truth" });
      truth.style.cssText = `left:${cx - r.left}px;top:${cy - r.top}px;`;
      stage.append(truth, mark);

      feedback.textContent = points >= 90 ? `+${points} Perfetto!` : points > 0 ? `+${points}` : "Lontano!";
      feedback.className = `prec-feedback ${points >= 90 ? "great" : points === 0 ? "bad" : ""}`;
      sfx.play(points >= 90 ? "perfect" : points >= 40 ? "good" : "bad");
      vibrate(points >= 40 ? 12 : [60, 30, 60]);
      shell.setTimer(String(total));

      index++;
      nextTimer = setTimeout(() => {
        feedback.textContent = "";
        if (index >= TRIES) {
          shell.showDone(this.formatScore(total));
          ctx.onFinish(total, `${perfects} ${perfects === 1 ? "perfetto" : "perfetti"} · errore medio ${(errSum / TRIES).toFixed(1)}%`);
        } else {
          showBar();
        }
      }, 900);
    });

    shell.setTimer("0");
    showBar();
  },

  unmount() {
    clearTimeout(nextTimer);
    shell?.remove();
    shell = null;
  },
};
