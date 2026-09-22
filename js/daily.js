/*
  Sfida del giorno: ogni giorno gli stessi 5 minigiochi (uno per categoria,
  con gli stessi semi) per tutti quelli che hanno l'app. Si gioca da soli,
  a difficoltà normale; ogni manche vale fino a 1000 punti (percentuale di
  prestazione × 10, vedi rating.js), totale fino a 5000.

  Conta il PRIMO tentativo del giorno (come i giochi "uno al giorno");
  si può rigiocare per allenarsi. Il risultato si salva sul telefono
  (storage.getDailyResults) e si può condividere come testo.
*/

import { seededRandom } from "./utils.js";
import { CATALOG, CATEGORIES } from "./games/catalog.js";
import { shuffle } from "./games/shell.js";
import { getDailyResults, saveDailyResult } from "./storage.js";
import { ratingBar } from "./rating.js";
import { bumpWeekly } from "./missions.js";

export const DAILY_ROUNDS = 5;
export const DAILY_DIFFICULTY = "normale";
export const DAILY_ROUND_MAX = 1000;

// "2026-09-22" nel fuso del telefono
export function dailyKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function hashKey(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Il piano del giorno: 5 minigiochi di 5 categorie diverse, e un seme per manche.
export function dailyPlan(key = dailyKey()) {
  const rng = seededRandom(hashKey(key));
  const cats = shuffle(CATEGORIES.map((c) => c.id), rng).slice(0, DAILY_ROUNDS);
  const games = [];
  for (const cat of cats) {
    const pool = CATALOG.filter((g) => g.category === cat && !g.hidden);
    if (pool.length) games.push(pool[Math.floor(rng() * pool.length)].id);
  }
  // Se mancassero categorie, completa con altri minigiochi (mai doppioni)
  const rest = shuffle(CATALOG.map((g) => g.id).filter((id) => !games.includes(id)), rng);
  while (games.length < DAILY_ROUNDS && rest.length) games.push(rest.shift());
  const seeds = games.map(() => Math.floor(rng() * 2 ** 31));
  return { key, games, seeds, difficulty: DAILY_DIFFICULTY };
}

// Il minigioco del giorno (in allenamento conta doppio): fuori dal piano della sfida del giorno
export function dailyGame(key = dailyKey()) {
  const plan = dailyPlan(key);
  const rng = seededRandom(hashKey("gioco-" + key));
  const pool = CATALOG.filter((g) => !plan.games.includes(g.id));
  return pool[Math.floor(rng() * pool.length)]?.id || CATALOG[0].id;
}

// Data leggibile: "lun 22 set"
export function dailyLabel(key = dailyKey()) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
}

export function formatPoints(n) {
  return Number(n || 0).toLocaleString("it-IT");
}

// Risultato del giorno (primo tentativo), o null
export function todayResult(key = dailyKey()) {
  return getDailyResults()[key] || null;
}

// Salva il primo tentativo del giorno; ritorna true se è stato registrato (era il primo)
export function recordDaily(key, rounds) {
  if (todayResult(key)) return false;
  const total = rounds.reduce((s, r) => s + r.points, 0);
  saveDailyResult(key, { total, rounds, at: Date.now() });
  bumpWeekly("dailies");
  return true;
}

// Giorni di fila con la sfida fatta (oggi compreso se già fatta, altrimenti fino a ieri)
export function dailyStreak(now = new Date()) {
  const results = getDailyResults();
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!results[dailyKey(day)]) day.setDate(day.getDate() - 1);
  let n = 0;
  while (results[dailyKey(day)]) { n++; day.setDate(day.getDate() - 1); }
  return n;
}

// Quante sfide del giorno fatte, e il miglior totale
export function dailyStats() {
  const list = Object.values(getDailyResults());
  return { played: list.length, best: list.reduce((b, r) => Math.max(b, r.total || 0), 0) };
}

// Testo da condividere, stile "uno al giorno"
export function shareText(key, result) {
  const lines = [`Cellcittine · Sfida del giorno ${dailyLabel(key)}`];
  for (const r of result.rounds) {
    const g = CATALOG.find((x) => x.id === r.gameId);
    lines.push(`${g?.icon || "•"} ${ratingBar(r.pct)} ${r.pct}%`);
  }
  lines.push(`Totale ${formatPoints(result.total)} / ${formatPoints(DAILY_ROUNDS * DAILY_ROUND_MAX)}`);
  lines.push(`Provaci anche tu: https://jon1616.github.io/cellcittine/?giorno=${key}`);
  return lines.join("\n");
}
