/*
  Statistiche personali e traguardi, tutto sul telefono.

  Per ogni manche giocata si registra (recordRound): quante volte, la media e
  il massimo della percentuale di prestazione (rating.js), le manche vinte in
  gruppo. Da qui: totali, punti forti per categoria, un "titolo" e i traguardi.

  I traguardi (ACHIEVEMENTS) si sbloccano una volta sola; checkAchievements()
  ritorna quelli nuovi, da annunciare.
*/

import { CATALOG, CATEGORIES, getEntry } from "./games/catalog.js";
import { getStats, saveStats, getAchievements, saveAchievements, getHistory, getRecord, DIFFICULTIES, EXPERT_UNLOCK } from "./storage.js";
import { getDailyResults } from "./storage.js";
import { dailyStreak, dailyGame } from "./daily.js";
import { bumpWeekly, weeksDoneCount } from "./missions.js";
import { starsOf } from "./rating.js";

// Registra una manche giocata da chi guarda.
//   pct: percentuale di prestazione (0-100) · won: ha vinto la manche (in gruppo) · solo: allenamento/giorno
export function recordRound(gameId, { pct = 0, won = false, solo = true, seconds = 0, difficulty = null } = {}) {
  const stats = getStats();
  const isNew = !stats[gameId];
  const g = stats[gameId] || { n: 0, sum: 0, best: 0, wins: 0, solo: 0, sec: 0, perfect: 0 };
  // Verso Esperto: risultati oltre l'80% a Difficile (o già a Esperto)
  if ((difficulty === "difficile" || difficulty === "esperto") && pct >= 80) g.expert = (g.expert || 0) + 1;
  // Stelle (da soli o in gruppo): restano le migliori mai prese in quel minigioco
  g.stars = Math.max(g.stars || 0, starsOf(pct));
  // Missioni della settimana (il minigioco del giorno conta doppio)
  const w = gameId === dailyGame() ? 2 : 1;
  bumpWeekly("rounds", w);
  if (won && !solo) bumpWeekly("wins", w);
  if (isNew) bumpWeekly("newGames", 1);
  if (pct >= 100) bumpWeekly("perfect", 1);
  const cat = getEntry(gameId)?.category;
  if (cat) bumpWeekly(`cat_${cat}`, w);
  g.n++;
  g.sum += pct;
  g.best = Math.max(g.best, pct);
  if (won && !solo) g.wins++;
  if (solo) g.solo++;
  g.sec += seconds;
  if (pct >= 100) g.perfect++;
  g.last = Date.now();
  stats[gameId] = g;
  saveStats(stats);
}

export function gameStat(gameId) {
  return getStats()[gameId] || null;
}

// Stelle: per minigioco, totale, e il prossimo obiettivo (il minigioco giocato con meno stelle)
export function starsFor(gameId) { return getStats()[gameId]?.stars || 0; }
export function totalStars() { return Object.values(getStats()).reduce((s, g) => s + (g.stars || 0), 0); }
export function nextGoal() {
  const stats = getStats();
  const played = CATALOG.filter((g) => stats[g.id]).sort((a, b) => (stats[a.id].stars || 0) - (stats[b.id].stars || 0) || (stats[b.id].best || 0) - (stats[a.id].best || 0));
  const target = played.find((g) => (stats[g.id].stars || 0) < 3) || CATALOG.find((g) => !stats[g.id]) || null;
  return target ? { id: target.id, stars: stats[target.id]?.stars || 0 } : null;
}

// Difficoltà adattiva (Giro veloce): dalle stelle già prese in quel minigioco
export function adaptiveDifficulty(gameId) {
  const g = getStats()[gameId];
  if (!g) return "normale";
  const s = g.stars || 0;
  if (s >= 3) return isExpertUnlocked(gameId) ? "esperto" : "difficile";
  if (s === 2) return "difficile";
  if (s === 1) return "normale";
  return "facile";
}

// Esperto sbloccato in questo minigioco? E quanti minigiochi lo hanno
export function isExpertUnlocked(gameId) {
  return (getStats()[gameId]?.expert || 0) >= EXPERT_UNLOCK;
}
export function expertProgress(gameId) {
  return Math.min(EXPERT_UNLOCK, getStats()[gameId]?.expert || 0);
}
export function expertCount() {
  return Object.values(getStats()).filter((g) => (g.expert || 0) >= EXPERT_UNLOCK).length;
}

// Totali generali
export function summary() {
  const stats = getStats();
  const hist = getHistory();
  const daily = Object.values(getDailyResults());
  let rounds = 0, seconds = 0, wins = 0, played = 0, perfect = 0;
  for (const g of Object.values(stats)) { rounds += g.n; seconds += g.sec || 0; wins += g.wins || 0; played++; perfect += g.perfect || 0; }
  const group = hist.filter((h) => !h.solo);
  const records = CATALOG.reduce((n, g) => n + DIFFICULTIES.filter((d) => getRecord(g.id, d.id)).length, 0);
  return {
    rounds, seconds, wins, perfect,
    played, total: CATALOG.length,
    challenges: group.length,
    victories: group.filter((h) => h.winnerId && h.winnerId === h.meId).length,
    trainings: hist.filter((h) => h.solo && !h.daily).length,
    dailies: daily.length,
    dailyBest: daily.reduce((b, r) => Math.max(b, r.total || 0), 0),
    streak: dailyStreak(),
    records,
    weeks: weeksDoneCount(),
    experts: expertCount(),
    stars: totalStars(),
    starsMax: CATALOG.length * 3,
  };
}

// Media per categoria: [{ id, label, icon, color, n, avg }] (solo categorie giocate)
export function categoryStrengths() {
  const stats = getStats();
  return CATEGORIES.map((c) => {
    let n = 0, sum = 0;
    for (const [id, g] of Object.entries(stats)) if (getEntry(id)?.category === c.id) { n += g.n; sum += g.sum; }
    return { ...c, n, avg: n ? Math.round(sum / n) : 0 };
  }).filter((c) => c.n > 0).sort((a, b) => b.avg - a.avg);
}

// I minigiochi più giocati e quelli mai provati
export function mostPlayed(k = 5) {
  return Object.entries(getStats()).map(([id, g]) => ({ id, ...g, avg: g.n ? Math.round(g.sum / g.n) : 0 })).sort((a, b) => b.n - a.n).slice(0, k);
}
export function neverPlayed() {
  const stats = getStats();
  return CATALOG.filter((g) => !stats[g.id]).map((g) => g.id);
}

// Un titolo che riassume come si gioca (dalla categoria migliore con abbastanza manche)
const TITLES = { riflessi: "Fulmine", memoria: "Elefante", attenzione: "Lince", destrezza: "Cecchino", calcolo: "Calcolatrice", parole: "Dizionario" };
export function playerTitle() {
  const s = summary();
  if (s.rounds === 0) return { title: "Esordiente", why: "Gioca qualche manche per scoprire i tuoi punti forti" };
  const cats = categoryStrengths().filter((c) => c.n >= 5);
  if (!cats.length) return { title: "In prova", why: "Ancora poche manche: continua così" };
  const best = cats[0];
  if (cats.length >= 4 && best.avg - cats[cats.length - 1].avg <= 10) return { title: "Tuttofare", why: "Bravo in tutto allo stesso modo" };
  return { title: TITLES[best.id] || "Campione", why: `Il tuo punto forte: ${best.label.toLowerCase()} (media ${best.avg}%)` };
}

// ---------------------------------------------------------------
// Traguardi
// ---------------------------------------------------------------

export const ACHIEVEMENTS = [
  { id: "prima", icon: "🎉", title: "Prima sfida", desc: "Finisci una sfida in gruppo", test: (s) => s.challenges >= 1 },
  { id: "vittoria", icon: "🏆", title: "Campione", desc: "Vinci una sfida in gruppo", test: (s) => s.victories >= 1 },
  { id: "tre", icon: "👑", title: "Tris di vittorie", desc: "Vinci 3 sfide in gruppo", test: (s) => s.victories >= 3 },
  { id: "veterano", icon: "🎖️", title: "Veterano", desc: "Gioca 10 sfide in gruppo", test: (s) => s.challenges >= 10 },
  { id: "allenato", icon: "🏋️", title: "In forma", desc: "Completa 10 allenamenti", test: (s) => s.trainings >= 10 },
  { id: "esploratore", icon: "🧭", title: "Esploratore", desc: "Prova 25 minigiochi diversi", test: (s) => s.played >= 25 },
  { id: "collezionista", icon: "🗂️", title: "Collezionista", desc: "Prova tutti i minigiochi", test: (s) => s.played >= s.total },
  { id: "cento", icon: "💯", title: "Perfetto", desc: "Fai il massimo in una manche", test: (s) => s.perfect >= 1 },
  { id: "record10", icon: "★", title: "Da record", desc: "Segna 10 record personali", test: (s) => s.records >= 10 },
  { id: "record30", icon: "🌟", title: "Collezione di record", desc: "Segna 30 record personali", test: (s) => s.records >= 30 },
  { id: "maratona", icon: "🏃", title: "Maratona", desc: "Gioca 100 manche", test: (s) => s.rounds >= 100 },
  { id: "maratona500", icon: "🚀", title: "Instancabile", desc: "Gioca 500 manche", test: (s) => s.rounds >= 500 },
  { id: "giorno", icon: "📅", title: "Buongiorno", desc: "Fai la tua prima Sfida del giorno", test: (s) => s.dailies >= 1 },
  { id: "serie3", icon: "🔥", title: "Tre di fila", desc: "Sfida del giorno per 3 giorni di fila", test: (s) => s.streak >= 3 },
  { id: "serie7", icon: "☄️", title: "Una settimana", desc: "Sfida del giorno per 7 giorni di fila", test: (s) => s.streak >= 7 },
  { id: "giorno4000", icon: "🎯", title: "Giornata top", desc: "4000 punti in una Sfida del giorno", test: (s) => s.dailyBest >= 4000 },
  { id: "settimana", icon: "🗓️", title: "Settimana piena", desc: "Completa le 3 missioni di una settimana", test: (s) => s.weeks >= 1 },
  { id: "esperto1", icon: "🔓", title: "Esperto", desc: "Sblocca la difficoltà Esperto in un minigioco", test: (s) => s.experts >= 1 },
  { id: "stelle30", icon: "✨", title: "Cielo stellato", desc: "Raccogli 30 stelle", test: (s) => s.stars >= 30 },
  { id: "stelle100", icon: "🌌", title: "Via Lattea", desc: "Raccogli 100 stelle", test: (s) => s.stars >= 100 },
  { id: "esperto10", icon: "🎓", title: "Dieci volte esperto", desc: "Sblocca Esperto in 10 minigiochi", test: (s) => s.experts >= 10 },
  { id: "mese", icon: "📆", title: "Un mese di missioni", desc: "Completa le missioni di 4 settimane", test: (s) => s.weeks >= 4 },
];

export function unlockedAchievements() {
  return getAchievements();
}

// Controlla i traguardi e ritorna quelli appena sbloccati (già salvati).
export function checkAchievements() {
  const done = getAchievements();
  const s = summary();
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (done[a.id]) continue;
    let ok = false;
    try { ok = a.test(s); } catch (_) { ok = false; }
    if (ok) { done[a.id] = Date.now(); fresh.push(a); }
  }
  if (fresh.length) saveAchievements(done);
  return fresh;
}
