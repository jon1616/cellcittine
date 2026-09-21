/*
  Rime: una parola in alto; tra le quattro sotto, una sola fa rima. Toccala!
  +1 giusta, −1 sbagliata. 25 secondi. Parole uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, shuffle } from "./shell.js";

const DURATION = 25;
// Gruppi di parole che fanno rima tra loro
const GROUPS = [
  ["CANE", "PANE", "RANE", "LANE"], ["GATTO", "PIATTO", "MATTO", "RATTO"], ["SOLE", "VIOLE", "PAROLE", "SCUOLE"],
  ["LUNA", "CUNA", "FORTUNA", "LAGUNA"], ["MARE", "VOLARE", "CANTARE", "SALTARE"], ["FIORE", "CUORE", "COLORE", "AMORE"],
  ["CASA", "VASA", "RASA", "BASA"], ["PORTA", "TORTA", "CORTA", "SCORTA"], ["NAVE", "CHIAVE", "SOAVE", "GRAVE"],
  ["TRENO", "SERENO", "FRENO", "VELENO"], ["STELLA", "SELLA", "PADELLA", "GIRELLA"], ["NEVE", "BEVE", "LIEVE", "BREVE"],
  ["VENTO", "LENTO", "CENTO", "MOMENTO"], ["FUOCO", "GIOCO", "POCO", "CUOCO"], ["TERRA", "GUERRA", "SERRA", "FERRA"],
  ["PESCE", "CRESCE", "ESCE", "RIESCE"], ["MELA", "VELA", "CANDELA", "TELA"], ["PALLA", "FARFALLA", "SPALLA", "GIALLA"],
  ["TOPO", "DOPO", "SCOPO", "SIROPO"], ["ORSO", "MORSO", "CORSO", "DORSO"], ["CAPPELLO", "MARTELLO", "CASTELLO", "FRATELLO"],
  ["BAMBINO", "GIARDINO", "MATTINO", "VICINO"], ["FINESTRA", "MINESTRA", "DESTRA", "ORCHESTRA"], ["LIBRO", "EQUILIBRO", "CALIBRO", "VIBRO"],
  ["RAGAZZO", "PUPAZZO", "PALAZZO", "SCHIZZO"], ["MONTAGNA", "CAMPAGNA", "LASAGNA", "SPAGNA"], ["DENTE", "GENTE", "MENTE", "NIENTE"],
  ["FRAGOLA", "TAVOLA", "FAVOLA", "SCATOLA"], ["GELATO", "PRATO", "GRATO", "SALATO"], ["BOSCO", "CONOSCO", "FOSCO", "LOSCO"],
];

let shell = null;
let stopTimer = null;

export default {
  id: "rime",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const questions = [];
    const order = shuffle(GROUPS.map((_, i) => i), rng);
    for (let k = 0; k < 40; k++) {
      const gi = order[k % order.length];
      const group = shuffle(GROUPS[gi], rng);
      const word = group[0], rhyme = group[1];
      // distrattori: da altri gruppi; in difficile, parole con la stessa lettera finale (ingannano di più)
      const others = shuffle(GROUPS.filter((_, i) => i !== gi).flat(), rng);
      const tricky = difficulty === "difficile" ? others.filter((w) => w.slice(-1) === word.slice(-1)) : [];
      const distractors = [...new Set([...tricky, ...others])].slice(0, 3);
      questions.push({ word, answer: rhyme, options: shuffle([rhyme, ...distractors], rng) });
    }
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
    shell = createShell(container, { title: "Rime", hint: "Punti: 0" });
    const target = el("div", { class: "word-target" });
    const answers = el("div", { class: "quiz-answers" });
    shell.body.append(el("p", { class: "rime-label", text: "Fa rima con…" }), target, answers);

    let index = 0, score = 0, ok = 0, ko = 0;
    let done = false;

    const cap = (w) => w.charAt(0) + w.slice(1).toLowerCase();
    const show = () => {
      const q = questions[index % questions.length];
      target.textContent = cap(q.word);
      answers.replaceChildren(...q.options.map((opt) => {
        const btn = el("button", { class: "quiz-answer", text: cap(opt) });
        btn.addEventListener("pointerdown", (ev) => {
          ev.preventDefault();
          if (done) return;
          if (opt === q.answer) { score++; ok++; vibrate(10); sfx.play("good"); }
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
