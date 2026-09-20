// Salvataggi sul telefono (localStorage): impostazioni della sfida e record personali.

const KEY_CONFIG = "config";
const KEY_RECORDS = "records";

export const DIFFICULTIES = [
  { id: "facile", label: "Facile" },
  { id: "normale", label: "Normale" },
  { id: "difficile", label: "Difficile" },
];

// "tutti" = una manche per ogni minigioco scelto
export const ROUND_OPTIONS = [3, 5, 7, 10, "tutti"];

const DEFAULT_CONFIG = { games: [], rounds: 5, difficulty: "normale" };

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

export function loadConfig(allGameIds) {
  const saved = read(KEY_CONFIG, {});
  const cfg = { ...DEFAULT_CONFIG, ...saved };
  // Prima volta: tutti i minigiochi. Dopo: quelli scelti (anche nessuno).
  cfg.games = Array.isArray(saved.games) ? saved.games.filter((id) => allGameIds.includes(id)) : [...allGameIds];
  if (!ROUND_OPTIONS.includes(cfg.rounds)) cfg.rounds = DEFAULT_CONFIG.rounds;
  if (!DIFFICULTIES.some((d) => d.id === cfg.difficulty)) cfg.difficulty = DEFAULT_CONFIG.difficulty;
  return cfg;
}

export function saveConfig(cfg) {
  write(KEY_CONFIG, cfg);
}

// Record personali: uno per minigioco e difficoltà.
export function getRecord(gameId, difficulty) {
  const all = read(KEY_RECORDS, {});
  return all[`${gameId}:${difficulty}`] ?? null;
}

// Salva se migliore. Ritorna true se è un nuovo record.
export function updateRecord(game, difficulty, score) {
  if (score === null || score === undefined || !game.isValidScore(score)) return false;
  const current = getRecord(game.id, difficulty);
  const better = current === null || (game.order === "asc" ? score < current : score > current);
  if (better) {
    const all = read(KEY_RECORDS, {});
    all[`${game.id}:${difficulty}`] = score;
    write(KEY_RECORDS, all);
  }
  return better;
}
