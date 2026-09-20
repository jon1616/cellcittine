/*
  Pacchetti: selezioni pronte di minigiochi.
  - BUILTIN: definiti qui (alcuni fissi, alcuni calcolati dal catalogo).
  - Pacchetti personali: salvati sul telefono (vedi storage.js).
*/

import { CATALOG, ALL_GAME_IDS, isNew } from "./games/catalog.js";

const ids = (filter) => CATALOG.filter(filter).map((g) => g.id);

export const BUILTIN_PACKS = [
  {
    id: "tutti",
    name: "Tutti",
    icon: "🌈",
    description: "Ogni minigioco disponibile.",
    games: () => [...ALL_GAME_IDS],
  },
  {
    id: "classici",
    name: "Classici",
    icon: "⭐",
    description: "I più semplici da capire al volo.",
    games: () => ["semaforo", "memory", "numeri", "calcoli", "bersagli", "precisione", "tocchi", "cesto"],
  },
  {
    id: "riflessi",
    name: "Solo riflessi",
    icon: "⚡",
    description: "Reazione pura, niente ragionamento.",
    games: () => ids((g) => g.category === "riflessi" || g.skills.includes("riflessi")),
  },
  {
    id: "cervello",
    name: "Cervello",
    icon: "🧠",
    description: "Memoria, attenzione e calcolo.",
    games: () => ids((g) => ["memoria", "attenzione", "calcolo"].includes(g.category)),
  },
  {
    id: "azione",
    name: "Azione",
    icon: "🎮",
    description: "Destrezza e velocità di mano.",
    games: () => ids((g) => g.category === "destrezza" || g.pace === "frenetico"),
  },
  {
    id: "tranquilli",
    name: "Tranquilli",
    icon: "🍵",
    description: "Senza fretta, per giocare con calma.",
    games: () => ids((g) => g.pace === "tranquillo"),
  },
  {
    id: "testa",
    name: "Testa",
    icon: "🎓",
    description: "Parole, numeri e memoria.",
    games: () => ids((g) => ["parole", "calcolo", "memoria"].includes(g.category)),
  },
  {
    id: "lampo",
    name: "Lampo",
    icon: "⏱️",
    description: "Solo manche da 20 secondi o meno.",
    games: () => ids((g) => g.duration <= 20),
  },
  {
    id: "novita",
    name: "Novità",
    icon: "✨",
    description: "Gli ultimi arrivati.",
    games: () => ids((g) => isNew(g)),
  },
];

export function getBuiltinPack(id) {
  return BUILTIN_PACKS.find((p) => p.id === id);
}

// Risolve un pacchetto (integrato o personale) nella lista di id dei giochi.
export function resolvePack(pack) {
  const list = typeof pack.games === "function" ? pack.games() : pack.games;
  return list.filter((id) => ALL_GAME_IDS.includes(id));
}

// Sceglie n giochi a caso (tra quelli indicati, o tutti).
export function randomSelection(n, from = ALL_GAME_IDS) {
  const pool = [...from];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(1, Math.min(n, pool.length)));
}

// Due selezioni sono uguali se contengono gli stessi giochi (in qualsiasi ordine).
export function sameSelection(a, b) {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}
