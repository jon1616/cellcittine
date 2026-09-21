/*
  Parola nascosta: una griglia di lettere nasconde la parola indicata, in
  orizzontale o in verticale. Tocca le sue lettere in ordine, dalla prima
  all'ultima. 40 secondi, più parole possibili. Griglie uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, shuffle } from "./shell.js";

const DURATION = 40;
const SIZE = { facile: 5, normale: 6, difficile: 7 };
const PUZZLES = 15;
const ALPHABET = "AABCDEEEFGHIILMNOOPQRSTUUVZ";
const WORDS = [
  "CASA", "GATTO", "SOLE", "LUNA", "MARE", "PANE", "FIORE", "LIBRO", "PORTA", "PALLA", "TORTA", "MELA", "NEVE", "VENTO",
  "TRENO", "NAVE", "AEREO", "PENNA", "ACQUA", "FUOCO", "TERRA", "STELLA", "NUVOLA", "PESCE", "RANA", "ORSO", "LEONE",
  "TIGRE", "ZEBRA", "MUCCA", "GALLO", "CUORE", "MANO", "PIEDE", "NASO", "FIUME", "LAGO", "ISOLA", "ONDA", "GRILLO",
  "GUFO", "AQUILA", "CIGNO", "PONTE", "TORRE", "DRAGO", "MAGIA", "TESORO", "PIRATA", "MAPPA", "VELA", "FARO", "GELATO",
  "LIMONE", "BANANA", "MUSICA", "BALLO", "CINEMA", "RAZZO", "COMETA", "SFIDA", "ESTATE", "VIAGGIO", "SEGRETO", "ENIGMA",
];

let shell = null;
let stopTimer = null;

function makePuzzle(size, rng) {
  const pool = WORDS.filter((w) => w.length <= size);
  const word = pool[Math.floor(rng() * pool.length)];
  const horizontal = rng() < 0.5;
  const start = Math.floor(rng() * (size - word.length + 1));
  const line = Math.floor(rng() * size);
  const cells = [];
  for (let i = 0; i < word.length; i++) cells.push(horizontal ? line * size + start + i : (start + i) * size + line);
  const letters = Array.from({ length: size * size }, () => ALPHABET[Math.floor(rng() * ALPHABET.length)]);
  cells.forEach((c, i) => { letters[c] = word[i]; });
  return { word, cells, letters };
}

export default {
  id: "parola",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const size = SIZE[difficulty] || SIZE.normale;
    return { size, puzzles: Array.from({ length: PUZZLES }, () => makePuzzle(size, rng)) };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "parola" : "parole"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const { size, puzzles } = ctx.params;
    shell = createShell(container, { title: "Parola nascosta", hint: "Tocca le lettere in ordine" });
    const target = el("div", { class: "word-target" });
    const grid = el("div", { class: "word-grid" });
    grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    shell.body.append(target, grid);

    let index = 0, pos = 0, found = 0, wrong = 0;
    let done = false;
    let cellNodes = [];

    const show = () => {
      const p = puzzles[index % puzzles.length];
      pos = 0;
      target.textContent = p.word;
      cellNodes = p.letters.map((ch, i) => {
        const cell = el("div", { class: "word-cell", text: ch });
        cell.addEventListener("pointerdown", (ev) => {
          ev.preventDefault();
          if (done) return;
          if (i === p.cells[pos]) {
            pos++;
            cell.classList.add("on");
            vibrate(10);
            sfx.step(pos, p.word.length);
            if (pos >= p.cells.length) {
              found++;
              sfx.play("perfect");
              shell.setHint(`Trovate: ${found}`);
              cellNodes.forEach((n, k) => { if (p.cells.includes(k)) n.classList.add("ok"); });
              index++;
              setTimeout(() => { if (!done) show(); }, 450);
            }
          } else {
            wrong++;
            pos = 0;
            vibrate([60, 30, 60]);
            sfx.play("bad");
            cellNodes.forEach((n) => n.classList.remove("on"));
            cell.classList.add("wrong");
            setTimeout(() => cell.classList.remove("wrong"), 300);
          }
        });
        return cell;
      });
      grid.replaceChildren(...cellNodes);
    };

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => {
        done = true;
        shell.showDone(this.formatScore(found));
        ctx.onFinish(found, `${wrong} ${wrong === 1 ? "lettera sbagliata" : "lettere sbagliate"}`);
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
