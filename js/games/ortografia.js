/*
  Ortografia: quattro modi di scrivere la stessa parola, uno solo è giusto.
  Toccalo! +1 giusta, −1 sbagliata. 25 secondi. Parole uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, shuffle } from "./shell.js";

const DURATION = 25;
const WORDS = {
  facile: ["CASA", "GATTO", "PALLA", "SCUOLA", "ACQUA", "ZAINO", "TORTA", "PESCE", "CUORE", "NUVOLA", "SEDIA", "PORTA", "LIBRO", "MELA", "FIORE", "STELLA", "TRENO", "PANE", "LATTE", "SOLE"],
  normale: ["BICICLETTA", "CIOCCOLATO", "FINESTRA", "SPECCHIO", "GIACCA", "CIGNO", "ACQUARIO", "SQUALO", "GHIACCIO", "CHIAVE", "MACCHINA", "ZUCCHERO", "FORMAGGIO", "OROLOGIO", "CUSCINO", "SCIARPA", "FUNGHI", "GNOMO", "QUADERNO", "BOTTIGLIA"],
  difficile: ["COSCIENZA", "SCIENZIATO", "ACQUAZZONE", "SUFFICIENTE", "EFFICIENTE", "ACCELERARE", "CONOSCENZA", "INTELLIGENZA", "SOQQUADRO", "TACCUINO", "ECCEZIONE", "PARRUCCHIERE", "CIRCUITO", "IGIENE", "PROFICUO", "ESERCIZIO", "INGEGNERE", "SCIENZA", "OBIETTIVO", "PSICOLOGO"],
};

// Storpiature deterministiche: raddoppio, sdoppiamento, scambio, lettera tolta, gli/li, cq/q
function misspell(word, rng, avoid) {
  for (let tries = 0; tries < 30; tries++) {
    const r = rng();
    const i = 1 + Math.floor(rng() * (word.length - 2));
    let w = word;
    if (r < 0.25 && word[i] !== word[i - 1]) w = word.slice(0, i) + word[i] + word.slice(i);            // raddoppia
    else if (r < 0.5 && word[i] === word[i + 1]) w = word.slice(0, i) + word.slice(i + 1);               // sdoppia
    else if (r < 0.7 && word[i] !== word[i + 1] && i < word.length - 1) w = word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2); // scambia
    else if (r < 0.85 && word.includes("CQ")) w = word.replace("CQ", "Q");
    else if (word.includes("GLI")) w = word.replace("GLI", "LI");
    else if (word.includes("SC")) w = word.replace("SC", "S");
    else if (word.includes("CH")) w = word.replace("CH", "C");
    else if (word.includes("GH")) w = word.replace("GH", "G");
    else w = word.slice(0, i) + word.slice(i + 1);
    if (w !== word && !avoid.has(w) && w.length >= 3) return w;
  }
  return word.slice(0, 1) + word.slice(2) + "E";
}

let shell = null;
let stopTimer = null;

export default {
  id: "ortografia",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const pool = WORDS[difficulty] || WORDS.normale;
    const deck = shuffle(pool, rng);
    const questions = deck.map((word) => {
      const wrong = new Set();
      while (wrong.size < 3) wrong.add(misspell(word, rng, new Set([word, ...wrong])));
      return { word, options: shuffle([word, ...wrong], rng) };
    });
    return { questions };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "punto" : "punti"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const { questions } = ctx.params;
    shell = createShell(container, { title: "Ortografia", hint: "Qual è scritta bene?" });
    const answers = el("div", { class: "ort-answers" });
    shell.body.append(answers);

    let index = 0, score = 0, ok = 0, ko = 0;
    let done = false;

    const show = () => {
      const q = questions[index % questions.length];
      answers.replaceChildren(...q.options.map((opt) => {
        const btn = el("button", { class: "ort-answer", text: opt.charAt(0) + opt.slice(1).toLowerCase() });
        btn.addEventListener("pointerdown", (ev) => {
          ev.preventDefault();
          if (done) return;
          if (opt === q.word) { score++; ok++; vibrate(10); sfx.play("good"); }
          else { score = Math.max(0, score - 1); ko++; vibrate([60, 30, 60]); sfx.play("bad"); }
          shell.setHint(`Punti: ${score}`);
          index++;
          show();
        });
        return btn;
      }));
    };

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => {
        done = true;
        shell.showDone(this.formatScore(score));
        ctx.onFinish(score, `${ok} giuste, ${ko} sbagliate`);
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
