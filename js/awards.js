/*
  Premi di fine sfida: calcolati dall'host dallo storico delle manche
  (challenge.history) e mandati a tutti nel messaggio "final".

  history = [{ gameId, ranking: [{ id, name, color, score, points, record }] }]
  standings = [{ id, name, color, points }] in ordine di classifica

  Ogni premio va a UNA persona (a parità non si assegna, salvo dove indicato);
  una persona può vincere più premi. Solo in gruppo, con almeno 2 partecipanti.
*/

import { getEntry } from "./games/catalog.js";

// Premio per chi vince più manche di una categoria (almeno una, e da solo in testa)
const CATEGORY_AWARDS = {
  riflessi: { icon: "⚡", title: "Fulmine", what: "riflessi" },
  destrezza: { icon: "🎯", title: "Cecchino", what: "destrezza" },
  memoria: { icon: "🐘", title: "Elefante", what: "memoria" },
  attenzione: { icon: "🔍", title: "Occhio di lince", what: "attenzione" },
  calcolo: { icon: "🧮", title: "Calcolatrice", what: "calcolo" },
  parole: { icon: "📖", title: "Dizionario", what: "parole" },
};

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Chi ha vinto una manche (tutti quelli a pari punteggio col primo)
function roundWinners(ranking) {
  const best = ranking.find((r) => r.score !== null && r.score !== undefined);
  if (!best) return [];
  return ranking.filter((r) => r.score === best.score).map((r) => r.id);
}

// L'unico con il valore massimo (> min), altrimenti null
function uniqueMax(counts, min = 1) {
  let bestId = null;
  let best = min - 1;
  let tie = false;
  for (const [id, n] of counts) {
    if (n > best) { best = n; bestId = id; tie = false; }
    else if (n === best) tie = true;
  }
  return tie || bestId === null ? null : { id: bestId, n: best };
}

// Classifica (posizioni) dopo le prime k manche
function positionsAfter(history, k, ids) {
  const points = new Map(ids.map((id) => [id, 0]));
  for (const h of history.slice(0, k)) {
    for (const r of h.ranking) points.set(r.id, (points.get(r.id) || 0) + (r.points || 0));
  }
  const sorted = [...points.entries()].sort((a, b) => b[1] - a[1]);
  const pos = new Map();
  sorted.forEach(([id, pts], i) => {
    // a pari punti, pari posizione
    pos.set(id, i > 0 && sorted[i - 1][1] === pts ? pos.get(sorted[i - 1][0]) : i + 1);
  });
  return pos;
}

export function computeAwards(history, standings) {
  const awards = [];
  const ids = standings.map((s) => s.id);
  const who = (id) => standings.find((s) => s.id === id) || { id, name: "?", color: 0 };
  const rounds = history.length;
  if (ids.length < 2 || rounds === 0) return awards;

  const add = (id, def, text) => awards.push({ id, name: who(id).name, color: who(id).color, icon: def.icon, title: def.title, text });

  // Premi per categoria
  const catWins = new Map(); // categoria -> Map(id -> vittorie)
  const wins = new Map(ids.map((id) => [id, 0]));
  for (const h of history) {
    const cat = getEntry(h.gameId)?.category;
    const winners = roundWinners(h.ranking);
    for (const id of winners) {
      wins.set(id, (wins.get(id) || 0) + 1);
      if (cat) {
        if (!catWins.has(cat)) catWins.set(cat, new Map(ids.map((i) => [i, 0])));
        catWins.get(cat).set(id, (catWins.get(cat).get(id) || 0) + 1);
      }
    }
  }
  for (const [cat, counts] of catWins) {
    const def = CATEGORY_AWARDS[cat];
    const top = uniqueMax(counts);
    const total = history.filter((h) => getEntry(h.gameId)?.category === cat).length;
    if (def && top) add(top.id, def, `${plural(top.n, "manche vinta", "manche vinte")} su ${total} di ${def.what}`);
  }

  if (rounds >= 3) {
    // Dominio: più della metà delle manche vinte
    const top = uniqueMax(wins, Math.floor(rounds / 2) + 1);
    if (top) add(top.id, { icon: "👑", title: "Dominio" }, `${plural(top.n, "manche vinta", "manche vinte")} su ${rounds}`);

    // Costante: mai in fondo alla classifica di manche (tra chi ha giocato) e sempre presente
    const steady = ids.filter((id) => history.every((h) => {
      const played = h.ranking.filter((r) => r.score !== null && r.score !== undefined);
      if (played.length < 2) return true;
      const mine = played.find((r) => r.id === id);
      if (!mine) return false;
      const worst = played[played.length - 1].score;
      return mine.score !== worst;
    }));
    if (steady.length > 0) {
      const id = steady[0]; // standings è già in ordine di punti
      add(id, { icon: "🧱", title: "Costante" }, `mai in fondo alla classifica in ${rounds} manche`);
    }

    // Rimonta: dalla posizione dopo la prima manche a quella finale
    const first = positionsAfter(history, 1, ids);
    const last = positionsAfter(history, rounds, ids);
    const gains = new Map(ids.map((id) => [id, (first.get(id) || 0) - (last.get(id) || 0)]));
    const top2 = uniqueMax(gains, 1);
    if (top2) add(top2.id, { icon: "🚀", title: "Rimonta" }, `dal ${first.get(top2.id)}º al ${last.get(top2.id)}º posto`);
  }

  // Record: più record personali battuti
  const records = new Map(ids.map((id) => [id, 0]));
  for (const h of history) for (const r of h.ranking) if (r.record) records.set(r.id, (records.get(r.id) || 0) + 1);
  const topR = uniqueMax(records, 1);
  if (topR) add(topR.id, { icon: "★", title: "Da record" }, plural(topR.n, "record personale battuto", "record personali battuti"));

  return awards;
}
