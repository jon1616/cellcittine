/*
  Quanti: sullo schermo tante forme colorate. Quanti sono i triangoli? (o i
  cerchi, o i quadrati). Rispondi col tastierino. Sei giri, 40 secondi.
  Forme e domande uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, runTimer, shuffle } from "./shell.js";

const DURATION = 40;
const ROUNDS = 6;
const KINDS = [["circle", "cerchi"], ["square", "quadrati"], ["triangle", "triangoli"]];
const COLORS = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#f15bb5", "#36cfc9"];
const SETTINGS = {
  facile: { total: 10, max: 5 },
  normale: { total: 16, max: 7 },
  difficile: { total: 24, max: 9 },
};

let shell = null;
let stopTimer = null;
let timer = null;

export default {
  id: "quanti",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const s = SETTINGS[difficulty] || SETTINGS.normale;
    const rounds = [];
    for (let r = 0; r < ROUNDS; r++) {
      const kind = Math.floor(rng() * 3);
      const answer = 2 + Math.floor(rng() * (s.max - 1));
      const shapes = [];
      for (let i = 0; i < s.total; i++) {
        const k = i < answer ? kind : (kind + 1 + Math.floor(rng() * 2)) % 3;
        shapes.push({ kind: k, color: COLORS[Math.floor(rng() * COLORS.length)], x: 4 + rng() * 84, y: 4 + rng() * 84, size: 30 + Math.floor(rng() * 16), rot: Math.floor(rng() * 60) });
      }
      rounds.push({ kind, answer, shapes: shuffle(shapes, rng) });
    }
    return { rounds };
  },

  formatScore(score) {
    return `${score} su ${ROUNDS}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore() {
    return ROUNDS;
  },

  mount(container, ctx) {
    const { rounds } = ctx.params;
    shell = createShell(container, { title: "Quanti", hint: "" });
    const question = el("div", { class: "qn-question" });
    const field = el("div", { class: "qn-field" });
    const pad = el("div", { class: "keypad" });
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"].map((k) => el("button", { class: "key", text: k }));
    pad.append(...keys);
    shell.body.append(question, field, pad);

    let index = 0, score = 0;
    let done = false;

    const show = () => {
      if (done) return;
      if (index >= ROUNDS) { finish(); return; }
      const r = rounds[index];
      question.textContent = `Quanti ${KINDS[r.kind][1]}?`;
      shell.setHint(`Giro ${index + 1} di ${ROUNDS}`);
      field.replaceChildren(...r.shapes.map((sh) => {
        const n = el("div", { class: `qn-shape shape-${KINDS[sh.kind][0]}` });
        n.style.cssText = `left:${sh.x}%;top:${sh.y}%;width:${sh.size}px;height:${sh.size}px;--shape-color:${sh.color};transform:rotate(${sh.rot}deg)`;
        return n;
      }));
      keys.forEach((k) => { k.className = "key"; });
    };

    keys.forEach((k) => {
      k.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        if (done || index >= ROUNDS) return;
        const r = rounds[index];
        const v = Number(k.textContent);
        if (v === r.answer) { score++; vibrate(15); sfx.play("good"); k.classList.add("ok"); }
        else { vibrate([60, 30, 60]); sfx.play("bad"); k.classList.add("ko"); keys.find((x) => Number(x.textContent) === r.answer)?.classList.add("ok"); }
        field.querySelectorAll(`.shape-${KINDS[r.kind][0]}`).forEach((n) => n.classList.add("mark"));
        index++;
        timer = setTimeout(show, 700);
      });
    });

    const finish = () => {
      if (done) return;
      done = true;
      stopTimer?.();
      clearTimeout(timer);
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, `${score} ${score === 1 ? "conteggio giusto" : "conteggi giusti"} su ${ROUNDS}`);
    };

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => finish()
    );
    show();
  },

  unmount() {
    stopTimer?.();
    clearTimeout(timer);
    shell?.remove();
    shell = null;
  },
};
