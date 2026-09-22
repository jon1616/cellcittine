/*
  Lettere: una frase e una lettera. Quante volte compare? Rispondi col
  tastierino. 8 frasi in 40 secondi. Frasi uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, shuffle } from "./shell.js";

const DURATION = 40;
const ROUNDS = 8;
const SENTENCES = [
  "Il gatto dorme sul divano rosso", "La torta di mele profuma di cannella", "Domani andiamo al mare con la nonna",
  "Sette nani cantano sotto la luna", "Il treno parte alle otto in punto", "Una farfalla gialla vola sul prato",
  "Mario mangia la pizza con le mani", "La bicicletta blu corre in discesa", "Nel bosco vive un orso goloso di miele",
  "Il cane abbaia alla luna piena", "Le stelle brillano sopra la montagna", "Oggi piove e resto in casa a leggere",
  "La maestra spiega i pianeti del sistema solare", "Un pirata cerca il tesoro nascosto", "Il pallone rotola giù per la strada",
  "Mia sorella suona il pianoforte ogni sera", "Il robot balla al ritmo della musica", "La nave attraversa il mare in tempesta",
  "Tre coniglietti saltano tra le carote", "Il vulcano fuma sopra la valle verde", "Un drago dorato dorme sulle monete",
  "La zuppa di zucca è pronta in tavola", "Il vento porta via il cappello di paglia", "La tartaruga vince la gara con la lepre",
];
const LETTERS = "AEIOLNRST";

let shell = null;
let stopTimer = null;

export default {
  id: "lettere",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const order = shuffle(SENTENCES, rng);
    const rounds = [];
    for (let i = 0; i < ROUNDS; i++) {
      const s = order[i % order.length];
      // Lettera: in facile una vocale (più facile da vedere), in difficile anche lettere rare
      const pool = difficulty === "facile" ? "AEIO" : difficulty === "difficile" ? LETTERS + "CMPV" : LETTERS;
      let letter, count;
      let guard = 0;
      do {
        letter = pool[Math.floor(rng() * pool.length)];
        count = [...s.toUpperCase()].filter((ch) => ch === letter).length;
      } while ((count === 0 || count > 12) && guard++ < 20);
      rounds.push({ sentence: s, letter, count });
    }
    return { rounds };
  },

  formatScore(score) {
    return `${score} / ${ROUNDS}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore() {
    return ROUNDS;
  },

  mount(container, ctx) {
    const { rounds } = ctx.params;
    shell = createShell(container, { title: "Lettere", hint: "Quante volte compare la lettera?" });
    const letter = el("div", { class: "letters-letter" });
    const sentence = el("div", { class: "letters-sentence" });
    const keypad = el("div", { class: "keypad" });
    shell.body.append(letter, sentence, keypad);

    let index = 0, correct = 0;
    let done = false;
    let locked = false;

    const show = () => {
      const r = rounds[index];
      letter.textContent = r.letter;
      sentence.textContent = r.sentence;
      locked = false;
      keypad.replaceChildren(...Array.from({ length: 13 }, (_, i) => {
        const key = el("button", { class: "key", text: String(i) });
        key.addEventListener("pointerdown", (ev) => {
          ev.preventDefault();
          if (done || locked) return;
          locked = true;
          const ok = i === r.count;
          if (ok) { correct++; vibrate(10); sfx.play("good"); key.classList.add("ok"); }
          else { vibrate([60, 30, 60]); sfx.play("bad"); key.classList.add("ko"); [...keypad.children][r.count]?.classList.add("ok"); }
          // Evidenzia le lettere nella frase
          sentence.replaceChildren(...[...r.sentence].map((ch) => el("span", { class: ch.toUpperCase() === r.letter ? "letters-hit" : "", text: ch })));
          shell.setHint(`${correct} ${correct === 1 ? "giusta" : "giuste"} su ${index + 1}`);
          index++;
          setTimeout(() => { if (done) return; if (index >= ROUNDS) finish(); else show(); }, 900);
        });
        return key;
      }));
    };

    const finish = () => {
      if (done) return;
      done = true;
      stopTimer?.();
      shell.showDone(this.formatScore(correct));
      ctx.onFinish(correct, `${correct} frasi giuste su ${ROUNDS}`);
    };

    stopTimer = runTimer(DURATION, (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`), finish);
    show();
  },

  unmount() {
    stopTimer?.();
    shell?.remove();
    shell = null;
  },
};
