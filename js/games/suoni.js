/*
  Suoni: tessere tutte uguali, ognuna nasconde una nota. Toccane due: se
  suonano uguale restano aperte. Un memory per le orecchie. 45 secondi.
  Note e posizioni uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, shuffle } from "./shell.js";

const DURATION = 45;
const PAIRS = { facile: 4, normale: 6, difficile: 8 };
const COLORS = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#f15bb5", "#36cfc9", "#c77dff", "#ff924c"];

let shell = null;
let stopTimer = null;
let closeTimer = null;

export default {
  id: "suoni",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const pairs = PAIRS[difficulty] || PAIRS.normale;
    const notes = shuffle(Array.from({ length: 8 }, (_, i) => i), rng).slice(0, pairs);
    const tiles = shuffle([...notes, ...notes], rng);
    return { pairs, tiles };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "coppia" : "coppie"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore(params) {
    return params.pairs;
  },

  mount(container, ctx) {
    const { pairs, tiles } = ctx.params;
    shell = createShell(container, { title: "Suoni", hint: "Trova le coppie di note uguali" });
    const grid = el("div", { class: "snd-grid" });
    grid.style.gridTemplateColumns = `repeat(${tiles.length <= 8 ? 4 : 4}, 1fr)`;
    const nodes = tiles.map((note, i) => {
      const t = el("div", { class: "snd-tile" }, [el("span", { class: "snd-icon", text: "♪" })]);
      t.dataset.i = i;
      return t;
    });
    grid.append(...nodes);
    shell.body.append(grid);

    let open = [];   // indici aperti (max 2)
    let found = 0, tries = 0;
    let done = false;
    let busy = false;

    const play = (i) => sfx.note(tiles[i], 8, 0.45);

    nodes.forEach((t, i) => {
      t.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        if (done || busy || t.classList.contains("found") || open.includes(i)) return;
        play(i);
        t.classList.add("open");
        open.push(i);
        if (open.length === 2) {
          tries++;
          const [a, b] = open;
          if (tiles[a] === tiles[b]) {
            found++;
            const color = COLORS[tiles[a] % COLORS.length];
            for (const k of [a, b]) { nodes[k].classList.add("found"); nodes[k].style.background = color; }
            open = [];
            vibrate(20);
            setTimeout(() => sfx.play("good"), 200);
            shell.setHint(`Coppie: ${found} di ${pairs}`);
            if (found >= pairs) finish();
          } else {
            busy = true;
            closeTimer = setTimeout(() => {
              for (const k of [a, b]) nodes[k].classList.remove("open");
              open = [];
              busy = false;
              sfx.play("flip");
            }, 800);
          }
        }
      });
    });

    const finish = () => {
      if (done) return;
      done = true;
      stopTimer?.();
      clearTimeout(closeTimer);
      shell.showDone(this.formatScore(found));
      ctx.onFinish(found, `${tries} ${tries === 1 ? "tentativo" : "tentativi"}${found >= pairs ? " · tutte trovate!" : ""}`);
    };

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => finish()
    );
  },

  unmount() {
    stopTimer?.();
    clearTimeout(closeTimer);
    shell?.remove();
    shell = null;
  },
};
