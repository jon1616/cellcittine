// Generatore casuale con seme: stesso seme = stessa sequenza su tutti i telefoni.
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of children) {
    node.append(child);
  }
  return node;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Vibrazione (interruttore in home: localStorage "vibration" = "off" per spegnerla)
export function isVibrationEnabled() {
  try { return localStorage.getItem("vibration") !== "off"; } catch (_) { return true; }
}
export function setVibrationEnabled(on) {
  try { localStorage.setItem("vibration", on ? "on" : "off"); } catch (_) { /* privato */ }
}
export function vibrate(pattern) {
  if (!isVibrationEnabled()) return;
  try { navigator.vibrate?.(pattern); } catch (_) { /* non supportato */ }
}

// Vibrazioni "parlanti" per i momenti della sfida
const BUZZ = {
  win: [40, 30, 40, 30, 140],       // manche vinta
  record: [60, 40, 60, 40, 220],    // record personale
  out: [220, 70, 220],              // eliminazione
  duelLost: [120, 50, 120],         // duello perso
  duelWon: [50, 30, 50, 30, 50, 30, 180],
  bonus: [30, 30, 30],
};
export function buzz(kind) { if (BUZZ[kind]) vibrate(BUZZ[kind]); }

// Preferenze di lettura: una mano (comandi in basso), meno movimento, contrasto alto
const PREFS = { onehand: "onehand", motion: "reducemotion", contrast: "highcontrast" };
export function getPref(key) { try { return localStorage.getItem(PREFS[key]) === "on"; } catch (_) { return false; } }
export function setPref(key, on) { try { localStorage.setItem(PREFS[key], on ? "on" : "off"); } catch (_) { /* privato */ } applyPrefs(); }
export function applyPrefs() {
  const root = document.documentElement;
  root.classList.toggle("onehand", getPref("onehand"));
  root.classList.toggle("reduce-motion", getPref("motion"));
  root.classList.toggle("high-contrast", getPref("contrast"));
}
