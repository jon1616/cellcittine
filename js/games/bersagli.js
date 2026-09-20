/*
  Bersagli: per 20 secondi compaiono cerchi in posizioni casuali e spariscono
  in fretta. Tocca più bersagli che puoi. Le posizioni sono uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer } from "./shell.js";

const DURATION = 20;
const SETTINGS = {
  facile: { size: 92, life: 1300, gap: 650 },
  normale: { size: 74, life: 950, gap: 480 },
  difficile: { size: 60, life: 700, gap: 360 },
};
const COLORS = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#f15bb5", "#36cfc9"];

let shell = null;
let stopTimer = null;
let spawnTimer = null;

export default {
  id: "bersagli",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const s = SETTINGS[difficulty] || SETTINGS.normale;
    // Pre-calcola abbastanza bersagli per tutta la durata: posizione in
    // percentuale dell'area, così è uguale su schermi diversi.
    const total = Math.ceil((DURATION * 1000) / s.gap) + 5;
    const targets = Array.from({ length: total }, () => ({
      x: rng(),
      y: rng(),
      color: COLORS[Math.floor(rng() * COLORS.length)],
    }));
    return { ...s, targets };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "bersaglio" : "bersagli"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore(params) {
    return Math.floor((DURATION * 1000) / params.gap) + 1;
  },

  mount(container, ctx) {
    const { size, life, gap, targets } = ctx.params;
    shell = createShell(container, { title: "Bersagli", hint: "Colpiti: 0" });
    const field = el("div", { class: "target-field" });
    shell.body.append(field);

    let hits = 0;
    let index = 0;
    let done = false;

    const spawn = () => {
      if (done || index >= targets.length) return;
      const t = targets[index++];
      const rect = field.getBoundingClientRect();
      const x = t.x * Math.max(0, rect.width - size);
      const y = t.y * Math.max(0, rect.height - size);

      const target = el("div", { class: "target" });
      target.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;background:${t.color};`;
      field.append(target);

      const vanish = setTimeout(() => target.remove(), life);
      target.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        if (done) return;
        clearTimeout(vanish);
        target.classList.add("hit");
        setTimeout(() => target.remove(), 120);
        hits++;
        vibrate(10);
        sfx.play("hit");
        shell.setHint(`Colpiti: ${hits}`);
      });

      spawnTimer = setTimeout(spawn, gap);
    };

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => {
        done = true;
        clearTimeout(spawnTimer);
        shell.showDone(this.formatScore(hits));
        ctx.onFinish(hits);
      }
    );
    spawn();
  },

  unmount() {
    stopTimer?.();
    clearTimeout(spawnTimer);
    shell?.remove();
    shell = null;
  },
};
