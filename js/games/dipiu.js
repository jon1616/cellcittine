/*
  Di più: due riquadri pieni di pallini. Tocca quello che ne ha di più,
  a colpo d'occhio. 20 secondi, +1 / -1. Le quantità sono uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer } from "./shell.js";

const DURATION = 20;
const SETTINGS = {
  facile: { base: [5, 14], diffMin: 3, diffMax: 6 },
  normale: { base: [8, 20], diffMin: 2, diffMax: 4 },
  difficile: { base: [12, 26], diffMin: 1, diffMax: 3 },
};
const COLORS = ["#ffca3a", "#36cfc9", "#f15bb5", "#8ac926"];

let shell = null;
let stopTimer = null;

// Posizioni su una griglia 6x6 con un po' di disordine, senza sovrapposizioni.
function layout(count, rng) {
  const cells = [];
  for (let i = 0; i < 36; i++) cells.push(i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells.slice(0, count).map((c) => ({
    x: (c % 6) / 6 + 0.03 + rng() * 0.09,
    y: Math.floor(c / 6) / 6 + 0.03 + rng() * 0.09,
  }));
}

export default {
  id: "dipiu",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const s = SETTINGS[difficulty] || SETTINGS.normale;
    const rounds = Array.from({ length: 60 }, () => {
      const a = s.base[0] + Math.floor(rng() * (s.base[1] - s.base[0]));
      const diff = s.diffMin + Math.floor(rng() * (s.diffMax - s.diffMin + 1));
      const left = rng() < 0.5 ? a : a + diff;
      const right = left === a ? a + diff : a;
      return {
        left, right,
        leftDots: layout(left, rng),
        rightDots: layout(right, rng),
        color: COLORS[Math.floor(rng() * COLORS.length)],
        // pallini di dimensione diversa nei due riquadri, per non fidarsi dell'area colorata
        sizeL: 0.55 + rng() * 0.5,
        sizeR: 0.55 + rng() * 0.5,
      };
    });
    return { rounds };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "punto" : "punti"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const { rounds } = ctx.params;
    shell = createShell(container, { title: "Di più", hint: "Punti: 0" });

    const leftPanel = el("div", { class: "dots-panel" });
    const rightPanel = el("div", { class: "dots-panel" });
    shell.body.append(el("div", { class: "dots-wrap" }, [leftPanel, rightPanel]));

    let index = 0;
    let score = 0;
    let right = 0;
    let wrong = 0;
    let done = false;

    const fill = (panel, dots, color, sizeMul) => {
      panel.replaceChildren(
        ...dots.map((d) => {
          const dot = el("div", { class: "dot" });
          dot.style.cssText = `left:${d.x * 100}%;top:${d.y * 100}%;background:${color};width:${14 * sizeMul}px;height:${14 * sizeMul}px;`;
          return dot;
        })
      );
    };

    const show = () => {
      const r = rounds[index % rounds.length];
      fill(leftPanel, r.leftDots, r.color, r.sizeL);
      fill(rightPanel, r.rightDots, r.color, r.sizeR);
    };

    const pick = (side) => {
      if (done) return;
      const r = rounds[index % rounds.length];
      const correct = (side === "left" && r.left > r.right) || (side === "right" && r.right > r.left);
      if (correct) {
        score++;
        right++;
        vibrate(10);
        sfx.play("good");
      } else {
        score = Math.max(0, score - 1);
        wrong++;
        vibrate([60, 30, 60]);
        sfx.play("bad");
      }
      shell.setHint(`Punti: ${score}`);
      index++;
      show();
    };
    leftPanel.addEventListener("pointerdown", (ev) => { ev.preventDefault(); pick("left"); });
    rightPanel.addEventListener("pointerdown", (ev) => { ev.preventDefault(); pick("right"); });

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
