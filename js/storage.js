// Salvataggi sul telefono (localStorage): impostazioni della sfida,
// record personali, pacchetti personali.

const KEY_CONFIG = "config";
const KEY_RECORDS = "records";
const KEY_PACKS = "packs";
const KEY_CLIENT = "clientId";
const KEY_HISTORY = "history";
const KEY_FAVORITES = "favorites"; // minigiochi preferiti (stellina nella scelta)
const KEY_SEEN = "seen";
const KEY_DAILY = "daily"; // risultati della Sfida del giorno: { "AAAA-MM-GG": { total, rounds, at } }
const DAILY_MAX = 120; // giorni ricordati
const KEY_STATS = "stats"; // statistiche per minigioco (vedi stats.js)
const KEY_ACHIEVEMENTS = "achievements"; // traguardi sbloccati: { id: data }
const KEY_AVATAR = "avatar"; // simbolo personale (emoji tra AVATARS)

// Ultima stanza in cui si è entrati come ospiti (per "Rientra nella stanza" in home, entro 10 minuti)
const KEY_LAST_ROOM = "lastRoom";
// Missioni della settimana: contatori { key, counters } e settimane completate { key: data }
const KEY_WEEKLY = "weekly";
const KEY_WEEKS_DONE = "weeksDone";
export function getWeekly() { return read(KEY_WEEKLY, null); }
export function saveWeekly(w) { write(KEY_WEEKLY, w); }
export function getWeeksDone() { const o = read(KEY_WEEKS_DONE, {}); return o && typeof o === "object" ? o : {}; }
export function saveWeeksDone(o) { write(KEY_WEEKS_DONE, o); }
// Record del gruppo (host): { "<nome stanza>": { <gameId>: { score, text, name, at } } }
const KEY_GROUP_RECORDS = "groupRecords";
export function getGroupRecord(roomName, gameId) {
  return read(KEY_GROUP_RECORDS, {})?.[roomName || ""]?.[gameId] || null;
}
export function saveGroupRecord(roomName, gameId, rec) {
  const all = read(KEY_GROUP_RECORDS, {});
  const key = roomName || "";
  all[key] = all[key] || {};
  all[key][gameId] = rec;
  write(KEY_GROUP_RECORDS, all);
}
export const LAST_ROOM_MS = 10 * 60 * 1000;
export function getLastRoom() {
  const r = read(KEY_LAST_ROOM, null);
  if (!r || typeof r.code !== "string" || Date.now() - (r.at || 0) > LAST_ROOM_MS) return null;
  return r;
}
export function saveLastRoom(code) { write(KEY_LAST_ROOM, { code, at: Date.now() }); }
export function forgetLastRoom() { try { localStorage.removeItem(KEY_LAST_ROOM); } catch (_) { /* privato */ } }

export const AVATARS = ["⭐", "🔥", "⚡", "🌙", "🍀", "🎈", "🐱", "🐶", "🦊", "🐸", "🦄", "🐼"];
export function getAvatar() {
  try { const a = localStorage.getItem(KEY_AVATAR); return AVATARS.includes(a) ? a : ""; } catch (_) { return ""; }
}
export function setAvatar(a) {
  try { if (AVATARS.includes(a)) localStorage.setItem(KEY_AVATAR, a); else localStorage.removeItem(KEY_AVATAR); } catch (_) { /* privato */ }
}
export function isAvatar(a) { return AVATARS.includes(a); } // minigiochi già giocati su questo telefono (per la presentazione lunga la prima volta)
const HISTORY_MAX = 60; // sfide ricordate sul telefono

export const DIFFICULTIES = [
  { id: "facile", label: "Facile" },
  { id: "normale", label: "Normale" },
  { id: "difficile", label: "Difficile" },
];
// Opzioni della stanza: le tre difficoltà più "Crescente" (da Facile a Difficile lungo la sfida)
// "esperto": come Difficile ma con il 25% di tempo in meno; vale solo nei minigiochi in cui è sbloccato
// (tre volte oltre l'80% a Difficile), altrimenti si gioca Difficile. "crescente": da Facile a Difficile lungo la sfida.
export const DIFFICULTY_OPTIONS = [...DIFFICULTIES, { id: "esperto", label: "Esperto" }, { id: "crescente", label: "Crescente" }];
export const EXPERT_UNLOCK = 3; // risultati oltre l'80% a Difficile per sbloccare Esperto in un minigioco

// "tutti" = una manche per ogni minigioco scelto
export const ROUND_OPTIONS = [3, 5, 7, 10, 15, 20, "tutti"];

// Manche automatiche: dopo i risultati si passa da soli alla manche successiva
// dopo autoDelay secondi (tra AUTO_MIN e AUTO_MAX).
export const AUTO_MIN = 5;
export const AUTO_MAX = 20;
// teams: 0 = nessuna squadra, 2 o 3 = numero di squadre (l'host assegna le persone in stanza)
// special: manche speciali (punti doppi, tutto o niente, rimonta…) decise dall'host a ogni sfida
// championship: le sfide di questa stanza fanno classifica cumulativa a giornate
// mode: "punti" (classifica a punti) | "eliminazione" (ogni manche l'ultimo esce, vince chi resta)
// roomName: nome dato dall'host alla stanza (facoltativo), mostrato a tutti e usato per i record del gruppo
const DEFAULT_CONFIG = { games: [], rounds: 5, difficulty: "normale", pack: null, auto: false, autoDelay: 8, teams: 0, special: false, championship: false, mode: "punti", roomName: "" };
export const MODE_OPTIONS = [{ id: "punti", label: "A punti" }, { id: "eliminazione", label: "A eliminazione" }];

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* spazio pieno o privato */ }
}

// ---------------------------------------------------------------
// Identità stabile del telefono: un id casuale creato una volta sola.
// Serve in stanza per riconoscere chi rientra dopo aver perso la linea.
// ---------------------------------------------------------------

export function getClientId() {
  // ?cid=… nell'indirizzo: id imposto (solo per il tester, che apre host e ospite nello stesso browser)
  const forced = new URLSearchParams(location.search).get("cid");
  if (forced) return String(forced).slice(0, 40);
  let id = null;
  try { id = localStorage.getItem(KEY_CLIENT); } catch (_) { /* privato */ }
  if (!id) {
    id = "c" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    try { localStorage.setItem(KEY_CLIENT, id); } catch (_) { /* pazienza: vale per questa sessione */ }
  }
  return id;
}

// ---------------------------------------------------------------
// Configurazione della sfida
// ---------------------------------------------------------------

export function loadConfig(allGameIds) {
  const saved = read(KEY_CONFIG, {});
  const cfg = { ...DEFAULT_CONFIG, ...saved };
  // Prima volta: tutti i minigiochi. Dopo: quelli scelti (anche nessuno).
  cfg.games = Array.isArray(saved.games) ? saved.games.filter((id) => allGameIds.includes(id)) : [...allGameIds];
  if (!Array.isArray(saved.games)) cfg.pack = { type: "builtin", id: "tutti" };
  if (!ROUND_OPTIONS.includes(cfg.rounds)) cfg.rounds = DEFAULT_CONFIG.rounds;
  if (!DIFFICULTY_OPTIONS.some((d) => d.id === cfg.difficulty)) cfg.difficulty = DEFAULT_CONFIG.difficulty;
  cfg.auto = cfg.auto === true;
  cfg.autoDelay = Number.isInteger(cfg.autoDelay) ? Math.min(AUTO_MAX, Math.max(AUTO_MIN, cfg.autoDelay)) : DEFAULT_CONFIG.autoDelay;
  cfg.teams = [0, 2, 3, "coppie"].includes(cfg.teams) ? cfg.teams : 0;
  cfg.presenter = cfg.presenter === true; // l'host presenta e non gioca
  cfg.special = cfg.special === true;
  cfg.championship = cfg.championship === true;
  cfg.mode = MODE_OPTIONS.some((m) => m.id === cfg.mode) ? cfg.mode : "punti";
  cfg.roomName = typeof cfg.roomName === "string" ? cfg.roomName.trim().slice(0, 24) : "";
  return cfg;
}

export function saveConfig(cfg) {
  write(KEY_CONFIG, cfg);
}

// ---------------------------------------------------------------
// Record personali: uno per minigioco e difficoltà, con il testo già
// formattato (così l'elenco dei record non deve caricare i minigiochi).
// ---------------------------------------------------------------

export function getRecord(gameId, difficulty) {
  const all = read(KEY_RECORDS, {});
  const r = all[`${gameId}:${difficulty}`];
  if (r === undefined || r === null) return null;
  // Formato vecchio (solo numero): lo mostriamo così com'è
  if (typeof r === "number") return { score: r, text: String(r), legacy: true };
  return r;
}

// Salva se migliore. Ritorna true se è un nuovo record.
export function updateRecord(game, difficulty, score) {
  if (score === null || score === undefined || !game.isValidScore(score)) return false;
  const current = getRecord(game.id, difficulty);
  const better = current === null || (game.order === "asc" ? score < current.score : score > current.score);
  if (!better && current?.legacy) {
    // Record in formato vecchio (solo numero): lo riscriviamo col testo giusto
    const all = read(KEY_RECORDS, {});
    all[`${game.id}:${difficulty}`] = { score: current.score, text: game.formatScore(current.score) };
    write(KEY_RECORDS, all);
  }
  if (better) {
    const all = read(KEY_RECORDS, {});
    all[`${game.id}:${difficulty}`] = { score, text: game.formatScore(score) };
    write(KEY_RECORDS, all);
  }
  return better;
}

// ---------------------------------------------------------------
// Preferiti
// ---------------------------------------------------------------

export function getFavorites() {
  const list = read(KEY_FAVORITES, []);
  return Array.isArray(list) ? list : [];
}

export function toggleFavorite(gameId) {
  const list = getFavorites();
  const next = list.includes(gameId) ? list.filter((id) => id !== gameId) : [...list, gameId];
  write(KEY_FAVORITES, next);
  return next.includes(gameId);
}

// ---------------------------------------------------------------
// Minigiochi già visti su questo telefono
// ---------------------------------------------------------------

export function getSeenGames() {
  const list = read(KEY_SEEN, []);
  return Array.isArray(list) ? list : [];
}

export function markSeen(gameId) {
  const list = getSeenGames();
  if (list.includes(gameId)) return;
  write(KEY_SEEN, [...list, gameId]);
}

// ---------------------------------------------------------------
// Storico delle sfide giocate su questo telefono (le più recenti prima).
// Voce: { at, code, solo, rounds, difficulty, games, players: [{id,name,color,points}],
//         winnerId, awards: [{icon,title,name}], meId }
// ---------------------------------------------------------------

export function getHistory() {
  const list = read(KEY_HISTORY, []);
  return Array.isArray(list) ? list : [];
}

export function addHistoryEntry(entry) {
  const list = [entry, ...getHistory()].slice(0, HISTORY_MAX);
  write(KEY_HISTORY, list);
}

export function clearHistory() {
  write(KEY_HISTORY, []);
}

// ---------------------------------------------------------------
// Sfida del giorno: un risultato per giorno (il primo tentativo)
// ---------------------------------------------------------------

export function getDailyResults() {
  const obj = read(KEY_DAILY, {});
  return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
}

export function saveDailyResult(key, result) {
  const all = getDailyResults();
  all[key] = result;
  const keys = Object.keys(all).sort();
  while (keys.length > DAILY_MAX) delete all[keys.shift()];
  write(KEY_DAILY, all);
}

// ---------------------------------------------------------------
// Statistiche per minigioco e traguardi (la logica sta in stats.js)
// ---------------------------------------------------------------

export function getStats() {
  const obj = read(KEY_STATS, {});
  return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
}

export function saveStats(stats) {
  write(KEY_STATS, stats);
}

export function getAchievements() {
  const obj = read(KEY_ACHIEVEMENTS, {});
  return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
}

export function saveAchievements(obj) {
  write(KEY_ACHIEVEMENTS, obj);
}

// ---------------------------------------------------------------
// Pacchetti personali
// ---------------------------------------------------------------

export function getUserPacks() {
  const packs = read(KEY_PACKS, []);
  return Array.isArray(packs) ? packs : [];
}

// rules (facoltativo): { rounds, difficulty, auto, autoDelay, special, mode } salvate insieme ai minigiochi
export function saveUserPack(name, games, rules = null) {
  const packs = getUserPacks();
  const clean = name.trim().slice(0, 24) || "Il mio pacchetto";
  const existing = packs.find((p) => p.name.toLowerCase() === clean.toLowerCase());
  if (existing) {
    existing.games = [...games];
    if (rules) existing.rules = { ...rules }; else delete existing.rules;
    write(KEY_PACKS, packs);
    return existing;
  }
  const pack = { id: `u${Date.now().toString(36)}`, name: clean, games: [...games], ...(rules ? { rules: { ...rules } } : {}) };
  packs.push(pack);
  write(KEY_PACKS, packs);
  return pack;
}

export function deleteUserPack(id) {
  write(KEY_PACKS, getUserPacks().filter((p) => p.id !== id));
}
