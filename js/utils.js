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
