/*
  Tris veloce: partite lampo di tris contro il telefono per 30 secondi.
  Tu sei X e cominci. Vittoria 3 punti, pareggio 1, sconfitta 0.
  Le "distrazioni" dell'avversario sono decise dal seme: uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer } from "./shell.js";

const DURATION = 30;
const MISTAKE = { facile: 0.5, normale: 0.28, difficile: 0.12 }; // quanto spesso l'avversario si distrae
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

let shell = null;
let stopTimer = null;
let aiTimer = null;
let nextTimer = null;

function winner(b) {
  for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return { who: b[a], line: [a, c, d] };
  return null;
}

// Mossa dell'avversario: vince se può, blocca se deve, poi centro, angoli, altro.
// Con una "distrazione" gioca a caso.
function aiMove(b, distracted, pick) {
  const free = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  if (distracted) return free[Math.floor(pick * free.length)];
  const tryLine = (mark) => {
    for (const [x, y, z] of LINES) {
      const cells = [x, y, z];
      const marks = cells.map((i) => b[i]);
      if (marks.filter((m) => m === mark).length === 2 && marks.includes("")) return cells[marks.indexOf("")];
    }
    return -1;
  };
  let m = tryLine("O");
  if (m >= 0) return m;
  m = tryLine("X");
  if (m >= 0) return m;
  if (!b[4]) return 4;
  const corners = [0, 2, 6, 8].filter((i) => !b[i]);
  if (corners.length) return corners[Math.floor(pick * corners.length)];
  return free[Math.floor(pick * free.length)];
}

export default {
  id: "tris",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const p = MISTAKE[difficulty] || MISTAKE.normale;
    // Una lunga serie di decisioni pronte: l'avversario le consuma in ordine
    const moves = Array.from({ length: 120 }, () => ({ distracted: rng() < p, pick: rng() }));
    return { moves };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "punto" : "punti"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const { moves } = ctx.params;
    shell = createShell(container, { title: "Tris veloce", hint: "Tu sei X: vinci 3, pari 1" });
    const board = el("div", { class: "tris-board" });
    const cells = Array.from({ length: 9 }, () => el("div", { class: "tris-cell" }));
    board.append(...cells);
    const tally = el("div", { class: "tris-tally", text: "" });
    shell.body.append(board, tally);

    let b = Array(9).fill("");
    let myTurn = true;
    let score = 0, wins = 0, draws = 0, losses = 0;
    let moveIdx = 0;
    let done = false;

    const render = (line = null) => {
      cells.forEach((c, i) => {
        c.textContent = b[i];
        c.className = `tris-cell${b[i] === "X" ? " x" : b[i] === "O" ? " o" : ""}${line?.includes(i) ? " win" : ""}`;
      });
      tally.textContent = `Vinte ${wins} · Pari ${draws} · Perse ${losses}`;
    };

    const newGame = () => {
      b = Array(9).fill("");
      myTurn = true;
      render();
      shell.setHint(`Punti: ${score} · tocca a te`);
    };

    const endGame = (result, line) => {
      myTurn = false;
      if (result === "X") { wins++; score += 3; vibrate(40); sfx.play("perfect"); }
      else if (result === "O") { losses++; vibrate([60, 30, 60]); sfx.play("bad"); }
      else { draws++; score += 1; sfx.play("good"); }
      render(line);
      shell.setHint(result === "X" ? "Vinta! +3" : result === "O" ? "Persa" : "Pari +1");
      nextTimer = setTimeout(() => { if (!done) newGame(); }, 800);
    };

    const check = () => {
      const w = winner(b);
      if (w) { endGame(w.who, w.line); return true; }
      if (b.every(Boolean)) { endGame("=", null); return true; }
      return false;
    };

    cells.forEach((cell, i) => {
      cell.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        if (done || !myTurn || b[i]) return;
        b[i] = "X";
        myTurn = false;
        vibrate(10);
        sfx.play("blip");
        render();
        if (check()) return;
        const m = moves[moveIdx++ % moves.length];
        aiTimer = setTimeout(() => {
          if (done) return;
          b[aiMove(b, m.distracted, m.pick)] = "O";
          sfx.play("flip");
          render();
          if (!check()) { myTurn = true; }
        }, 280);
      });
    });

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => {
        done = true;
        clearTimeout(aiTimer);
        clearTimeout(nextTimer);
        shell.showDone(this.formatScore(score));
        ctx.onFinish(score, `${wins} ${wins === 1 ? "vinta" : "vinte"}, ${draws} pari, ${losses} ${losses === 1 ? "persa" : "perse"}`);
      }
    );
    newGame();
  },

  unmount() {
    stopTimer?.();
    clearTimeout(aiTimer);
    clearTimeout(nextTimer);
    shell?.remove();
    shell = null;
  },
};
