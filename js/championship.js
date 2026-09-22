/*
  Campionato: più sfide di fila nella stessa stanza, con una classifica che
  si somma di giornata in giornata (una sfida = una giornata).

  Punti di giornata: come nelle manche, per posizione nella classifica finale
  della sfida (primo = N, secondo = N-1… con N partecipanti; a pari punti, pari
  posizione). Si contano anche le giornate vinte e i punti totali delle sfide,
  per gli spareggi. Vive nello stato dell'host (state.championship) e viaggia
  nel messaggio "final" (campo championship) e in "champion" alla chiusura.
*/

import { state } from "./state.js";

export function startChampionship() {
  state.championship = { day: 0, table: new Map(), startedAt: Date.now() };
  return state.championship;
}

export function isChampionship() {
  return !!state.championship;
}

// Aggiunge la giornata appena finita (standings: classifica finale della sfida)
export function addDay(standings) {
  const c = state.championship || startChampionship();
  c.day++;
  const n = standings.length;
  let pos = 0;
  standings.forEach((s, i) => {
    if (i === 0 || s.points !== standings[i - 1].points) pos = i;
    const row = c.table.get(s.id) || { name: s.name, color: s.color, points: 0, wins: 0, total: 0, days: 0 };
    row.name = s.name;
    row.color = s.color;
    row.points += n - pos;
    row.total += s.points;
    row.days++;
    if (pos === 0) row.wins++;
    c.table.set(s.id, row);
  });
  return snapshot();
}

// Tabella ordinata, pronta per la rete e per lo schermo
export function snapshot() {
  const c = state.championship;
  if (!c) return null;
  const table = [...c.table.entries()]
    .map(([id, r]) => ({ id, ...r }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins || b.total - a.total);
  return { day: c.day, table };
}

export function endChampionship() {
  const snap = snapshot();
  state.championship = null;
  return snap;
}
