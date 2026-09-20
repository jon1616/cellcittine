/*
  Sequenza: quattro tasti colorati si accendono in ordine; ripeti la sequenza,
  che si allunga di un passo ogni volta. Il punteggio è quanti passi hai
  completato. La sequenza è uguale per tutti (stesso seme).
*/

import { el, vibrate, sleep } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell } from "./shell.js";

const LEVELS = { facile: 8, normale: 10, difficile: 14 };
const SPEED = { facile: 650, normale: 500, difficile: 380 };
const INPUT_TIMEOUT = 4000;

const PADS = [
  { color: "#ff595e", bright: "#ffb3b5" },
  { color: "#1982c4", bright: "#9ed0f2" },
  { color: "#8ac926", bright: "#d3f09a" },
  { color: "#ffca3a", bright: "#ffe9a8" },
];

let shell = null;
let alive = false;

export default {
  id: "sequenza",
  order: "desc",
  maxSeconds: 75,

  createParams(rng, difficulty) {
    const maxLevel = LEVELS[difficulty] || LEVELS.normale;
    const sequence = Array.from({ length: maxLevel }, () => Math.floor(rng() * 4));
    return { sequence, maxLevel, speed: SPEED[difficulty] || SPEED.normale };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "passo" : "passi"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore(params) {
    return params.maxLevel;
  },

  mount(container, ctx) {
    const { sequence, maxLevel, speed } = ctx.params;
    alive = true;
    shell = createShell(container, { title: "Sequenza", hint: "Guarda…" });

    const pads = PADS.map((p, i) => {
      const pad = el("div", { class: "seq-pad" });
      pad.style.setProperty("--pad", p.color);
      pad.style.setProperty("--pad-bright", p.bright);
      pad.dataset.index = i;
      return pad;
    });
    const grid = el("div", { class: "seq-grid" }, pads);
    shell.body.append(grid);

    let level = 0;        // passi completati
    let inputPos = 0;
    let accepting = false;
    let inputTimer = null;
    let done = false;

    const light = async (i, ms) => {
      sfx.pad(i, Math.max(0.12, ms / 1000));
      pads[i].classList.add("lit");
      await sleep(ms);
      pads[i].classList.remove("lit");
    };

    const finish = (score) => {
      if (done) return;
      done = true;
      accepting = false;
      clearTimeout(inputTimer);
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, score >= maxLevel ? "Sequenza completa!" : `Sbagliato al passo ${score + 1}`);
    };

    const armTimeout = () => {
      clearTimeout(inputTimer);
      inputTimer = setTimeout(() => finish(level), INPUT_TIMEOUT);
    };

    const playRound = async () => {
      accepting = false;
      shell.setHint("Guarda…");
      shell.setTimer(`${level} / ${maxLevel}`);
      await sleep(600);
      for (let i = 0; i <= level; i++) {
        if (!alive) return;
        await light(sequence[i], speed * 0.6);
        await sleep(speed * 0.4);
      }
      if (!alive) return;
      inputPos = 0;
      accepting = true;
      shell.setHint("Ripeti!");
      armTimeout();
    };

    grid.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      const pad = ev.target.closest(".seq-pad");
      if (!pad || !accepting || done) return;
      const i = Number(pad.dataset.index);
      light(i, 180);
      vibrate(10);

      if (i !== sequence[inputPos]) {
        vibrate([80, 40, 80]);
        sfx.play("bad");
        finish(level);
        return;
      }
      inputPos++;
      armTimeout();
      if (inputPos > level) {
        level++;
        clearTimeout(inputTimer);
        setTimeout(() => sfx.play("good"), 200);
        if (level >= maxLevel) {
          finish(level);
        } else {
          playRound();
        }
      }
    });

    playRound();
  },

  unmount() {
    alive = false;
    shell?.remove();
    shell = null;
  },
};
