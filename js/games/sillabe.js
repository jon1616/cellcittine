/*
  Sillabe: le sillabe di una parola sono in disordine. Toccale nell'ordine
  giusto per ricomporla. Parole completate in 30 secondi. In difficile c'è
  una sillaba intrusa. Parole uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, shuffle } from "./shell.js";

const DURATION = 30;
const WORDS = [
  ["CA", "SA"], ["ME", "LA"], ["PA", "NE"], ["SO", "LE"], ["LU", "NA"], ["MA", "RE"], ["NA", "VE"], ["RO", "SA"],
  ["TA", "VO", "LO"], ["FI", "NE", "STRA"], ["BAM", "BI", "NO"], ["GE", "LA", "TO"], ["CA", "VAL", "LO"], ["MON", "TA", "GNA"],
  ["FAR", "FAL", "LA"], ["PA", "TA", "TA"], ["BI", "CI", "CLET", "TA"], ["CIOC", "CO", "LA", "TO"], ["TE", "LE", "FO", "NO"],
  ["OM", "BREL", "LO"], ["PO", "MO", "DO", "RO"], ["ZAI", "NET", "TO"], ["MAC", "CHI", "NA"], ["QUA", "DER", "NO"], ["MA", "TI", "TA"],
  ["GIAR", "DI", "NO"], ["FRA", "GO", "LA"], ["CA", "STEL", "LO"], ["PI", "SCI", "NA"], ["SCUO", "LA"], ["LI", "BRO"], ["PIZ", "ZA"],
  ["CAN", "DE", "LA"], ["FI", "NE"], ["CO", "NI", "GLIO"], ["CA", "MI", "NO"], ["FO", "RE", "STA"], ["TAR", "TA", "RU", "GA"],
  ["PAP", "PA", "GAL", "LO"], ["ZUC", "CHE", "RO"], ["BA", "NA", "NA"], ["LI", "MO", "NE"], ["PEN", "NA"], ["CIE", "LO"], ["FUO", "CO"],
  ["ELE", "FAN", "TE"], ["CA", "NE"], ["GAT", "TO"], ["PES", "CE"], ["AL", "BE", "RO"],
];
const EXTRA = ["TA", "RO", "MI", "LA", "SE", "PO", "NE", "CA", "VI", "BU"];

let shell = null;
let stopTimer = null;

export default {
  id: "sillabe",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const pool = WORDS.filter((w) => (difficulty === "facile" ? w.length <= 3 : difficulty === "difficile" ? w.length >= 3 : true));
    const order = shuffle(pool, rng);
    const words = order.slice(0, 30).map((w) => {
      let chips = [...w];
      if (difficulty === "difficile") {
        const candidates = EXTRA.filter((x) => !w.includes(x));
        chips.push(candidates[Math.floor(rng() * candidates.length)]);
      }
      // Mai già in ordine
      let mixed = shuffle(chips, rng);
      if (mixed.slice(0, w.length).join("") === w.join("")) mixed = [...mixed.slice(1), mixed[0]];
      return { syll: w, chips: mixed };
    });
    return { words };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "parola" : "parole"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const { words } = ctx.params;
    shell = createShell(container, { title: "Sillabe", hint: "Tocca le sillabe in ordine" });
    const target = el("div", { class: "word-target syll-target" });
    const chips = el("div", { class: "syll-chips" });
    shell.body.append(target, chips);

    let index = 0, score = 0, pos = 0, errors = 0;
    let done = false;

    const show = () => {
      const w = words[index % words.length];
      pos = 0;
      target.textContent = "_ ".repeat(w.syll.length).trim();
      chips.replaceChildren(...w.chips.map((s, i) => {
        const b = el("button", { class: "syll-chip", text: s });
        b.addEventListener("pointerdown", (ev) => {
          ev.preventDefault();
          if (done || b.classList.contains("used")) return;
          if (s === w.syll[pos]) {
            b.classList.add("used");
            pos++;
            sfx.step(pos, w.syll.length);
            target.textContent = w.syll.slice(0, pos).join("") + (pos < w.syll.length ? " " + "_ ".repeat(w.syll.length - pos).trim() : "");
            if (pos === w.syll.length) {
              score++;
              vibrate(20);
              sfx.play("good");
              shell.setHint(`Parole: ${score}`);
              index++;
              setTimeout(() => { if (!done) show(); }, 250);
            }
          } else {
            errors++;
            vibrate([60, 30, 60]);
            sfx.play("bad");
            b.classList.add("shake");
            setTimeout(() => b.classList.remove("shake"), 250);
          }
        });
        return b;
      }));
    };

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => {
        done = true;
        shell.showDone(this.formatScore(score));
        ctx.onFinish(score, errors === 0 ? "Nessun errore" : `${errors} ${errors === 1 ? "errore" : "errori"}`);
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
