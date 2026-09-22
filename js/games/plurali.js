/*
  Plurali: una parola al singolare; tra le quattro sotto, il plurale giusto.
  +1 giusta, −1 sbagliata, 25 secondi. Parole uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, shuffle } from "./shell.js";

const DURATION = 25;
// [singolare, plurale giusto, plurali sbagliati]
const WORDS = [
  ["cane", "cani", ["cane", "canie", "cana"]], ["uovo", "uova", ["uovi", "uove", "uovo"]], ["braccio", "braccia", ["bracci", "braccie", "braccio"]],
  ["dito", "dita", ["diti", "dite", "dito"]], ["camicia", "camicie", ["camice", "camicia", "camici"]], ["città", "città", ["citte", "cittài", "cittá"]],
  ["amico", "amici", ["amichi", "amice", "amico"]], ["amica", "amiche", ["amici", "amice", "amicha"]], ["orologio", "orologi", ["orologii", "orologie", "orologio"]],
  ["farmacia", "farmacie", ["farmace", "farmaci", "farmacia"]], ["bosco", "boschi", ["bosci", "bosco", "bosche"]], ["uomo", "uomini", ["uomi", "uome", "uomo"]],
  ["ginocchio", "ginocchia", ["ginocchi", "ginocchie", "ginocchio"]], ["labbro", "labbra", ["labbri", "labbre", "labbro"]], ["re", "re", ["ri", "ree", "rei"]],
  ["caffè", "caffè", ["caffi", "caffé", "caffe"]], ["valigia", "valigie", ["valige", "valigi", "valigia"]], ["ciliegia", "ciliegie", ["cilieggie", "ciliegi", "ciliegia"]],
  ["spiaggia", "spiagge", ["spiaggie", "spiaggi", "spiaggia"]], ["problema", "problemi", ["probleme", "problema", "problemas"]], ["mano", "mani", ["mane", "mano", "manie"]],
  ["ala", "ali", ["ale", "ala", "alle"]], ["bue", "buoi", ["bui", "bue", "buei"]], ["dio", "dei", ["dii", "dio", "die"]],
  ["asparago", "asparagi", ["asparaghi", "asparage", "asparago"]], ["chirurgo", "chirurghi", ["chirurgi", "chirurgo", "chirurge"]], ["belga", "belgi", ["belghi", "belga", "belge"]],
  ["tempio", "templi", ["tempi", "tempii", "tempio"]], ["migliaio", "migliaia", ["migliai", "migliaie", "migliaio"]], ["paio", "paia", ["pai", "paie", "paio"]],
  ["moglie", "mogli", ["moglie", "moglii", "mogle"]], ["superficie", "superfici", ["superficie", "superficii", "superficia"]], ["specie", "specie", ["speci", "specii", "specia"]],
  ["orecchio", "orecchie", ["orecchi", "orecchio", "orecchia"]], ["lenzuolo", "lenzuola", ["lenzuoli", "lenzuole", "lenzuolo"]], ["gioco", "giochi", ["gioci", "gioco", "gioche"]],
  ["strega", "streghe", ["strege", "streghi", "strega"]], ["greco", "greci", ["grechi", "greco", "grece"]], ["sindaco", "sindaci", ["sindachi", "sindaco", "sindace"]],
  ["fiume", "fiumi", ["fiume", "fiumie", "fiuma"]],
];

let shell = null;
let stopTimer = null;

export default {
  id: "plurali",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng) {
    const order = shuffle(WORDS.map((_, i) => i), rng);
    const questions = [];
    for (let k = 0; k < 40; k++) {
      const [word, answer, wrong] = WORDS[order[k % order.length]];
      const options = [...new Set([answer, ...wrong])].slice(0, 4);
      questions.push({ word, answer, options: shuffle(options, rng) });
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
    shell = createShell(container, { title: "Plurali", hint: "Punti: 0" });
    const target = el("div", { class: "word-target plur-target" });
    const answers = el("div", { class: "quiz-answers" });
    shell.body.append(el("p", { class: "rime-label", text: "Il plurale di…" }), target, answers);

    let index = 0, score = 0, ok = 0, ko = 0;
    let done = false;

    const show = () => {
      const q = questions[index % questions.length];
      target.textContent = q.word;
      answers.replaceChildren(...q.options.map((opt) => {
        const btn = el("button", { class: "quiz-answer", text: opt });
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

    stopTimer = runTimer(DURATION, (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`), () => {
      done = true;
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, `${ok} giuste, ${ko} sbagliate`);
    });
    show();
  },

  unmount() {
    stopTimer?.();
    shell?.remove();
    shell = null;
  },
};
