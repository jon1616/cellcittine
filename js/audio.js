/*
  Audio: effetti sonori sintetizzati al volo con WebAudio (nessun file) e
  musica di sottofondo da file (assets/music/sottofondo.mp3, in loop nei menu).
  I minigiochi non producono suoni da soli: chiamano
  sfx.play("good"), sfx.play("bad")… così, per cambiare un suono (o sostituirlo
  con un file vero), si tocca solo questo modulo.

  I browser sbloccano l'audio solo dopo un tocco dell'utente: il primo
  pointerdown su qualsiasi cosa crea/riattiva il contesto audio.
*/

const KEY = "sound";
const KEY_MUSIC = "music";
let ctx = null;
let master = null;
let enabled = localStorage.getItem(KEY) !== "off";
let inflateOsc = null;

// ---------------------------------------------------------------
// Musica di sottofondo (file MP3, in loop): suona nei menu, si ferma nei minigiochi
// ---------------------------------------------------------------
const MUSIC_SRC = "assets/music/sottofondo.mp3";
const MUSIC_VOLUME = 0.32;
let musicEnabled = localStorage.getItem(KEY_MUSIC) !== "off";
let musicEl = null;
let musicScene = "menu"; // "menu" | "game"
let musicFade = null;
let musicUnlocked = false; // il primo play deve avvenire dentro un tocco dell'utente

function musicElement() {
  if (!musicEl) {
    musicEl = new Audio(MUSIC_SRC);
    musicEl.loop = true;
    musicEl.preload = "auto";
    musicEl.volume = 0;
  }
  return musicEl;
}

function fadeTo(target, ms, then) {
  clearInterval(musicFade);
  const m = musicElement();
  const start = m.volume;
  const t0 = performance.now();
  musicFade = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    m.volume = start + (target - start) * k;
    if (k >= 1) { clearInterval(musicFade); then?.(); }
  }, 50);
}

function musicUpdate() {
  const m = musicElement();
  const wantPlaying = musicEnabled && musicUnlocked && musicScene === "menu";
  if (wantPlaying) {
    if (m.paused) m.play().catch((e) => console.warn("musica:", e.name, e.message));
    fadeTo(MUSIC_VOLUME, 900);
  } else if (!m.paused) {
    fadeTo(0, 500, () => m.pause());
  }
}

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// Sblocco al primo tocco (in cattura, così arriva prima di qualsiasi altro handler)
document.addEventListener("pointerdown", () => {
  if (enabled) ensure();
  if (!musicUnlocked) { musicUnlocked = true; musicUpdate(); }
}, { capture: true, passive: true });
// Se l'app va in secondo piano, la musica si ferma; al ritorno riparte se serve
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { clearInterval(musicFade); musicEl?.pause(); }
  else musicUpdate();
});

// ---------------------------------------------------------------
// Mattoni: un tono con inviluppo, un soffio di rumore
// ---------------------------------------------------------------

function tone({ freq, dur = 0.1, type = "sine", gain = 0.2, slideTo = null, delay = 0, attack = 0.004 }) {
  const c = ensure();
  if (!c || !enabled) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.1, gain = 0.2, delay = 0, lowpass = 4000 }) {
  const c = ensure();
  if (!c || !enabled) return;
  const t0 = c.currentTime + delay;
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = lowpass;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t0);
}

// ---------------------------------------------------------------
// I suoni, per nome
// ---------------------------------------------------------------

const SOUNDS = {
  // interfaccia
  click: () => tone({ freq: 600, dur: 0.035, type: "sine", gain: 0.08 }),
  tick: () => tone({ freq: 880, dur: 0.07, type: "square", gain: 0.12 }),
  go: () => tone({ freq: 1320, dur: 0.22, type: "square", gain: 0.14 }),
  tock: () => tone({ freq: 660, dur: 0.05, type: "square", gain: 0.1 }),

  // esito di un'azione nei minigiochi
  good: () => { tone({ freq: 880, dur: 0.06, gain: 0.15 }); tone({ freq: 1320, dur: 0.09, gain: 0.15, delay: 0.06 }); },
  bad: () => tone({ freq: 170, dur: 0.22, type: "sawtooth", gain: 0.12, slideTo: 110 }),
  blip: () => tone({ freq: 1000, dur: 0.03, gain: 0.07 }),
  flip: () => tone({ freq: 520, dur: 0.045, type: "triangle", gain: 0.12 }),
  hit: () => { tone({ freq: 720, dur: 0.05, type: "square", gain: 0.12 }); noise({ dur: 0.05, gain: 0.08 }); },
  jump: () => tone({ freq: 320, dur: 0.13, gain: 0.12, slideTo: 720 }),
  crash: () => { noise({ dur: 0.28, gain: 0.25, lowpass: 1500 }); tone({ freq: 140, dur: 0.3, type: "sawtooth", gain: 0.12, slideTo: 60 }); },
  pop: () => { noise({ dur: 0.08, gain: 0.3, lowpass: 3000 }); tone({ freq: 420, dur: 0.1, gain: 0.15, slideTo: 90 }); },
  perfect: () => [880, 1109, 1319, 1760].forEach((f, i) => tone({ freq: f, dur: 0.09, gain: 0.13, delay: i * 0.055 })),

  // momenti della sfida
  special: () => [440, 554, 659, 880, 1109].forEach((f, i) => { tone({ freq: f, dur: 0.16, type: "square", gain: 0.09, delay: i * 0.07 }); tone({ freq: f * 1.5, dur: 0.16, type: "triangle", gain: 0.06, delay: i * 0.07 }); }),
  roundEnd: () => { tone({ freq: 660, dur: 0.14, type: "triangle", gain: 0.15 }); tone({ freq: 880, dur: 0.24, type: "triangle", gain: 0.15, delay: 0.14 }); },
  record: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.12, type: "triangle", gain: 0.15, delay: i * 0.085 })),
  fanfare: () => {
    const seq = [[523, 0.12], [523, 0.12], [523, 0.12], [659, 0.3], [784, 0.14], [1047, 0.5]];
    let t = 0;
    for (const [f, d] of seq) { tone({ freq: f, dur: d, type: "square", gain: 0.1, delay: t }); tone({ freq: f / 2, dur: d, type: "triangle", gain: 0.08, delay: t }); t += d + 0.03; }
  },
};

// Note per "Sequenza" e simili: quattro tasti = quattro altezze
const PAD_NOTES = [329.63, 392.0, 493.88, 587.33];

export const sfx = {
  play(name) {
    if (!enabled) return;
    SOUNDS[name]?.();
  },

  // Tono di un tasto (0..3), usato dai minigiochi a "pad"
  pad(i, dur = 0.25) {
    tone({ freq: PAD_NOTES[i % PAD_NOTES.length], dur, type: "triangle", gain: 0.16 });
  },

  // Nota su una scala, per feedback "che sale" (es. numeri in ordine)
  step(i, total) {
    const f = 440 * Math.pow(2, (i / Math.max(1, total)) * 1.0);
    tone({ freq: f, dur: 0.06, type: "sine", gain: 0.1 });
  },

  // Nota "lunga" su una scala di `total` gradini (memory dei suoni)
  note(i, total, dur = 0.4) {
    const f = 330 * Math.pow(2, i / Math.max(1, total) * 1.2);
    tone({ freq: f, dur, type: "triangle", gain: 0.16 });
  },

  // Tono continuo che sale mentre si tiene premuto (palloncini)
  inflateStart() {
    const c = ensure();
    if (!c || !enabled || inflateOsc) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = 220;
    g.gain.value = 0.06;
    osc.connect(g).connect(master);
    osc.start();
    inflateOsc = { osc, g, t0: c.currentTime };
  },
  inflateUpdate(level) { // level 0..1
    if (!inflateOsc) return;
    inflateOsc.osc.frequency.setTargetAtTime(220 + level * 700, ctx.currentTime, 0.02);
  },
  inflateStop() {
    if (!inflateOsc) return;
    const { osc, g } = inflateOsc;
    inflateOsc = null;
    g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.02);
    osc.stop(ctx.currentTime + 0.1);
  },

  // Musica: scena corrente ("menu" suona, "game" tace) e interruttore
  setScene(scene) {
    if (musicScene === scene) return;
    musicScene = scene;
    musicUpdate();
  },
  isMusicEnabled() { return musicEnabled; },
  musicState() { return { playing: !!musicEl && !musicEl.paused, volume: musicEl ? Math.round(musicEl.volume * 100) / 100 : 0, scene: musicScene, unlocked: musicUnlocked }; },
  setMusicEnabled(on) {
    musicEnabled = !!on;
    localStorage.setItem(KEY_MUSIC, musicEnabled ? "on" : "off");
    musicUpdate();
  },

  isEnabled() { return enabled; },
  setEnabled(on) {
    enabled = !!on;
    localStorage.setItem(KEY, enabled ? "on" : "off");
    if (enabled) { ensure(); SOUNDS.click(); } else { sfx.inflateStop(); }
  },
};
