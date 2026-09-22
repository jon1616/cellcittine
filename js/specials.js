/*
  Manche speciali: variazioni sulle regole di UNA manche, decise dall'host
  all'avvio della sfida (config.special = true) e annunciate nel messaggio
  "start" (campo `special`), così tutti vedono lo stesso annuncio al conto
  alla rovescia. Nessuna dipende dalla fortuna: cambiano solo quanto valgono
  i punti o la difficoltà, l'abilità decide sempre.

  Difficoltà "crescente": le manche passano da Facile a Difficile lungo la sfida
  (roundDifficulty), anche senza manche speciali.
*/

export const SPECIALS = {
  doppia:      { id: "doppia",      icon: "🔥", label: "Punti doppi",     desc: "In questa manche i punti valgono il doppio." },
  finale:      { id: "finale",      icon: "🏁", label: "Finale doppia",   desc: "Ultima manche: i punti valgono il doppio. Tutto è ancora possibile!" },
  tuttoniente: { id: "tuttoniente", icon: "🎯", label: "Tutto o niente",  desc: "Solo chi vince la manche prende punti. Gli altri zero." },
  rimonta:     { id: "rimonta",     icon: "🚀", label: "Rimonta",         desc: "Chi è nella metà bassa della classifica prende punti doppi." },
  lampo:       { id: "lampo",       icon: "⚡", label: "Manche difficile", desc: "Per tutti a difficoltà Difficile, solo per questa manche.", difficulty: "difficile" },
  relax:       { id: "relax",       icon: "🍃", label: "Manche facile",   desc: "Per tutti a difficoltà Facile: riprendete fiato.", difficulty: "facile" },
};

const SPECIAL_CHANCE = 0.4; // probabilità che una manche (non la prima) sia speciale

// Difficoltà effettiva della manche `index` su `total`, data quella configurata.
export function roundDifficulty(configured, index, total) {
  if (configured !== "crescente") return configured;
  if (total <= 1) return "normale";
  const k = index / total;
  return k < 1 / 3 ? "facile" : k < 2 / 3 ? "normale" : "difficile";
}

// Assegna le manche speciali (host): ritorna un array di id (o null) lungo `total`.
//   rng: generatore dal seme della sfida (deterministico ma diverso ogni sfida)
//   difficulty: quella configurata (le manche Difficile/Facile hanno senso solo se cambiano qualcosa)
export function assignSpecials(total, rng, difficulty) {
  const out = Array.from({ length: total }, () => null);
  if (total >= 3) out[total - 1] = "finale";
  const pool = ["doppia", "tuttoniente", "rimonta"];
  if (difficulty !== "difficile" && difficulty !== "crescente") pool.push("lampo");
  if (difficulty !== "facile" && difficulty !== "crescente") pool.push("relax");
  for (let i = 1; i < total - 1; i++) {
    if (out[i - 1]) continue; // mai due di fila
    if (rng() < SPECIAL_CHANCE) out[i] = pool[Math.floor(rng() * pool.length)];
  }
  return out;
}

// Applica la manche speciale ai punti della classifica di manche (host).
//   ranking: [{ id, score, points }] già con i punti base per posizione
//   standingsBefore: [{ id, points }] classifica generale PRIMA di questa manche
export function applySpecial(specialId, ranking, standingsBefore) {
  const sp = SPECIALS[specialId];
  if (!sp) return;
  if (specialId === "doppia" || specialId === "finale") {
    for (const r of ranking) r.points *= 2;
  } else if (specialId === "tuttoniente") {
    const best = ranking.find((r) => r.score !== null && r.score !== undefined);
    for (const r of ranking) if (!best || r.score !== best.score) r.points = 0;
  } else if (specialId === "rimonta") {
    const n = standingsBefore.length;
    if (n >= 2) {
      const low = new Set(standingsBefore.slice(Math.ceil(n / 2)).map((s) => s.id));
      for (const r of ranking) if (low.has(r.id)) r.points *= 2;
    }
  }
}
