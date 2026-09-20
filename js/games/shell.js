/*
  Shell: la cornice comune a tutti i minigiochi.
  Crea l'area a schermo intero con titolo, timer e suggerimento, e offre
  un cronometro. Ogni minigioco riempie solo `body`.
*/

import { el } from "../utils.js";
import { sfx } from "../audio.js";

export function createShell(container, { title, hint = "", color = "#26254a" }) {
  const timerEl = el("span", { class: "game-timer" });
  const hintEl = el("div", { class: "game-hint", text: hint });
  const body = el("div", { class: "game-body" });
  const area = el("div", { class: "game-area game-shell" }, [
    el("div", { class: "game-header" }, [el("span", { class: "game-title", text: title }), timerEl]),
    hintEl,
    body,
  ]);
  area.style.background = color;
  container.append(area);

  return {
    area,
    body,
    setHint(text) { hintEl.textContent = text; },
    setTimer(text) { timerEl.textContent = text; },
    setColor(bg) { area.style.background = bg; },
    // Schermata finale del minigioco, in attesa degli altri.
    showDone(text) {
      body.replaceChildren(
        el("div", { class: "game-done" }, [
          el("div", { class: "big", text }),
          el("div", { class: "hint", text: "In attesa degli altri…" }),
        ])
      );
    },
    remove() { area.remove(); },
  };
}

// Conto alla rovescia in secondi. Ritorna una funzione per fermarlo.
export function runTimer(seconds, onTick, onEnd) {
  const endAt = performance.now() + seconds * 1000;
  let stopped = false;
  let lastWhole = Math.ceil(seconds);
  const tick = () => {
    if (stopped) return;
    const remaining = Math.max(0, endAt - performance.now());
    // Tic negli ultimi tre secondi
    const whole = Math.ceil(remaining / 1000);
    if (whole !== lastWhole) {
      lastWhole = whole;
      if (whole > 0 && whole <= 3) sfx.play("tock");
    }
    onTick(remaining / 1000);
    if (remaining <= 0) {
      stopped = true;
      onEnd();
      return;
    }
    requestAnimationFrame(tick);
  };
  tick();
  return () => { stopped = true; };
}

// Cronometro crescente. Ritorna { stop() -> secondi trascorsi }.
export function runStopwatch(onTick) {
  const startedAt = performance.now();
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    onTick((performance.now() - startedAt) / 1000);
    requestAnimationFrame(tick);
  };
  tick();
  return {
    stop() {
      stopped = true;
      return (performance.now() - startedAt) / 1000;
    },
  };
}

export function formatSeconds(s) {
  return `${s.toFixed(1)} s`;
}

// Mescola con un generatore casuale a seme (uguale su tutti i telefoni).
export function shuffle(array, rng) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Adatta un canvas all'area disponibile mantenendo le proporzioni logiche W×H.
// Ritorna il contesto 2D già scalato: si disegna in coordinate logiche.
export function fitCanvas(canvas, container, W, H) {
  const g = canvas.getContext("2d");
  const rect = container.getBoundingClientRect();
  const scale = Math.min(rect.width / W, (rect.height || H) / H) || 1;
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${H * scale}px`;
  canvas.width = Math.round(W * scale * dpr);
  canvas.height = Math.round(H * scale * dpr);
  g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  return g;
}

// Converte le coordinate di un evento pointer in coordinate logiche del canvas.
export function canvasPoint(canvas, ev, W, H) {
  const r = canvas.getBoundingClientRect();
  return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
}
