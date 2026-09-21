/*
  Melodia: quattro tasti come un piccolo pianoforte. Una melodia suona una
  volta sola (i tasti si accendono), poi la ripeti. Ogni giro la melodia è
  nuova e più lunga. Punteggio: note giuste. Melodie uguali per tutti.
*/

import { el, vibrate, sleep } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer } from "./shell.js";

const DURATION = 50;
const LENGTHS = [3, 4, 5, 6, 7, 8, 9, 10];
const SPEED = { facile: 620, normale: 470, difficile: 360 };
const IDLE_LIMIT = 5000; // senza tocchi in fase di risposta: il giro si chiude da solo

const KEYS = [
  { color: "#ff595e", bright: "#ffb3b5", label: "DO" },
  { color: "#ffca3a", bright: "#ffe9a8", label: "RE" },
  { color: "#8ac926", bright: "#d3f09a", label: "MI" },
  { color: "#1982c4", bright: "#9ed0f2", label: "SOL" },
];

let shell = null;
let stopTimer = null;
let alive = false;

export default {
  id: "melodia",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const tunes = LENGTHS.map((len) => {
      const notes = [];
      for (let i = 0; i < len; i++) {
        let n = Math.floor(rng() * 4);
        if (i > 0 && n === notes[i - 1] && rng() < 0.6) n = (n + 1 + Math.floor(rng() * 3)) % 4; // meno ripetizioni
        notes.push(n);
      }
      return notes;
    });
    return { tunes, speed: SPEED[difficulty] || SPEED.normale };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "nota" : "note"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore(params) {
    return params.tunes.reduce((a, t) => a + t.length, 0);
  },

  mount(container, ctx) {
    const { tunes, speed } = ctx.params;
    alive = true;
    shell = createShell(container, { title: "Melodia", hint: "Ascolta…" });

    const keys = KEYS.map((k, i) => {
      const key = el("div", { class: "mel-key" }, [el("span", { text: k.label })]);
      key.style.setProperty("--pad", k.color);
      key.style.setProperty("--pad-bright", k.bright);
      key.dataset.index = i;
      return key;
    });
    const row = el("div", { class: "mel-keys" }, keys);
    const progress = el("div", { class: "mel-progress" });
    shell.body.append(row, progress);

    let score = 0, right = 0, wrong = 0;
    let tune = 0, pos = 0;
    let accepting = false;
    let idleTimer = null;
    let done = false;

    const light = async (i, ms) => {
      sfx.pad(i, Math.max(0.12, ms / 1000));
      keys[i].classList.add("lit");
      await sleep(ms);
      keys[i].classList.remove("lit");
    };

    const showProgress = () => {
      const t = tunes[tune] || [];
      progress.replaceChildren(...t.map((_, i) => el("span", { class: `mel-dot${i < pos ? " ok" : ""}` })));
    };

    const finish = () => {
      if (done) return;
      done = true;
      accepting = false;
      alive = false;
      clearTimeout(idleTimer);
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, `${right} giuste, ${wrong} sbagliate · ${tune} ${tune === 1 ? "melodia completa" : "melodie complete"}`);
    };

    const armIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { if (accepting) miss(); }, IDLE_LIMIT);
    };

    const nextTune = async () => {
      if (!alive) return;
      if (tune >= tunes.length) { finish(); return; }
      pos = 0;
      accepting = false;
      shell.setHint(`Ascolta… (${tunes[tune].length} note)`);
      showProgress();
      await sleep(500);
      for (const n of tunes[tune]) {
        if (!alive) return;
        await light(n, speed * 0.75);
        await sleep(speed * 0.25);
      }
      if (!alive) return;
      shell.setHint("Ripeti!");
      accepting = true;
      armIdle();
    };

    const miss = async () => {
      accepting = false;
      clearTimeout(idleTimer);
      wrong++;
      vibrate([60, 30, 60]);
      sfx.play("bad");
      row.classList.add("shake");
      await sleep(350);
      row.classList.remove("shake");
      tune++;
      nextTune();
    };

    for (const key of keys) {
      key.addEventListener("pointerdown", async (ev) => {
        ev.preventDefault();
        if (!accepting || done) return;
        const i = Number(key.dataset.index);
        const t = tunes[tune];
        if (i === t[pos]) {
          pos++;
          score++;
          right++;
          vibrate(10);
          light(i, 160);
          showProgress();
          shell.setHint(`Ripeti! ${pos}/${t.length}`);
          if (pos >= t.length) {
            accepting = false;
            clearTimeout(idleTimer);
            sfx.play("good");
            tune++;
            await sleep(450);
            nextTune();
          } else {
            armIdle();
          }
        } else {
          miss();
        }
      });
    }

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => finish()
    );
    nextTune();
  },

  unmount() {
    alive = false;
    stopTimer?.();
    shell?.remove();
    shell = null;
  },
};
