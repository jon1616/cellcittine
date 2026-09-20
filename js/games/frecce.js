/*
  Frecce: appare una freccia. Scorri il dito nella direzione della freccia.
  Se la freccia è ROSSA, scorri nella direzione OPPOSTA. 20 secondi, +1 / -1.
*/

import { el, vibrate } from "../utils.js";
import { createShell, runTimer } from "./shell.js";

const DURATION = 20;
const DIRS = ["su", "destra", "giu", "sinistra"]; // in senso orario
const ANGLE = { su: 0, destra: 90, giu: 180, sinistra: 270 };
const RED_RATE = { facile: 0, normale: 0.3, difficile: 0.5 };
const MIN_SWIPE = 28;

let shell = null;
let stopTimer = null;

export default {
  id: "frecce",
  title: "Frecce",
  icon: "🧭",
  description: "Scorri il dito dove indica la freccia. Se è rossa, vai dalla parte opposta! 20 secondi.",
  order: "desc",
  maxSeconds: DURATION + 2,

  createParams(rng, difficulty) {
    const redRate = RED_RATE[difficulty] ?? RED_RATE.normale;
    const items = Array.from({ length: 80 }, () => ({
      dir: Math.floor(rng() * 4),
      red: rng() < redRate,
    }));
    return { items };
  },

  formatScore(score) {
    return `${score} ${score === 1 ? "punto" : "punti"}`;
  },

  isValidScore(score) {
    return score > 0;
  },

  mount(container, ctx) {
    const { items } = ctx.params;
    shell = createShell(container, { title: "Frecce", hint: "Punti: 0" });

    const arrow = el("div", { class: "arrow" });
    const pad = el("div", { class: "swipe-pad" }, [arrow, el("div", { class: "swipe-help", text: "scorri qui" })]);
    shell.body.append(pad);

    let index = 0;
    let score = 0;
    let done = false;
    let start = null;

    const show = () => {
      const it = items[index % items.length];
      arrow.style.transform = `rotate(${ANGLE[DIRS[it.dir]]}deg)`;
      arrow.classList.toggle("red", it.red);
    };

    const answer = (swipeDir) => {
      const it = items[index % items.length];
      const expected = it.red ? (it.dir + 2) % 4 : it.dir;
      if (swipeDir === expected) {
        score++;
        vibrate(10);
        pad.classList.add("ok");
        setTimeout(() => pad.classList.remove("ok"), 150);
      } else {
        score = Math.max(0, score - 1);
        vibrate([60, 30, 60]);
        pad.classList.add("ko");
        setTimeout(() => pad.classList.remove("ko"), 200);
      }
      shell.setHint(`Punti: ${score}`);
      index++;
      show();
    };

    pad.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      start = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
      pad.setPointerCapture?.(ev.pointerId);
    });
    const end = (ev) => {
      if (!start || done || ev.pointerId !== start.id) return;
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      start = null;
      if (Math.hypot(dx, dy) < MIN_SWIPE) return;
      let dir;
      if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 1 : 3;
      else dir = dy > 0 ? 2 : 0;
      answer(dir);
    };
    pad.addEventListener("pointerup", end);
    pad.addEventListener("pointercancel", () => { start = null; });

    stopTimer = runTimer(
      DURATION,
      (remaining) => shell.setTimer(`${Math.ceil(remaining)} s`),
      () => {
        done = true;
        shell.showDone(this.formatScore(score));
        ctx.onFinish(score);
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
