/*
  Minigioco "Semaforo": lo schermo è rosso, poi diventa verde in un momento
  imprevedibile. Vince chi tocca prima dopo il verde. Toccare prima è una
  falsa partenza.

  Contratto di ogni minigioco (vedi registry.js):
    id, title, description, order ("asc" = punteggio basso vince)
    createParams(rng)      -> parametri decisi dall'host, uguali per tutte
    formatScore(score)     -> testo da mostrare in classifica
    mount(container, ctx)  -> avvia il gioco; ctx.onFinish(score) quando finisce
    unmount()
*/

import { el, vibrate } from "../utils.js";

const FALSE_START = 9999;

let timer = null;
let area = null;

export default {
  id: "semaforo",
  title: "Semaforo",
  description: "Tocca appena lo schermo diventa verde. Se tocchi prima, falsa partenza!",
  order: "asc",

  createParams(rng) {
    return { delayMs: 1500 + Math.floor(rng() * 3500) };
  },

  formatScore(score) {
    return score >= FALSE_START ? "Falsa partenza" : `${score} ms`;
  },

  mount(container, ctx) {
    let phase = "wait"; // wait -> go -> done
    let greenAt = 0;

    area = el("div", { class: "game-area" }, [
      el("div", { class: "big", text: "ASPETTA…" }),
      el("div", { class: "hint", text: "Tocca appena diventa verde" }),
    ]);
    area.style.background = "#c1121f";
    container.append(area);

    const label = area.firstChild;

    const finish = (score) => {
      if (phase === "done") return;
      phase = "done";
      clearTimeout(timer);
      area.style.background = "#3a0ca3";
      label.textContent = this.formatScore(score);
      area.lastChild.textContent = "Aspetta le altre…";
      ctx.onFinish(score);
    };

    area.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      if (phase === "wait") {
        vibrate([80, 40, 80]);
        finish(FALSE_START);
      } else if (phase === "go") {
        vibrate(30);
        finish(Math.max(1, Math.round(performance.now() - greenAt)));
      }
    });

    timer = setTimeout(() => {
      if (phase !== "wait") return;
      phase = "go";
      greenAt = performance.now();
      area.style.background = "#2dc653";
      label.textContent = "TOCCA!";
    }, ctx.params.delayMs);
  },

  unmount() {
    clearTimeout(timer);
    area?.remove();
    area = null;
  },
};
