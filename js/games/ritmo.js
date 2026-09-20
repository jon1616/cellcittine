/*
  Ritmo: un battito regolare (che senti e vedi). Dopo quattro battiti di
  preparazione, tocca a tempo per 16 battiti: più sei preciso, più punti
  (max 100 a battito). Il tempo (BPM) dipende dalla difficoltà.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell } from "./shell.js";

const COUNT_IN = 4;
const BEATS = 16;
const BPM = { facile: 90, normale: 110, difficile: 135 };

let shell = null;
let timers = [];
let raf = null;

export default {
  id: "ritmo",
  order: "desc",
  maxSeconds: 30,

  createParams(rng, difficulty) {
    const bpm = BPM[difficulty] || BPM.normale;
    return { bpm, interval: 60000 / bpm };
  },

  formatScore(score) {
    return `${score} / ${BEATS * 100}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore() {
    return BEATS * 100;
  },

  mount(container, ctx) {
    const { interval } = ctx.params;
    shell = createShell(container, { title: "Ritmo", hint: "Ascolta il battito…" });

    const feedback = el("div", { class: "rhythm-feedback" });
    const ring = el("div", { class: "rhythm-ring" });
    const core = el("div", { class: "rhythm-core" });
    const stage = el("div", { class: "rhythm-stage" }, [ring, core]);
    const dots = el("div", { class: "rhythm-dots" }, Array.from({ length: BEATS }, () => el("span", { class: "rhythm-dot" })));
    shell.body.append(feedback, stage, dots);

    const start = performance.now() + 400;
    let total = 0;
    let perfects = 0;
    let judged = new Set(); // battiti già valutati
    let done = false;

    // Battiti (preparazione + gioco): suono e pulsazione visiva
    for (let i = 0; i < COUNT_IN + BEATS; i++) {
      const t = start + i * interval;
      timers.push(setTimeout(() => {
        if (done) return;
        sfx.play(i < COUNT_IN ? "tick" : "tock");
        core.classList.remove("beat");
        void core.offsetWidth; // riavvia l'animazione
        core.classList.add("beat");
        if (i < COUNT_IN) shell.setHint(`${COUNT_IN - i}…`);
        else shell.setHint(i === COUNT_IN ? "Vai!" : "");
      }, t - performance.now()));
    }

    // Anello che si stringe verso il centro su ogni battito
    const frame = (now) => {
      if (done) return;
      const phase = (((now - start) % interval) + interval) % interval / interval; // 0..1
      const s = 1.9 - phase * 0.9; // da 1.9 a 1.0 (raggiunge il nucleo sul battito)
      ring.style.transform = `scale(${s})`;
      ring.style.opacity = String(0.25 + phase * 0.6);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      shell.showDone(this.formatScore(total));
      ctx.onFinish(total, `${perfects} ${perfects === 1 ? "perfetto" : "perfetti"} su ${BEATS}`);
    };

    shell.area.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      if (done) return;
      const now = performance.now();
      const beatFloat = (now - start) / interval; // battito in virgola
      const nearest = Math.round(beatFloat);
      const idx = nearest - COUNT_IN; // 0..BEATS-1 nei battiti di gioco
      if (idx < 0 || idx >= BEATS || judged.has(idx)) {
        sfx.play("blip");
        return;
      }
      judged.add(idx);
      const offsetMs = Math.abs(beatFloat - nearest) * interval;
      const window = interval * 0.5;
      const points = Math.max(0, Math.round(100 * (1 - offsetMs / window)));
      total += points;
      shell.setTimer(String(total));
      const dot = dots.children[idx];
      if (points >= 85) {
        perfects++;
        dot.className = "rhythm-dot great";
        feedback.textContent = "Perfetto!";
        feedback.className = "rhythm-feedback great";
        sfx.play("good");
        vibrate(10);
      } else if (points >= 50) {
        dot.className = "rhythm-dot ok";
        feedback.textContent = `+${points}`;
        feedback.className = "rhythm-feedback";
        sfx.play("hit");
      } else {
        dot.className = "rhythm-dot bad";
        feedback.textContent = points === 0 ? "Fuori tempo" : `+${points}`;
        feedback.className = "rhythm-feedback bad";
        sfx.play("bad");
      }
      if (judged.size >= BEATS) setTimeout(finish, 400);
    });

    // Fine anche se non si tocca: poco dopo l'ultimo battito
    timers.push(setTimeout(finish, start + (COUNT_IN + BEATS + 0.6) * interval - performance.now()));
    shell.setTimer("0");
  },

  unmount() {
    timers.forEach(clearTimeout);
    timers = [];
    cancelAnimationFrame(raf);
    shell?.remove();
    shell = null;
  },
};
