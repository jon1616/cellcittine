/*
  Bussolotti: la pallina finisce sotto un bicchiere, i bicchieri si mescolano.
  Segui quello giusto con gli occhi e toccalo. Sei giri, sempre più veloci.
  Scambi uguali per tutti: non è fortuna, è attenzione.
*/

import { el, vibrate } from "../utils.js";
import { sfx } from "../audio.js";
import { createShell, fitCanvas, canvasPoint } from "./shell.js";

const ROUNDS = 6;
const W = 360, H = 300;
const SETTINGS = {
  facile: { cups: 3, swaps: [3, 4, 4, 5, 5, 6], speed: 380 },
  normale: { cups: 3, swaps: [4, 5, 6, 7, 8, 9], speed: 280 },
  difficile: { cups: 4, swaps: [5, 6, 7, 8, 10, 12], speed: 210 },
};
const PICK_LIMIT = 6000;

let shell = null;
let raf = null;
let timer = null;
let safety = null;

export default {
  id: "bussolotti",
  order: "desc",
  maxSeconds: 60,

  createParams(rng, difficulty) {
    const s = SETTINGS[difficulty] || SETTINGS.normale;
    const rounds = s.swaps.map((n) => {
      const ball = Math.floor(rng() * s.cups);
      const swaps = [];
      for (let i = 0; i < n; i++) {
        const a = Math.floor(rng() * s.cups);
        let b = Math.floor(rng() * (s.cups - 1));
        if (b >= a) b++;
        swaps.push([a, b]);
      }
      return { ball, swaps };
    });
    return { cups: s.cups, rounds, speed: s.speed };
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
    const { cups, rounds, speed } = ctx.params;
    shell = createShell(container, { title: "Bussolotti", hint: "Segui la pallina" });
    const canvas = el("canvas", { class: "run-canvas" });
    shell.body.append(canvas);
    const g = fitCanvas(canvas, shell.body, W, H);

    const slotX = (i) => (W / (cups + 1)) * (i + 1);
    const CUP_W = cups === 4 ? 64 : 80, CUP_H = 96, BASE_Y = 210;

    let index = 0, score = 0;
    let done = false;
    // posizione di ogni bicchiere (indice del posto) e animazione in corso
    let pos = Array.from({ length: cups }, (_, i) => i);   // bicchiere -> posto
    let ballCup = 0;                                       // bicchiere con la pallina
    let phase = "show";                                    // show | shuffle | pick | reveal
    let anim = null;                                       // { a, b, t0, dur }
    let swapIdx = 0;
    let lift = 1;                                          // 1 = sollevati (si vede la pallina)
    let revealCup = -1;

    const startRound = () => {
      if (done) return;
      if (index >= ROUNDS) { finish(); return; }
      const r = rounds[index];
      pos = Array.from({ length: cups }, (_, i) => i);
      ballCup = r.ball;
      swapIdx = 0;
      lift = 1;
      revealCup = -1;
      phase = "show";
      shell.setHint(`Giro ${index + 1} di ${ROUNDS} · guarda dov'è la pallina`);
      sfx.play("blip");
      timer = setTimeout(() => { lift = 0; phase = "shuffle"; timer = setTimeout(nextSwap, 400); }, 1300);
    };

    const nextSwap = () => {
      if (done) return;
      const r = rounds[index];
      if (swapIdx >= r.swaps.length) {
        phase = "pick";
        shell.setHint("Dov'è la pallina? Tocca il bicchiere");
        timer = setTimeout(() => { if (phase === "pick") choose(-1); }, PICK_LIMIT);
        return;
      }
      const [a, b] = r.swaps[swapIdx++];
      // a e b sono POSTI: scambia i bicchieri che li occupano
      const cupA = pos.indexOf(a), cupB = pos.indexOf(b);
      anim = { cupA, cupB, from: [a, b], t0: performance.now(), dur: speed };
      sfx.play("tock");
    };

    const choose = (cup) => {
      if (phase !== "pick") return;
      phase = "reveal";
      clearTimeout(timer);
      lift = 1;
      revealCup = cup;
      if (cup === ballCup) { score++; vibrate(20); sfx.play("perfect"); shell.setHint("Presa!"); }
      else { vibrate([60, 30, 60]); sfx.play("bad"); shell.setHint(cup < 0 ? "Tempo scaduto" : "No, era lì"); }
      index++;
      shell.setTimer(`${score}/${ROUNDS}`);
      timer = setTimeout(startRound, 1100);
    };

    canvas.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      if (done || phase !== "pick") return;
      const p = canvasPoint(canvas, ev, W, H);
      for (let c = 0; c < cups; c++) {
        if (Math.abs(p.x - slotX(pos[c])) < CUP_W / 2 + 8 && p.y > BASE_Y - CUP_H - 20 && p.y < BASE_Y + 20) { choose(c); return; }
      }
    });

    const cupX = (c, now) => {
      if (anim && (c === anim.cupA || c === anim.cupB)) {
        const k = Math.min(1, (now - anim.t0) / anim.dur);
        const e = 0.5 - Math.cos(k * Math.PI) / 2;
        const [fa, fb] = anim.from;
        const from = c === anim.cupA ? fa : fb, to = c === anim.cupA ? fb : fa;
        return slotX(from) + (slotX(to) - slotX(from)) * e;
      }
      return slotX(pos[c]);
    };

    const draw = (now) => {
      g.fillStyle = "#26254a";
      g.fillRect(0, 0, W, H);
      g.fillStyle = "#3f3d8a";
      g.fillRect(0, BASE_Y, W, H - BASE_Y);
      const lifted = lift * 40;
      for (let c = 0; c < cups; c++) {
        const x = cupX(c, now);
        // pallina (quando i bicchieri sono alzati)
        if (c === ballCup && lift > 0) {
          g.fillStyle = "#ffb703";
          g.beginPath();
          g.arc(x, BASE_Y - 12, 12, 0, Math.PI * 2);
          g.fill();
        }
        // bicchiere
        const y = BASE_Y - lifted;
        g.fillStyle = c === revealCup ? (c === ballCup ? "#43d17a" : "#ff4d6d") : "#ff595e";
        g.beginPath();
        g.moveTo(x - CUP_W / 2 + 8, y - CUP_H);
        g.lineTo(x + CUP_W / 2 - 8, y - CUP_H);
        g.lineTo(x + CUP_W / 2, y);
        g.lineTo(x - CUP_W / 2, y);
        g.closePath();
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.18)";
        g.fillRect(x - CUP_W / 2 + 12, y - CUP_H + 10, 10, CUP_H - 20);
      }
    };

    const loop = (now) => {
      if (done) return;
      if (anim && now - anim.t0 >= anim.dur) {
        const [a, b] = anim.from;
        pos[anim.cupA] = b;
        pos[anim.cupB] = a;
        anim = null;
        timer = setTimeout(nextSwap, 60);
      }
      draw(now);
      raf = requestAnimationFrame(loop);
    };

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      shell.showDone(this.formatScore(score));
      ctx.onFinish(score, `${score} ${score === 1 ? "pallina trovata" : "palline trovate"} su ${ROUNDS}`);
    };

    shell.setTimer(`${index}/${ROUNDS}`);
    raf = requestAnimationFrame(loop);
    startRound();
    // Sicurezza: fine comunque entro il tempo massimo
    safety = setTimeout(() => finish(), (this.maxSeconds - 2) * 1000);
  },

  unmount() {
    clearTimeout(timer);
    clearTimeout(safety);
    cancelAnimationFrame(raf);
    shell?.remove();
    shell = null;
  },
};
