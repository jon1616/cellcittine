/*
  Talpe: nove buche. Le talpe spuntano per un attimo: toccale! Ma attenzione
  alle bombe: toccarle toglie un punto. 20 secondi. Uscite uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer } from "./shell.js";

const DURATION = 20;
const SETTINGS = {
  facile: { gap: 900, life: 1100, bombs: 0.12 },
  normale: { gap: 700, life: 850, bombs: 0.2 },
  difficile: { gap: 520, life: 650, bombs: 0.28 },
};

let shell = null;
let stopTimer = null;
let timers = [];

export default {
  id: "talpe",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const s = SETTINGS[difficulty] || SETTINGS.normale;
    const events = [];
    let t = 500, lastHole = -1;
    while (t < DURATION * 1000 - s.life) {
      let hole = Math.floor(rng() * 9);
      if (hole === lastHole) hole = (hole + 1 + Math.floor(rng() * 8)) % 9;
      lastHole = hole;
      events.push({ t, hole, bomb: rng() < s.bombs });
      t += s.gap;
    }
    return { events, life: s.life };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "talpa" : "talpe"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore(params) {
    return params.events.filter((e) => !e.bomb).length;
  },

  mount(container, ctx) {
    const { events, life } = ctx.params;
    shell = createShell(container, { title: "Talpe", hint: "Tocca le talpe, non le bombe!" });
    const grid = el("div", { class: "mole-grid" });
    const holes = Array.from({ length: 9 }, () => {
      const thing = el("div", { class: "mole-thing" });
      const hole = el("div", { class: "mole-hole" }, [thing]);
      return { hole, thing, kind: null };
    });
    grid.append(...holes.map((h) => h.hole));
    shell.body.append(grid);

    let score = 0, hits = 0, bombs = 0;
    let done = false;

    holes.forEach((h) => {
      h.hole.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        if (done || !h.kind) return;
        if (h.kind === "mole") {
          score++; hits++;
          vibrate(15);
          sfx.play("bonk");
          h.thing.classList.add("hit");
        } else {
          score = Math.max(0, score - 1); bombs++;
          vibrate([80, 40, 80]);
          sfx.play("crash");
          h.thing.classList.add("boom");
        }
        h.kind = null;
        shell.setHint(`Talpe: ${hits}${bombs ? ` · bombe ${bombs}` : ""}`);
        const thing = h.thing;
        timers.push(setTimeout(() => { thing.className = "mole-thing"; }, 250));
      });
    });

    for (const e of events) {
      timers.push(setTimeout(() => {
        if (done) return;
        const h = holes[e.hole];
        h.kind = e.bomb ? "bomb" : "mole";
        h.thing.className = `mole-thing up ${h.kind}`;
        sfx.play("blip");
        timers.push(setTimeout(() => { if (h.kind) { h.kind = null; h.thing.className = "mole-thing"; } }, life));
      }, e.t));
    }

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => {
        done = true;
        timers.forEach(clearTimeout);
        shell.showDone(this.formatScore(score));
        ctx.onFinish(score, `${hits} colpite, ${bombs} ${bombs === 1 ? "bomba" : "bombe"}`);
      }
    );
  },

  unmount() {
    stopTimer?.();
    timers.forEach(clearTimeout);
    timers = [];
    shell?.remove();
    shell = null;
  },
};
