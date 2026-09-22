/*
  Prestazione in percentuale (0–100) per qualsiasi minigioco, così risultati
  di giochi diversi si possono sommare (Sfida del giorno, statistiche).

  - Se il minigioco ha maxScore(params): percentuale = punteggio / massimo.
  - Altrimenti si usa un riferimento per minigioco (REFS): il valore che vale
    100% ("prestazione ottima" a difficoltà normale). Per i giochi "asc"
    (vince il più basso) il riferimento è un intervallo {best, worst}.
  - Un punteggio non valido (falsa partenza, "non finito") vale 0.

  I riferimenti si ritoccano qui, senza toccare i minigiochi.
*/

const REFS = {
  // vince il più alto: valore = 100%
  anagrammi: 8, bilancia: 12, calcoli: 15, capitali: 15, colori: 14, contrari: 16, dieci: 12, dipiu: 14,
  frecce: 20, gemelli: 10, intruso: 10, ordina: 40, orologio: 10, ortografia: 14, parola: 8, prossimo: 12,
  rime: 16, serpente: 15, sfuggente: 15, tocchi: 70, tris: 8, maggiore: 16, sillabe: 10, percorso: 7, resto: 16, rimbalzo: 25, plurali: 16, verofalso: 18,
  // vince il più basso: best = 100%, worst = 0%
  semaforo: { best: 180, worst: 700 },
  labirinto: { best: 12, worst: 40 },
  memory: { best: 200, worst: 600 },
  numeri: { best: 150, worst: 450 },
};

const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

// Percentuale di prestazione (0–100) di `score` nel minigioco `game` (caricato).
export function ratingOf(game, score, params = null) {
  if (!game || score === null || score === undefined || !Number.isFinite(score)) return 0;
  if (typeof game.isValidScore === "function" && !game.isValidScore(score)) return 0;
  const max = typeof game.maxScore === "function" ? game.maxScore(params) : null;
  if (Number.isFinite(max) && max > 0 && game.order !== "asc") return clamp((score / max) * 100);
  const ref = REFS[game.id];
  if (ref === undefined) return 0;
  if (typeof ref === "number") return clamp((score / ref) * 100);
  return clamp(((ref.worst - score) / (ref.worst - ref.best)) * 100);
}

// C'è un riferimento per questo minigioco? (per sapere se la percentuale ha senso)
export function hasReference(game, params = null) {
  if (!game) return false;
  const max = typeof game.maxScore === "function" ? game.maxScore(params) : null;
  return (Number.isFinite(max) && max > 0 && game.order !== "asc") || REFS[game.id] !== undefined;
}

// Cinque quadratini stile "Wordle": 🟩 pieno ogni 20%, 🟨 mezzo, ⬜ vuoto
export function ratingBar(pct) {
  let out = "";
  for (let i = 0; i < 5; i++) {
    const fill = pct - i * 20;
    out += fill >= 20 ? "🟩" : fill >= 10 ? "🟨" : "⬜";
  }
  return out;
}

// Giudizio in una parola
export function ratingLabel(pct) {
  if (pct >= 95) return "Perfetto!";
  if (pct >= 80) return "Ottimo";
  if (pct >= 60) return "Bene";
  if (pct >= 40) return "Discreto";
  if (pct >= 20) return "Così così";
  return "Da riprovare";
}
