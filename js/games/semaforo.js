/*
  Semaforo: lo schermo è rosso, poi diventa verde in un momento imprevedibile.
  Vince chi tocca prima dopo il verde. Toccare prima è una falsa partenza.

  Contratto di ogni minigioco (la scheda descrittiva sta in catalog.js):
    id                            uguale alla voce nel catalogo
    order                         "asc" = punteggio basso vince, "desc" = alto vince
    maxSeconds                    durata massima, per la scadenza di sicurezza
    createParams(rng, difficulty) -> parametri decisi dall'host, uguali per tutti
    formatScore(score)            -> testo per la classifica
    isValidScore(score)           -> false se il risultato non conta per i record
    maxScore(params)              -> (facoltativo) massimo ottenibile, se ha senso
    mount(container, ctx)         -> ctx.params, ctx.difficulty, ctx.onFinish(score, detail)
                                     detail = frase breve sulla prestazione ("12 giuste, 2 sbagliate")
    unmount()

  Suoni: ogni minigioco usa sfx (audio.js) per gli esiti — sfx.play("good"),
  "bad", "hit", "flip", "jump", "pop"… — mai suoni propri. I tic degli ultimi
  secondi, il conto alla rovescia, fine manche, record e podio li fa il telaio.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";

const FALSE_START = 9999;
const DELAYS = { facile: [1500, 4000], normale: [1000, 5000], difficile: [800, 6000] };

let timer = null;
let area = null;

export default {
  id: "semaforo",
  order: "asc",
  maxSeconds: 10,

  createParams(rng, difficulty) {
    const [min, max] = DELAYS[difficulty] || DELAYS.normale;
    return { delayMs: min + Math.floor(rng() * (max - min)) };
  },

  formatScore(score) {
    return score >= FALSE_START ? "Falsa partenza" : `${score} ms`;
  },

  isValidScore(score) {
    return score < FALSE_START;
  },

  mount(container, ctx) {
    let phase = "wait"; // wait -> go -> done
    let greenAt = 0;

    const label = el("div", { class: "big", text: "ASPETTA…" });
    const hint = el("div", { class: "hint", text: "Tocca appena diventa verde" });
    area = el("div", { class: "game-area" }, [label, hint]);
    area.style.background = "#c1121f";
    container.append(area);

    const finish = (score) => {
      if (phase === "done") return;
      phase = "done";
      clearTimeout(timer);
      area.style.background = "#3a0ca3";
      label.textContent = this.formatScore(score);
      hint.textContent = "In attesa degli altri…";
      const rating = score >= FALSE_START ? "Troppo presto!" : score < 200 ? "Fulmine!" : score < 280 ? "Velocissimo" : score < 380 ? "Buono" : score < 500 ? "Nella media" : "Un po' lento";
      ctx.onFinish(score, rating);
    };

    area.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      if (phase === "wait") {
        vibrate([80, 40, 80]);
        sfx.play("bad");
        finish(FALSE_START);
      } else if (phase === "go") {
        vibrate(30);
        sfx.play("good");
        finish(Math.max(1, Math.round(performance.now() - greenAt)));
      }
    });

    timer = setTimeout(() => {
      if (phase !== "wait") return;
      phase = "go";
      greenAt = performance.now();
      area.style.background = "#2dc653";
      label.textContent = "TOCCA!";
      sfx.play("go");
    }, ctx.params.delayMs);
  },

  unmount() {
    clearTimeout(timer);
    area?.remove();
    area = null;
  },
};
