// Salvataggi sul telefono (localStorage): impostazioni della sfida,
// record personali, pacchetti personali.

const KEY_CONFIG = "config";
const KEY_RECORDS = "records";
const KEY_PACKS = "packs";

export const DIFFICULTIES = [
  { id: "facile", label: "Facile" },
  { id: "normale", label: "Normale" },
  { id: "difficile", label: "Difficile" },
];

// "tutti" = una manche per ogni minigioco scelto
export const ROUND_OPTIONS = [3, 5, 7, 10, "tutti"];

const DEFAULT_CONFIG = { games: [], rounds: 5, difficulty: "normale", pack: null };

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
// Configurazione della sfida
// ---------------------------------------------------------------

export function loadConfig(allGameIds) {
  const saved = read(KEY_CONFIG, {});
  const cfg = { ...DEFAULT_CONFIG, ...saved };
  // Prima volta: tutti i minigiochi. Dopo: quelli scelti (anche nessuno).
  cfg.games = Array.isArray(saved.games) ? saved.games.filter((id) => allGameIds.includes(id)) : [...allGameIds];
  if (!Array.isArray(saved.games)) cfg.pack = { type: "builtin", id: "tutti" };
  if (!ROUND_OPTIONS.includes(cfg.rounds)) cfg.rounds = DEFAULT_CONFIG.rounds;
  if (!DIFFICULTIES.some((d) => d.id === cfg.difficulty)) cfg.difficulty = DEFAULT_CONFIG.difficulty;
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
  if (typeof r === "number") return { score: r, text: String(r) };
  return r;
}

// Salva se migliore. Ritorna true se è un nuovo record.
export function updateRecord(game, difficulty, score) {
  if (score === null || score === undefined || !game.isValidScore(score)) return false;
  const current = getRecord(game.id, difficulty);
  const better = current === null || (game.order === "asc" ? score < current.score : score > current.score);
  if (better) {
    const all = read(KEY_RECORDS, {});
    all[`${game.id}:${difficulty}`] = { score, text: game.formatScore(score) };
    write(KEY_RECORDS, all);
  }
  return better;
}

// ---------------------------------------------------------------
// Pacchetti personali
// ---------------------------------------------------------------

export function getUserPacks() {
  const packs = read(KEY_PACKS, []);
  return Array.isArray(packs) ? packs : [];
}

export function saveUserPack(name, games) {
  const packs = getUserPacks();
  const clean = name.trim().slice(0, 24) || "Il mio pacchetto";
  const existing = packs.find((p) => p.name.toLowerCase() === clean.toLowerCase());
  if (existing) {
    existing.games = [...games];
    write(KEY_PACKS, packs);
    return existing;
  }
  const pack = { id: `u${Date.now().toString(36)}`, name: clean, games: [...games] };
  packs.push(pack);
  write(KEY_PACKS, packs);
  return pack;
}

export function deleteUserPack(id) {
  write(KEY_PACKS, getUserPacks().filter((p) => p.id !== id));
}
