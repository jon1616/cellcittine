/*
  Missioni della settimana: tre obiettivi sorteggiati dalla settimana (lunedì → domenica,
  stesso sorteggio per tutti), con progresso sul telefono. Completate tutte e tre, la
  settimana vale una medaglia (nelle statistiche).

  I contatori della settimana (storage: weekly) vengono aumentati da chi registra le
  cose che succedono: stats.recordRound (manche, vittorie, categorie, minigiochi nuovi,
  100%), daily.recordDaily (sfide del giorno), results (sfide e allenamenti finiti),
  challenge.submitScore (record). Il minigioco del giorno conta doppio.
*/

import { seededRandom } from "./utils.js";
import { CATEGORIES } from "./games/catalog.js";
import { getWeekly, saveWeekly, getWeeksDone, saveWeeksDone } from "./storage.js";

// "2026-W39": lunedì della settimana in cui cade `date`
export function weekKey(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // lunedì = 0
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function weekLabel(key = weekKey()) {
  const [y, m, d] = key.split("-").map(Number);
  const a = new Date(y, m - 1, d), b = new Date(y, m - 1, d + 6);
  const f = (x) => x.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  return `${f(a)} – ${f(b)}`;
}

function hash(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Modelli: counter = contatore della settimana, target = quanto serve
const TEMPLATES = [
  { id: "rounds", icon: "🎮", counter: "rounds", target: 20, text: (n) => `Gioca ${n} manche` },
  { id: "wins", icon: "🏆", counter: "wins", target: 4, text: (n) => `Vinci ${n} manche in gruppo` },
  { id: "dailies", icon: "📅", counter: "dailies", target: 3, text: (n) => `Fai ${n} Sfide del giorno` },
  { id: "records", icon: "★", counter: "records", target: 3, text: (n) => `Batti ${n} record personali` },
  { id: "newGames", icon: "🧭", counter: "newGames", target: 3, text: (n) => `Prova ${n} minigiochi mai giocati` },
  { id: "perfect", icon: "💯", counter: "perfect", target: 1, text: () => "Fai il massimo in una manche" },
  { id: "trainings", icon: "🏋️", counter: "trainings", target: 2, text: (n) => `Completa ${n} allenamenti` },
  { id: "challenges", icon: "👥", counter: "challenges", target: 2, text: (n) => `Finisci ${n} sfide in gruppo` },
  ...CATEGORIES.map((c) => ({ id: `cat_${c.id}`, icon: c.icon, counter: `cat_${c.id}`, target: 6, text: (n) => `Gioca ${n} manche di ${c.label.toLowerCase()}` })),
];

// Le tre missioni della settimana (sempre tre modelli diversi)
export function weekMissions(key = weekKey()) {
  const rng = seededRandom(hash("missioni-" + key));
  const pool = [...TEMPLATES];
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

// Contatori della settimana corrente (si azzerano da soli al cambio di settimana)
function counters(key = weekKey()) {
  const w = getWeekly();
  return w && w.key === key && w.counters && typeof w.counters === "object" ? w.counters : {};
}

export function bumpWeekly(counter, amount = 1) {
  const key = weekKey();
  const c = counters(key);
  c[counter] = (c[counter] || 0) + amount;
  saveWeekly({ key, counters: c });
}

// Stato delle missioni: [{ ...missione, done, progress }] e se la settimana è completa
export function missionStatus(key = weekKey()) {
  const c = counters(key);
  const list = weekMissions(key).map((m) => ({ ...m, progress: Math.min(m.target, c[m.counter] || 0), done: (c[m.counter] || 0) >= m.target }));
  return { key, list, complete: list.every((m) => m.done) };
}

// Da chiamare dopo le cose che possono completare una missione: ritorna le missioni
// appena completate e segna la settimana se è finita.
let announced = new Set();
export function checkMissions() {
  const st = missionStatus();
  const fresh = st.list.filter((m) => m.done && !announced.has(`${st.key}:${m.id}`));
  for (const m of fresh) announced.add(`${st.key}:${m.id}`);
  if (st.complete) {
    const done = getWeeksDone();
    if (!done[st.key]) { done[st.key] = Date.now(); saveWeeksDone(done); return { fresh, weekDone: true }; }
  }
  return { fresh, weekDone: false };
}

export function weeksDoneCount() {
  return Object.keys(getWeeksDone()).length;
}
