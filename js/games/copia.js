/*
  Copia: una griglia mostra uno schema di caselle accese per un attimo, poi
  si spegne. Ricomponilo toccando le caselle e conferma. Sei schemi, sempre
  più grandi. Punti = schemi esatti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell } from "./shell.js";

const ROUNDS = 6;
const SETTINGS = {
  facile: { size: 3, start: 2, show: 2000 },
  normale: { size: 4, start: 3, show: 1600 },
  difficile: { size: 4, start: 4, show: 1200 },
};

let shell = null;
let timers = [];

export default {
  id: "copia",
  order: "desc",
  maxSeconds: 75,

  createParams(rng, difficulty) {
    const s = SETTINGS[difficulty] || SETTINGS.normale;
    const cells = s.size * s.size;
    const rounds = Array.from({ length: ROUNDS }, (_, r) => {
      const n = Math.min(cells - 1, s.start + r);
      const idx = Array.from({ length: cells }, (_, i) => i);
      for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      return { lit: idx.slice(0, n).sort((a, b) => a - b) };
    });
    return { size: s.size, show: s.show, rounds };
  },

  formatScore(score) {
    return `${score} / ${ROUNDS}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore() {
    return ROUNDS;
  },

  mount(container, ctx) {
    const { size, show, rounds } = ctx.params;
    shell = createShell(container, { title: "Copia", hint: "Guarda lo schema…" });
    const grid = el("div", { class: "copy-grid" });
    grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    const confirm = el("button", { class: "copy-confirm", text: "Conferma" });
    shell.body.append(grid, confirm);

    let index = 0;
    let correct = 0;
    let phase = "show";
    let chosen = new Set();
    let done = false;

    const cells = Array.from({ length: size * size }, (_, i) => {
      const c = el("div", { class: "copy-cell" });
      c.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        if (phase !== "input" || done) return;
        if (chosen.has(i)) { chosen.delete(i); c.classList.remove("on"); }
        else { chosen.add(i); c.classList.add("on"); }
        sfx.play("flip");
        vibrate(6);
      });
      return c;
    });
    grid.append(...cells);

    const render = (litSet, cls) => {
      cells.forEach((c, i) => { c.className = "copy-cell" + (litSet.has(i) ? " " + cls : ""); });
    };

    const playRound = () => {
      const r = rounds[index];
      phase = "show";
      chosen = new Set();
      confirm.disabled = true;
      shell.setTimer(`${index + 1} / ${ROUNDS}`);
      shell.setHint("Guarda lo schema…");
      render(new Set(r.lit), "lit");
      sfx.play("tick");
      timers.push(setTimeout(() => {
        if (done) return;
        render(new Set(), "");
        phase = "input";
        confirm.disabled = false;
        shell.setHint(`Ricomponi le ${r.lit.length} caselle e conferma`);
      }, show));
    };

    confirm.addEventListener("click", () => {
      if (phase !== "input" || done) return;
      phase = "check";
      confirm.disabled = true;
      const r = rounds[index];
      const target = new Set(r.lit);
      const ok = chosen.size === target.size && [...chosen].every((i) => target.has(i));
      // mostra giusto/sbagliato
      cells.forEach((c, i) => {
        c.className = "copy-cell";
        if (target.has(i) && chosen.has(i)) c.classList.add("ok");
        else if (target.has(i)) c.classList.add("missed");
        else if (chosen.has(i)) c.classList.add("wrong");
      });
      if (ok) { correct++; sfx.play("good"); vibrate(12); shell.setHint("Esatto!"); }
      else { sfx.play("bad"); vibrate([60, 30, 60]); shell.setHint("Non proprio…"); }
      index++;
      timers.push(setTimeout(() => {
        if (index >= ROUNDS) {
          done = true;
          shell.showDone(this.formatScore(correct));
          ctx.onFinish(correct);
        } else {
          playRound();
        }
      }, 1100));
    });

    playRound();
  },

  unmount() {
    timers.forEach(clearTimeout);
    timers = [];
    shell?.remove();
    shell = null;
  },
};
