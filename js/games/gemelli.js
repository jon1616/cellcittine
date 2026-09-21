/*
  Gemelli: due griglie colorate una accanto all'altra. Sono identiche o c'è
  una casella diversa? Rispondi in fretta: +1 giusta, −1 sbagliata. 20 secondi.
  Griglie uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer } from "./shell.js";

const DURATION = 20;
const SIZE = { facile: 3, normale: 4, difficile: 5 };
const COLORS = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#f15bb5", "#36cfc9"];

let shell = null;
let stopTimer = null;

export default {
  id: "gemelli",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const size = SIZE[difficulty] || SIZE.normale;
    const rounds = [];
    for (let r = 0; r < 40; r++) {
      const a = Array.from({ length: size * size }, () => Math.floor(rng() * COLORS.length));
      const b = [...a];
      const same = rng() < 0.5;
      if (!same) {
        const i = Math.floor(rng() * b.length);
        b[i] = (b[i] + 1 + Math.floor(rng() * (COLORS.length - 1))) % COLORS.length;
      }
      rounds.push({ a, b, same });
    }
    return { size, rounds };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "punto" : "punti"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const { size, rounds } = ctx.params;
    shell = createShell(container, { title: "Gemelli", hint: "Punti: 0" });
    const pair = el("div", { class: "gem-pair" });
    const gridA = el("div", { class: "gem-grid" });
    const gridB = el("div", { class: "gem-grid" });
    gridA.style.gridTemplateColumns = gridB.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    pair.append(gridA, gridB);
    const buttons = el("div", { class: "gem-buttons" }, [
      el("button", { class: "gem-btn same", text: "Uguali" }),
      el("button", { class: "gem-btn diff", text: "Diverse" }),
    ]);
    shell.body.append(pair, buttons);

    let index = 0, score = 0, right = 0, wrong = 0;
    let done = false;

    const paint = (grid, cells) => grid.replaceChildren(...cells.map((c) => { const n = el("div", { class: "gem-cell" }); n.style.background = COLORS[c]; return n; }));
    const show = () => {
      const r = rounds[index % rounds.length];
      paint(gridA, r.a);
      paint(gridB, r.b);
    };

    buttons.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        if (done) return;
        const r = rounds[index % rounds.length];
        const saidSame = btn.classList.contains("same");
        if (saidSame === r.same) { score++; right++; vibrate(10); sfx.play("good"); }
        else { score = Math.max(0, score - 1); wrong++; vibrate([60, 30, 60]); sfx.play("bad"); pair.classList.add("shake"); setTimeout(() => pair.classList.remove("shake"), 250); }
        shell.setHint(`Punti: ${score}`);
        index++;
        show();
      });
    });

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => {
        done = true;
        shell.showDone(this.formatScore(score));
        ctx.onFinish(score, `${right} giuste, ${wrong} sbagliate`);
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
