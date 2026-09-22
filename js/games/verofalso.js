/*
  Vero o falso: una frase alla volta, tocca VERO o FALSO il più in fretta
  possibile. +1 giusta, −1 sbagliata, 25 secondi. Frasi uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, shuffle } from "./shell.js";

const DURATION = 25;
const FACTS = [
  ["Il gatto è un animale", true], ["Roma è in Francia", false], ["3 + 4 fa 8", false], ["La settimana ha 7 giorni", true],
  ["Il sole sorge a ovest", false], ["Un triangolo ha tre lati", true], ["L'acqua bolle a 100 gradi", true], ["I pesci respirano fuori dall'acqua", false],
  ["Febbraio è il mese più corto", true], ["10 × 10 fa 1000", false], ["La luna è un pianeta", false], ["Il ghiaccio è acqua congelata", true],
  ["Un anno ha 12 mesi", true], ["Le mele crescono sugli alberi", true], ["I pinguini volano", false], ["Parigi è la capitale della Francia", true],
  ["5 × 6 fa 30", true], ["Il cane miagola", false], ["La Terra gira intorno al Sole", true], ["Un'ora ha 100 minuti", false],
  ["Il pane si fa con la farina", true], ["I ragni hanno sei zampe", false], ["100 − 45 fa 55", true], ["Il rosso e il blu fanno il verde", false],
  ["Il Nilo è un fiume", true], ["Il vetro è trasparente", true], ["I cavalli hanno le piume", false], ["9 × 9 fa 81", true],
  ["L'Italia è una penisola", true], ["Un metro ha 10 centimetri", false], ["Le tartarughe sono veloci", false], ["Il latte viene dalle mucche", true],
  ["7 + 8 fa 15", true], ["Il fuoco è freddo", false], ["I delfini sono mammiferi", true], ["Un cerchio ha quattro angoli", false],
  ["Il miele lo fanno le api", true], ["12 : 4 fa 3", true], ["La neve è calda", false], ["Le farfalle nascono dai bruchi", true],
  ["Un giorno ha 24 ore", true], ["Il sale è dolce", false], ["Venezia ha i canali", true], ["2 × 2 fa 5", false],
  ["Gli elefanti sono piccoli", false], ["La chitarra è uno strumento", true], ["50 + 50 fa 100", true], ["I gufi dormono di notte", false],
  ["Il limone è aspro", true], ["Le rane saltano", true], ["Un secolo ha 10 anni", false], ["Le zebre hanno le strisce", true],
  ["Il cioccolato è una verdura", false], ["Il Vesuvio è un vulcano", true], ["6 × 7 fa 42", true], ["Il mare è di acqua dolce", false],
  ["Le ossa sono dentro il corpo", true], ["Il topo è più grande del gatto", false], ["Un quadrato ha lati uguali", true], ["15 − 9 fa 5", false],
];

let shell = null;
let stopTimer = null;

export default {
  id: "verofalso",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng) {
    return { order: shuffle(FACTS.map((_, i) => i), rng) };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "punto" : "punti"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const { order } = ctx.params;
    shell = createShell(container, { title: "Vero o falso", hint: "Punti: 0" });
    const sentence = el("div", { class: "vf-sentence" });
    const yes = el("button", { class: "vf-btn yes", text: "VERO" });
    const no = el("button", { class: "vf-btn no", text: "FALSO" });
    shell.body.append(sentence, el("div", { class: "vf-row" }, [no, yes]));

    let index = 0, score = 0, ok = 0, ko = 0, done = false;
    const show = () => { sentence.textContent = FACTS[order[index % order.length]][0]; };
    const answer = (v, btn) => {
      if (done) return;
      const truth = FACTS[order[index % order.length]][1];
      if (v === truth) { score++; ok++; vibrate(10); sfx.play("good"); btn.classList.add("ok"); }
      else { score = Math.max(0, score - 1); ko++; vibrate([60, 30, 60]); sfx.play("bad"); btn.classList.add("ko"); }
      setTimeout(() => btn.classList.remove("ok", "ko"), 200);
      shell.setHint(`Punti: ${score}`);
      index++;
      show();
    };
    yes.addEventListener("pointerdown", (ev) => { ev.preventDefault(); answer(true, yes); });
    no.addEventListener("pointerdown", (ev) => { ev.preventDefault(); answer(false, no); });

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
