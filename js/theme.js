/*
  Temi: sfondo illustrato dietro le schermate dei menu (mai dietro i minigiochi,
  che coprono tutto con la loro area) e piccole variazioni di colore.

  Un tema può essere stagionale: si attiva da solo tra due date (mese-giorno).
  Chi gioca può anche sceglierne uno a mano dalla home ("auto" = per data).
  Per aggiungere un tema: immagine in assets/bg-<id>.webp (verticale 9:16,
  stessa regola di stile dello sfondo base) e una voce in THEMES.
*/

const KEY = "theme";

export const THEMES = [
  {
    id: "base",
    name: "Classico",
    icon: "✨",
    bg: null, // sfondo disegnato da codice (base.css)
    accent: null, // null = colori standard dell'app
  },
  // Stagionali: attivi da soli nel periodo indicato (mese-giorno, estremi inclusi).
  // Un tema senza immagine pronta si può nascondere con `missing: true`.
  { id: "halloween", name: "Halloween", icon: "🎃", bg: "assets/bg-halloween.webp", accent: "#ff924c", from: "10-20", to: "11-02" },
  { id: "natale", name: "Natale", icon: "🎄", bg: "assets/bg-natale.webp", accent: "#ff4d6d", from: "12-08", to: "01-06" },
  { id: "estate", name: "Estate", icon: "🌞", bg: "assets/bg-estate.webp", accent: "#36cfc9", from: "06-15", to: "09-10" },
];

export function availableThemes() {
  return THEMES.filter((t) => !t.missing);
}

// "MM-DD" di oggi
function today(now = new Date()) {
  return `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// Un periodo può scavalcare l'anno (es. 12-08 → 01-06)
function inPeriod(t, day) {
  if (!t.from || !t.to) return false;
  return t.from <= t.to ? day >= t.from && day <= t.to : day >= t.from || day <= t.to;
}

export function seasonalTheme(now = new Date()) {
  const day = today(now);
  return availableThemes().find((t) => inPeriod(t, day)) || null;
}

export function getChoice() {
  return localStorage.getItem(KEY) || "auto";
}

export function setChoice(id) {
  localStorage.setItem(KEY, id);
  applyTheme();
}

// Il tema effettivo: scelta manuale se valida, altrimenti stagionale, altrimenti base.
export function currentTheme() {
  const choice = getChoice();
  if (choice !== "auto") {
    const chosen = availableThemes().find((t) => t.id === choice);
    if (chosen) return chosen;
  }
  return seasonalTheme() || THEMES[0];
}

// Miscela due colori esadecimali (k = quanto del primo)
function mix(a, b, k) {
  const pa = a.match(/[0-9a-f]{2}/gi).map((h) => parseInt(h, 16));
  const pb = b.match(/[0-9a-f]{2}/gi).map((h) => parseInt(h, 16));
  return "#" + pa.map((v, i) => Math.round(v * k + pb[i] * (1 - k)).toString(16).padStart(2, "0")).join("");
}

export function applyTheme() {
  const t = currentTheme();
  const root = document.documentElement;
  // Indirizzo assoluto: dentro il CSS, un url() relativo verrebbe risolto rispetto al foglio di stile
  if (t.bg) root.style.setProperty("--bg-image", `url("${new URL(t.bg, document.baseURI).href}")`);
  else root.style.removeProperty("--bg-image");
  if (t.accent) root.style.setProperty("--accent", t.accent);
  else root.style.removeProperty("--accent");
  root.dataset.theme = t.id;
  // Barra di stato del telefono (Android): il colore di sfondo, scurito verso l'accento del tema
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t.accent ? mix(t.accent, "#1e1f34", 0.25) : "#1e1f34");
  return t;
}
