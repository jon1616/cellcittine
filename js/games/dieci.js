/*
  Dieci: una griglia di numeri. Tocca due numeri che sommati fanno 10:
  spariscono e ne arrivano altri. 25 secondi, più coppie possibili.
  C'è sempre almeno una coppia possibile.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer } from "./shell.js";

const DURATION = 25;
const TARGET = 10;
const GRID = { facile: [3, 3], normale: [4, 4], difficile: [4, 5] }; // colonne, righe
const COLORS = ["#ff595e", "#ff924c", "#ffca3a", "#8ac926", "#36cfc9", "#1982c4", "#6a4c93", "#f15bb5", "#c9a227"];

let shell = null;
let stopTimer = null;
let clearTimer = null;

export default {
  id: "dieci",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const [cols, rows] = GRID[difficulty] || GRID.normale;
    const cells = cols * rows;
    // La griglia è fatta di coppie complementari (a, 10-a): sempre risolvibile.
    const pairs = Array.from({ length: 200 }, () => {
      const a = 1 + Math.floor(rng() * 9);
      return [a, TARGET - a];
    });
    // Ordine di riempimento iniziale mescolato
    const initial = [];
    for (let i = 0; i < Math.floor(cells / 2); i++) initial.push(...pairs[i]);
    if (cells % 2 === 1) initial.push(5); // con celle impari, un 5 in più (5+5=10 con un altro 5 in arrivo)
    for (let i = initial.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [initial[i], initial[j]] = [initial[j], initial[i]]; }
    return { cols, rows, initial, refills: pairs.slice(Math.floor(cells / 2)) };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "coppia" : "coppie"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const { cols, initial, refills } = ctx.params;
    shell = createShell(container, { title: "Dieci", hint: "Tocca due numeri che fanno 10" });
    const grid = el("div", { class: "ten-grid" });
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    shell.body.append(grid);

    const values = [...initial];
    let refillIndex = 0;
    let selected = null;
    let pairsFound = 0;
    let errors = 0;
    let locked = false;
    let done = false;

    const cells = values.map((v, i) => {
      const c = el("div", { class: "ten-cell", text: String(v) });
      c.style.background = COLORS[(v - 1) % COLORS.length];
      c.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        if (locked || done) return;
        if (selected === i) { c.classList.remove("sel"); selected = null; sfx.play("blip"); return; }
        if (selected === null) { selected = i; c.classList.add("sel"); sfx.play("flip"); return; }
        const a = values[selected], b = values[i];
        const first = cells[selected];
        if (a + b === TARGET) {
          pairsFound++;
          sfx.play("good");
          vibrate(10);
          first.classList.add("gone");
          c.classList.add("gone");
          locked = true;
          const si = selected;
          selected = null;
          clearTimer = setTimeout(() => {
            // rimpiazza con una nuova coppia complementare
            const pair = refills[refillIndex % refills.length];
            refillIndex++;
            values[si] = pair[0];
            values[i] = pair[1];
            for (const [idx, val] of [[si, pair[0]], [i, pair[1]]]) {
              cells[idx].textContent = String(val);
              cells[idx].style.background = COLORS[(val - 1) % COLORS.length];
              cells[idx].className = "ten-cell";
            }
            locked = false;
          }, 250);
          shell.setHint(`Coppie: ${pairsFound}`);
        } else {
          errors++;
          sfx.play("bad");
          vibrate([60, 30, 60]);
          first.classList.add("wrong");
          c.classList.add("wrong");
          locked = true;
          selected = null;
          clearTimer = setTimeout(() => {
            first.classList.remove("wrong", "sel");
            c.classList.remove("wrong", "sel");
            locked = false;
          }, 300);
        }
      });
      return c;
    });
    grid.append(...cells);

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => {
        done = true;
        shell.showDone(this.formatScore(pairsFound));
        ctx.onFinish(pairsFound, `${errors} ${errors === 1 ? "errore" : "errori"}`);
      }
    );
  },

  unmount() {
    stopTimer?.();
    clearTimeout(clearTimer);
    shell?.remove();
    shell = null;
  },
};
