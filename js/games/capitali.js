/*
  Capitali: "Qual è la capitale di…?" con quattro risposte. 25 secondi di
  domande a raffica: +1 giusta, −1 sbagliata. Le domande sono uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, shuffle } from "./shell.js";

const DURATION = 25;
const QUESTIONS = 40;

// [paese, capitale, bandiera, livello] — livello 1 = famosissime, 2 = note, 3 = difficili
const DATA = [
  ["Italia", "Roma", "🇮🇹", 1], ["Francia", "Parigi", "🇫🇷", 1], ["Spagna", "Madrid", "🇪🇸", 1], ["Germania", "Berlino", "🇩🇪", 1],
  ["Regno Unito", "Londra", "🇬🇧", 1], ["Portogallo", "Lisbona", "🇵🇹", 1], ["Grecia", "Atene", "🇬🇷", 1], ["Stati Uniti", "Washington", "🇺🇸", 1],
  ["Giappone", "Tokyo", "🇯🇵", 1], ["Cina", "Pechino", "🇨🇳", 1], ["Russia", "Mosca", "🇷🇺", 1], ["Egitto", "Il Cairo", "🇪🇬", 1],
  ["Austria", "Vienna", "🇦🇹", 2], ["Belgio", "Bruxelles", "🇧🇪", 2], ["Paesi Bassi", "Amsterdam", "🇳🇱", 2], ["Svizzera", "Berna", "🇨🇭", 2],
  ["Irlanda", "Dublino", "🇮🇪", 2], ["Svezia", "Stoccolma", "🇸🇪", 2], ["Norvegia", "Oslo", "🇳🇴", 2], ["Danimarca", "Copenaghen", "🇩🇰", 2],
  ["Polonia", "Varsavia", "🇵🇱", 2], ["Turchia", "Ankara", "🇹🇷", 2], ["Brasile", "Brasilia", "🇧🇷", 2], ["Argentina", "Buenos Aires", "🇦🇷", 2],
  ["Canada", "Ottawa", "🇨🇦", 2], ["Messico", "Città del Messico", "🇲🇽", 2], ["Australia", "Canberra", "🇦🇺", 2], ["India", "Nuova Delhi", "🇮🇳", 2],
  ["Marocco", "Rabat", "🇲🇦", 2], ["Ungheria", "Budapest", "🇭🇺", 2], ["Repubblica Ceca", "Praga", "🇨🇿", 2], ["Croazia", "Zagabria", "🇭🇷", 2],
  ["Finlandia", "Helsinki", "🇫🇮", 3], ["Romania", "Bucarest", "🇷🇴", 3], ["Bulgaria", "Sofia", "🇧🇬", 3], ["Serbia", "Belgrado", "🇷🇸", 3],
  ["Ucraina", "Kiev", "🇺🇦", 3], ["Islanda", "Reykjavik", "🇮🇸", 3], ["Slovenia", "Lubiana", "🇸🇮", 3], ["Albania", "Tirana", "🇦🇱", 3],
  ["Corea del Sud", "Seul", "🇰🇷", 3], ["Thailandia", "Bangkok", "🇹🇭", 3], ["Vietnam", "Hanoi", "🇻🇳", 3], ["Perù", "Lima", "🇵🇪", 3],
  ["Cile", "Santiago", "🇨🇱", 3], ["Colombia", "Bogotà", "🇨🇴", 3], ["Kenya", "Nairobi", "🇰🇪", 3], ["Nigeria", "Abuja", "🇳🇬", 3],
  ["Nuova Zelanda", "Wellington", "🇳🇿", 3], ["Cuba", "L'Avana", "🇨🇺", 3], ["Iran", "Teheran", "🇮🇷", 3], ["Etiopia", "Addis Abeba", "🇪🇹", 3],
];
const LEVEL = { facile: 1, normale: 2, difficile: 3 };

let shell = null;
let stopTimer = null;

export default {
  id: "capitali",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const maxLevel = LEVEL[difficulty] || 2;
    const pool = DATA.filter((d) => d[3] <= maxLevel);
    const questions = [];
    let deck = [];
    for (let i = 0; i < QUESTIONS; i++) {
      if (deck.length === 0) deck = shuffle(pool, rng);
      const q = deck.pop();
      const others = shuffle(pool.filter((d) => d[1] !== q[1]), rng).slice(0, 3).map((d) => d[1]);
      questions.push({ country: q[0], flag: q[2], answer: q[1], options: shuffle([q[1], ...others], rng) });
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
    shell = createShell(container, { title: "Capitali", hint: "Punti: 0" });
    const flag = el("div", { class: "quiz-flag" });
    const question = el("div", { class: "quiz-question" });
    const answers = el("div", { class: "quiz-answers" });
    shell.body.append(flag, question, answers);

    let index = 0, score = 0, right = 0, wrong = 0;
    let done = false;

    const show = () => {
      const q = questions[index % questions.length];
      flag.textContent = q.flag;
      question.textContent = `Capitale di ${q.country}?`;
      question.classList.remove("flash-wrong");
      answers.replaceChildren(...q.options.map((opt) => {
        const btn = el("button", { class: "quiz-answer", text: opt });
        btn.addEventListener("pointerdown", (ev) => {
          ev.preventDefault();
          if (done) return;
          if (opt === q.answer) { score++; right++; vibrate(10); sfx.play("good"); }
          else {
            score = Math.max(0, score - 1); wrong++;
            vibrate([60, 30, 60]); sfx.play("bad");
            question.classList.add("flash-wrong");
          }
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
