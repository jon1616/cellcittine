/*
  Percorso: su una griglia si accende un percorso, una casella dopo l'altra.
  Poi tocca le caselle nello stesso ordine. Ogni percorso giusto, il prossimo
  è più lungo; al terzo errore finisce. Percorsi uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer } from "./shell.js";

const DURATION = 45;
const SIZE = 5;
const START = { facile: 3, normale: 4, difficile: 5 };
const MAX_PATHS = 12;
const LIVES = 3;
const STEP_MS = 420;

// Un percorso di `len` caselle adiacenti, senza ripassare
function makePath(rng, len) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const path = [Math.floor(rng() * SIZE * SIZE)];
    while (path.length < len) {
      const cur = path[path.length - 1];
      const r = Math.floor(cur / SIZE), c = cur % SIZE;
      const opts = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
        .filter(([rr, cc]) => rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE)
        .map(([rr, cc]) => rr * SIZE + cc)
        .filter((i) => !path.includes(i));
      if (!opts.length) break;
      path.push(opts[Math.floor(rng() * opts.length)]);
    }
    if (path.length === len) return path;
  }
  return null;
}

let shell = null;
let stopTimer = null;
let timers = [];

export default {
  id: "percorso",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const start = START[difficulty] || START.normale;
    const paths = [];
    for (let i = 0; i < MAX_PATHS; i++) {
      const len = Math.min(SIZE * SIZE, start + i);
      const p = makePath(rng, len) || makePath(rng, Math.max(3, len - 2)) || [0, 1, 2];
      paths.push(p);
    }
    return { paths };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "percorso" : "percorsi"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const { paths } = ctx.params;
    shell = createShell(container, { title: "Percorso", hint: "Guarda il percorso…" });
    const grid = el("div", { class: "path-grid" });
    shell.body.append(grid);
    const cells = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
      const c = el("div", { class: "path-cell" });
      c.addEventListener("pointerdown", (ev) => { ev.preventDefault(); tap(i, c); });
      cells.push(c);
      grid.append(c);
    }

    let index = 0, score = 0, lives = LIVES, pos = 0;
    let phase = "show"; // show | input | done
    let longest = 0;
    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const clearCells = () => cells.forEach((c) => { c.classList.remove("lit", "ok", "ko", "start"); c.textContent = ""; });

    const showPath = () => {
      phase = "show";
      clearCells();
      const path = paths[index];
      shell.setHint(`Guarda il percorso… (${path.length} caselle)`);
      cells[path[0]].classList.add("start");
      path.forEach((cell, k) => {
        later(() => {
          if (phase !== "show") return;
          cells[cell].classList.add("lit");
          cells[cell].textContent = String(k + 1);
          sfx.step(k, path.length);
        }, 300 + k * STEP_MS);
      });
      later(() => {
        if (phase !== "show") return;
        clearCells();
        cells[path[0]].classList.add("start");
        phase = "input";
        pos = 0;
        shell.setHint("Ora tocca le caselle nello stesso ordine");
      }, 300 + path.length * STEP_MS + 500);
    };

    const tap = (i, c) => {
      if (phase !== "input") return;
      const path = paths[index];
      if (i === path[pos]) {
        c.classList.add("ok");
        c.textContent = String(pos + 1);
        pos++;
        vibrate(10);
        sfx.step(pos, path.length);
        if (pos === path.length) {
          score++;
          longest = Math.max(longest, path.length);
          phase = "wait";
          sfx.play("good");
          shell.setHint(`Percorsi: ${score}`);
          index++;
          if (index >= paths.length) { later(finish, 400); return; }
          later(showPath, 600);
        }
      } else {
        lives--;
        c.classList.add("ko");
        vibrate([60, 30, 60]);
        sfx.play("bad");
        phase = "wait";
        shell.setHint(lives > 0 ? `Sbagliato! ${lives} ${lives === 1 ? "tentativo rimasto" : "tentativi rimasti"}` : "Finito!");
        if (lives <= 0) { later(finish, 500); return; }
        later(showPath, 800); // stesso percorso, di nuovo
      }
    };

    const finish = () => {
      if (phase === "done") return;
      phase = "done";
      stopTimer?.();
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, longest ? `percorso più lungo: ${longest} caselle` : "nessun percorso completato");
    };

    stopTimer = runTimer(DURATION, (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`), finish);
    showPath();
  },

  unmount() {
    stopTimer?.();
    timers.forEach(clearTimeout);
    timers = [];
    shell?.remove();
    shell = null;
  },
};
