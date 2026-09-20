/*
  Anagrammi: le lettere di una parola sono in disordine. Toccale nell'ordine
  giusto per ricomporla. 30 secondi, più parole possibili. Le parole sono le
  stesse per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, shuffle } from "./shell.js";

const DURATION = 30;

const WORDS = {
  facile: [
    "CASA", "GATTO", "CANE", "SOLE", "LUNA", "MARE", "PANE", "LATTE", "FIORE", "ALBERO",
    "LIBRO", "PORTA", "SEDIA", "PALLA", "TORTA", "MELA", "PERA", "UOVO", "NEVE", "VENTO",
    "TRENO", "NAVE", "AEREO", "SCUOLA", "ZAINO", "PENNA", "MATITA", "ACQUA", "FUOCO", "TERRA",
    "STELLA", "NUVOLA", "PIOGGIA", "FOGLIA", "RAMO", "PESCE", "RANA", "TOPO", "ORSO", "LEONE",
    "TIGRE", "ZEBRA", "MUCCA", "PECORA", "GALLO", "ANATRA", "CUORE", "MANO", "PIEDE", "NASO",
  ],
  normale: [
    "GIARDINO", "FINESTRA", "CUCINA", "BAGNO", "CAMERA", "TAVOLO", "LAMPADA", "SPECCHIO", "TAPPETO", "CUSCINO",
    "MONTAGNA", "FIUME", "LAGO", "ISOLA", "SPIAGGIA", "SABBIA", "ONDA", "CONCHIGLIA", "DELFINO", "BALENA",
    "FARFALLA", "FORMICA", "GRILLO", "LUCCIOLA", "CORVO", "GUFO", "AQUILA", "FALCO", "CIGNO", "PAVONE",
    "BICICLETTA", "MOTORE", "STRADA", "PONTE", "TORRE", "CASTELLO", "PRINCIPE", "DRAGO", "MAGIA", "TESORO",
    "PIRATA", "MAPPA", "BUSSOLA", "CANNONE", "VELA", "ANCORA", "REMO", "PORTO", "FARO", "ONDA",
    "CIOCCOLATA", "GELATO", "BISCOTTO", "CARAMELLA", "ZUCCHERO", "LIMONE", "FRAGOLA", "CILIEGIA", "ANGURIA", "BANANA",
    "CHITARRA", "PIANO", "TROMBA", "FLAUTO", "TAMBURO", "CANZONE", "MUSICA", "BALLO", "TEATRO", "CINEMA",
  ],
  difficile: [
    "ELEFANTE", "GIRAFFA", "COCCODRILLO", "PINGUINO", "CANGURO", "SCOIATTOLO", "RICCIO", "TARTARUGA", "CAMALEONTE", "POLIPO",
    "ARCOBALENO", "TEMPORALE", "TRAMONTO", "ALBA", "GHIACCIO", "VULCANO", "DESERTO", "FORESTA", "PIANETA", "COMETA",
    "ASTRONAUTA", "RAZZO", "SATELLITE", "GALASSIA", "UNIVERSO", "TELESCOPIO", "MICROSCOPIO", "LABORATORIO", "ESPERIMENTO", "FORMULA",
    "AVVENTURA", "MISTERO", "SEGRETO", "INDIZIO", "ENIGMA", "LABIRINTO", "SFIDA", "VITTORIA", "CAMPIONE", "MEDAGLIA",
    "OROLOGIO", "CALENDARIO", "STAGIONE", "AUTUNNO", "INVERNO", "PRIMAVERA", "ESTATE", "VACANZA", "VIAGGIO", "VALIGIA",
  ],
};

let shell = null;
let stopTimer = null;
let resetTimer = null;

function scramble(word, rng) {
  const letters = word.split("");
  for (let tries = 0; tries < 10; tries++) {
    const s = shuffle(letters, rng);
    if (s.join("") !== word) return s;
  }
  return letters.reverse();
}

export default {
  id: "anagrammi",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const maxLen = difficulty === "facile" ? 6 : difficulty === "normale" ? 8 : 99;
    const pool = [...new Set(WORDS[difficulty] || WORDS.normale)].filter((w) => w.length <= maxLen);
    const words = shuffle(pool, rng).slice(0, 25).map((w) => ({ word: w, letters: scramble(w, rng) }));
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
    shell = createShell(container, { title: "Anagrammi", hint: "Tocca le lettere nell'ordine giusto" });
    const answer = el("div", { class: "ana-answer" });
    const tiles = el("div", { class: "ana-tiles" });
    const skip = el("button", { class: "secondary small-btn", text: "Salta parola" });
    shell.body.append(answer, tiles, skip);

    let index = 0;
    let solved = 0;
    let errors = 0;
    let picked = []; // indici delle tessere scelte
    let locked = false;
    let done = false;

    const showWord = () => {
      const w = words[index % words.length];
      picked = [];
      locked = false;
      answer.replaceChildren(...w.word.split("").map(() => el("span", { class: "ana-slot" })));
      tiles.replaceChildren(
        ...w.letters.map((ch, i) => {
          const t = el("button", { class: "ana-tile", text: ch });
          t.addEventListener("pointerdown", (ev) => {
            ev.preventDefault();
            if (locked || done || t.classList.contains("used")) return;
            t.classList.add("used");
            picked.push(i);
            answer.children[picked.length - 1].textContent = ch;
            sfx.play("flip");
            if (picked.length === w.word.length) check(w);
          });
          return t;
        })
      );
    };

    const check = (w) => {
      locked = true;
      const attempt = picked.map((i) => w.letters[i]).join("");
      if (attempt === w.word) {
        solved++;
        answer.classList.add("ok");
        sfx.play("good");
        vibrate(12);
        shell.setHint(`Parole: ${solved}`);
        index++;
        resetTimer = setTimeout(() => { answer.classList.remove("ok"); showWord(); }, 500);
      } else {
        errors++;
        answer.classList.add("ko");
        sfx.play("bad");
        vibrate([60, 30, 60]);
        resetTimer = setTimeout(() => {
          answer.classList.remove("ko");
          picked = [];
          [...answer.children].forEach((s) => (s.textContent = ""));
          [...tiles.children].forEach((t) => t.classList.remove("used"));
          locked = false;
        }, 550);
      }
    };

    skip.addEventListener("click", () => {
      if (done) return;
      index++;
      sfx.play("blip");
      showWord();
    });

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => {
        done = true;
        shell.showDone(this.formatScore(solved));
        ctx.onFinish(solved, `${errors} ${errors === 1 ? "tentativo sbagliato" : "tentativi sbagliati"}`);
      }
    );
    showWord();
  },

  unmount() {
    stopTimer?.();
    clearTimeout(resetTimer);
    shell?.remove();
    shell = null;
  },
};
