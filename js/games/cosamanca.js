/*
  Cosa manca: guarda un gruppo di forme per qualche secondo. Poi una sparisce
  e le altre si mescolano: quale manca? Scegli tra quattro. Otto giri.
  Forme e risposte uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, shuffle } from "./shell.js";

const DURATION = 50;
const ROUNDS = 8;
const SHAPES = ["circle", "square", "triangle", "star", "diamond", "hexagon", "cross", "pentagon", "ring", "pill"];
const COLORS = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#f15bb5", "#36cfc9", "#c77dff", "#ff924c"];
const SETTINGS = {
  facile: { count: 4, show: 3000 },
  normale: { count: 5, show: 2500 },
  difficile: { count: 6, show: 2000 },
};

let shell = null;
let stopTimer = null;
let timer = null;

export default {
  id: "cosamanca",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const s = SETTINGS[difficulty] || SETTINGS.normale;
    const rounds = [];
    for (let r = 0; r < ROUNDS; r++) {
      const items = shuffle(SHAPES.map((shape, i) => ({ shape, color: COLORS[i % COLORS.length] })), rng).slice(0, s.count);
      const missing = Math.floor(rng() * items.length);
      const rest = shuffle(items.filter((_, i) => i !== missing), rng);
      const others = shuffle(SHAPES.filter((sh) => !items.some((it) => it.shape === sh)), rng).slice(0, 3).map((shape, i) => ({ shape, color: COLORS[(i + 5) % COLORS.length] }));
      const options = shuffle([items[missing], ...others], rng);
      rounds.push({ items, rest, options, answer: items[missing].shape });
    }
    return { rounds, show: s.show };
  },

  formatScore(score) {
    return `${score} su ${ROUNDS}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore() {
    return ROUNDS;
  },

  mount(container, ctx) {
    const { rounds, show } = ctx.params;
    shell = createShell(container, { title: "Cosa manca", hint: "Guarda bene…" });
    const field = el("div", { class: "cm-field" });
    const options = el("div", { class: "cm-options" });
    shell.body.append(field, options);

    let index = 0, score = 0;
    let done = false;

    const item = (it, cls = "cm-item") => {
      const n = el("div", { class: `${cls} shape-${it.shape}` });
      n.style.setProperty("--shape-color", it.color);
      return n;
    };

    const next = () => {
      if (done) return;
      if (index >= ROUNDS) { finish(); return; }
      const r = rounds[index];
      options.replaceChildren();
      field.replaceChildren(...r.items.map((it) => item(it)));
      shell.setHint(`Giro ${index + 1} di ${ROUNDS} · guarda bene…`);
      timer = setTimeout(() => {
        if (done) return;
        field.replaceChildren(...r.rest.map((it) => item(it)));
        shell.setHint("Quale manca?");
        sfx.play("flip");
        options.replaceChildren(...r.options.map((op) => {
          const btn = el("button", { class: "cm-option" }, [item(op, "cm-item small")]);
          btn.addEventListener("pointerdown", (ev) => {
            ev.preventDefault();
            if (done) return;
            options.querySelectorAll("button").forEach((b) => { b.disabled = true; });
            if (op.shape === r.answer) { score++; vibrate(15); sfx.play("good"); btn.classList.add("ok"); }
            else { vibrate([60, 30, 60]); sfx.play("bad"); btn.classList.add("ko"); }
            index++;
            timer = setTimeout(next, 500);
          });
          return btn;
        }));
      }, show);
    };

    const finish = () => {
      if (done) return;
      done = true;
      stopTimer?.();
      clearTimeout(timer);
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, `${score} ${score === 1 ? "indovinata" : "indovinate"} su ${ROUNDS}`);
    };

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => finish()
    );
    next();
  },

  unmount() {
    stopTimer?.();
    clearTimeout(timer);
    shell?.remove();
    shell = null;
  },
};
