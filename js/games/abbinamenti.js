/*
  Abbinamenti: quattro oggetti, ognuno su un colore, restano a schermo per
  qualche secondo. Poi: "di che colore era la mela?". Tre giri, tre domande
  a giro; 5 secondi per rispondere. Abbinamenti uguali per tutti.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, shuffle } from "./shell.js";

const ROUNDS = 3;
const ASK = 3;
const SHOW_MS = { facile: 5000, normale: 4000, difficile: 3000 };
const ANSWER_MS = 5000;
const ITEMS = ["🍎", "🚗", "🎈", "⭐", "🐟", "🌂", "🎩", "🧸", "🔑", "🎸", "🍦", "🚲", "🦋", "🎁", "📚", "🧦"];
const COLORS = [
  { id: "rosso", label: "Rosso", hex: "#ff4d6d" }, { id: "blu", label: "Blu", hex: "#1982c4" }, { id: "verde", label: "Verde", hex: "#43d17a" },
  { id: "giallo", label: "Giallo", hex: "#ffca3a" }, { id: "viola", label: "Viola", hex: "#c77dff" }, { id: "arancione", label: "Arancione", hex: "#ff924c" },
];

let shell = null;
let timers = [];

export default {
  id: "abbinamenti",
  order: "desc",
  maxSeconds: ROUNDS * (5 + ASK * 6) + 5,

  createParams(rng, difficulty) {
    const rounds = [];
    const items = shuffle(ITEMS, rng);
    for (let r = 0; r < ROUNDS; r++) {
      const colors = shuffle(COLORS.map((c) => c.id), rng).slice(0, 4);
      const pairs = items.slice(r * 4, r * 4 + 4).map((item, i) => ({ item, color: colors[i] }));
      const asks = shuffle(pairs, rng).slice(0, ASK).map((p) => ({ item: p.item, answer: p.color, options: shuffle(colors, rng) }));
      rounds.push({ pairs, asks });
    }
    return { rounds, showMs: SHOW_MS[difficulty] || SHOW_MS.normale };
  },

  formatScore(score) {
    return `${score} / ${ROUNDS * ASK}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  maxScore() {
    return ROUNDS * ASK;
  },

  mount(container, ctx) {
    const { rounds, showMs } = ctx.params;
    shell = createShell(container, { title: "Abbinamenti", hint: "Ricorda il colore di ogni oggetto" });
    const stage = el("div", { class: "pair-stage" });
    shell.body.append(stage);
    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const colorOf = (id) => COLORS.find((c) => c.id === id);

    let round = 0, ask = 0, correct = 0;
    let done = false;
    let answerTimer = null;

    const showPairs = () => {
      const r = rounds[round];
      shell.setHint("Ricorda il colore di ogni oggetto");
      shell.setTimer(`${round + 1} / ${ROUNDS}`);
      stage.replaceChildren(el("div", { class: "pair-grid" }, r.pairs.map((p) => el("div", { class: "pair-card", style: `--c: ${colorOf(p.color).hex}`, text: p.item }))));
      later(() => { ask = 0; askNext(); }, showMs);
    };

    const askNext = () => {
      if (done) return;
      const r = rounds[round];
      if (ask >= r.asks.length) {
        round++;
        if (round >= rounds.length) { finish(); return; }
        showPairs();
        return;
      }
      const q = r.asks[ask];
      shell.setHint("Di che colore era?");
      let locked = false;
      const answer = (choice, btn) => {
        if (locked || done) return;
        locked = true;
        clearTimeout(answerTimer);
        const ok = choice === q.answer;
        if (ok) { correct++; vibrate(10); sfx.play("good"); btn?.classList.add("ok"); }
        else { vibrate([60, 30, 60]); sfx.play("bad"); btn?.classList.add("ko"); }
        [...stage.querySelectorAll(".pair-answer")].forEach((b) => { if (b.dataset.id === q.answer) b.classList.add("ok"); });
        shell.setHint(ok ? "Giusto!" : choice === null ? `Tempo scaduto: era ${colorOf(q.answer).label.toLowerCase()}` : `Era ${colorOf(q.answer).label.toLowerCase()}`);
        ask++;
        later(askNext, 800);
      };
      stage.replaceChildren(
        el("div", { class: "pair-question", text: q.item }),
        el("div", { class: "pair-answers" }, q.options.map((id) => {
          const c = colorOf(id);
          const b = el("button", { class: "pair-answer", text: c.label, style: `--c: ${c.hex}` });
          b.dataset.id = id;
          b.addEventListener("pointerdown", (ev) => { ev.preventDefault(); answer(id, b); });
          return b;
        }))
      );
      answerTimer = later(() => answer(null, null), ANSWER_MS);
    };

    const finish = () => {
      if (done) return;
      done = true;
      shell.showDone(this.formatScore(correct));
      ctx.onFinish(correct, `${correct} ${correct === 1 ? "colore giusto" : "colori giusti"} su ${ROUNDS * ASK}`);
    };

    showPairs();
  },

  unmount() {
    timers.forEach(clearTimeout);
    timers = [];
    shell?.remove();
    shell = null;
  },
};
