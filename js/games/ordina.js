/*
  Ordina: sullo schermo compaiono cerchi di grandezze diverse. Toccali dal
  più piccolo al più grande. Serie dopo serie per 25 secondi.
  Punteggio: tocchi giusti. Le serie sono uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, shuffle } from "./shell.js";

const DURATION = 25;
const COUNT = { facile: 5, normale: 7, difficile: 9 };
const ROUNDS = 10;
const COLORS = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#f15bb5", "#36cfc9", "#c77dff", "#ff924c", "#4cc9f0"];

let shell = null;
let stopTimer = null;

// Cerchi che non si sovrappongono, in coordinate percentuali dell'area
function layout(count, rng) {
  const sizes = shuffle(Array.from({ length: count }, (_, i) => 26 + i * (count > 7 ? 7 : 9)), rng); // diametri in px
  const circles = [];
  for (let i = 0; i < count; i++) {
    let placed = null;
    for (let tries = 0; tries < 200 && !placed; tries++) {
      const c = { x: 8 + rng() * 84, y: 8 + rng() * 84, d: sizes[i], color: COLORS[i % COLORS.length] };
      if (circles.every((o) => Math.hypot((c.x - o.x) * 3.2, (c.y - o.y) * 3.6) > (c.d + o.d) / 2 + 10)) placed = c;
    }
    circles.push(placed || { x: 10 + i * 10, y: 50, d: sizes[i], color: COLORS[i % COLORS.length] });
  }
  return circles;
}

export default {
  id: "ordina",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const count = COUNT[difficulty] || COUNT.normale;
    return { rounds: Array.from({ length: ROUNDS }, () => layout(count, rng)) };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "tocco" : "tocchi"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const { rounds } = ctx.params;
    shell = createShell(container, { title: "Ordina", hint: "Dal più piccolo al più grande" });
    const field = el("div", { class: "ord-field" });
    shell.body.append(field);

    let round = 0, next = 0, score = 0, wrong = 0, series = 0;
    let done = false;

    const show = () => {
      const circles = rounds[round % rounds.length];
      const order = [...circles].sort((a, b) => a.d - b.d);
      next = 0;
      field.replaceChildren(...circles.map((c) => {
        const node = el("div", { class: "ord-circle" });
        node.style.cssText = `left:${c.x}%;top:${c.y}%;width:${c.d}px;height:${c.d}px;background:${c.color};`;
        node.addEventListener("pointerdown", (ev) => {
          ev.preventDefault();
          if (done || node.classList.contains("gone")) return;
          if (c === order[next]) {
            next++;
            score++;
            vibrate(10);
            sfx.step(next, order.length);
            node.classList.add("gone");
            shell.setHint(`Giusti: ${score}`);
            if (next >= order.length) {
              series++;
              sfx.play("good");
              round++;
              setTimeout(() => { if (!done) show(); }, 250);
            }
          } else {
            wrong++;
            vibrate([60, 30, 60]);
            sfx.play("bad");
            node.classList.add("shake");
            setTimeout(() => node.classList.remove("shake"), 300);
          }
        });
        return node;
      }));
    };

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => {
        done = true;
        shell.showDone(this.formatScore(score));
        ctx.onFinish(score, `${series} ${series === 1 ? "serie completa" : "serie complete"}, ${wrong} ${wrong === 1 ? "errore" : "errori"}`);
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
