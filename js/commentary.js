/*
  Il commentatore: una o due frasi dopo ogni manche, calcolate da tutti
  (host e ospiti) dalla stessa storia della sfida, così non viaggiano in rete.

  history = [{ gameId, ranking: [{ id, name, score, points, record }], special }]
  standings = [{ id, name, points }] dopo l'ultima manche, in ordine
  Ritorna [{ icon, text, mine }] (mine = riguarda chi guarda).
*/

import { positionsAfter } from "./awards.js";
import { getEntry } from "./games/catalog.js";

// Chi ha vinto la manche (tutti a pari punteggio col primo che ha giocato)
function winners(ranking) {
  const best = ranking.find((r) => r.score !== null && r.score !== undefined);
  return best ? ranking.filter((r) => r.score === best.score) : [];
}

// Punti massimi ancora in palio per una persona nelle manche restanti
// (con le manche speciali ogni manche potrebbe valere doppio: si resta prudenti)
function pointsLeft(remaining, players, hasSpecials) {
  if (remaining <= 0) return 0;
  return players * remaining * (hasSpecials ? 2 : 1);
}

export function commentRound({ history, standings, meId, total, hasSpecials = false }) {
  const out = [];
  const rounds = history.length;
  if (!rounds || standings.length < 2) return out;
  const last = history[rounds - 1];
  const ids = standings.map((s) => s.id);
  const name = (id) => standings.find((s) => s.id === id)?.name || "?";
  const add = (icon, text, who = null) => { if (out.length < 2) out.push({ icon, text, mine: who === meId }); };
  const before = positionsAfter(history, rounds - 1, ids);
  const after = positionsAfter(history, rounds, ids);
  const leader = standings[0];
  const coLeaders = standings.filter((s) => s.points === leader.points);
  const remaining = total - rounds;
  const w = winners(last.ranking);

  // 1) Chi comanda: sorpasso, pareggio in testa, vittoria matematica
  if (rounds === 1) {
    if (w.length === 1) add("🚀", `Si parte! ${name(w[0].id)} vince la prima manche.`, w[0].id);
    else if (w.length > 1) add("🤝", `Partenza in parità: ${w.map((x) => name(x.id)).join(" e ")} appaiati.`);
  } else if (coLeaders.length > 1) {
    add("🤝", `Testa a testa: ${coLeaders.map((s) => name(s.id)).join(" e ")} a ${leader.points} punti!`);
  } else if (before.get(leader.id) !== 1) {
    add("👑", `Sorpasso! ${name(leader.id)} vola in testa.`, leader.id);
  } else if (remaining > 0) {
    const second = standings[1];
    const gap = leader.points - second.points;
    const left = pointsLeft(remaining, standings.length, hasSpecials);
    if (gap > left) add("🏆", `${name(leader.id)} ha già vinto: nessuno può più raggiungere i suoi ${leader.points} punti.`, leader.id);
    else if (remaining === 1) add("🏁", `Ultima manche: ${name(leader.id)} guida di ${gap} ${gap === 1 ? "punto" : "punti"} su ${name(second.id)}. Si decide tutto ora!`);
  }

  // 2) Serie, rimonte, record
  let streak = 0;
  if (w.length === 1) {
    for (let i = rounds - 1; i >= 0; i--) {
      const wi = winners(history[i].ranking);
      if (wi.length === 1 && wi[0].id === w[0].id) streak++; else break;
    }
  }
  if (streak >= 3) add("🔥", `${name(w[0].id)}: ${streak} manche vinte di fila!`, w[0].id);
  else {
    let bestGain = 0, bestId = null;
    for (const id of ids) {
      const gain = (before.get(id) || 0) - (after.get(id) || 0);
      if (gain > bestGain) { bestGain = gain; bestId = id; }
    }
    if (bestGain >= 2) add("📈", `Rimonta di ${name(bestId)}: dal ${before.get(bestId)}º al ${after.get(bestId)}º posto.`, bestId);
    else {
      const rec = last.ranking.filter((r) => r.record);
      if (rec.length === 1) add("★", `${name(rec[0].id)} ha battuto il suo record personale in ${getEntry(last.gameId)?.title || "questa manche"}!`, rec[0].id);
      else if (rec.length > 1) add("★", `${rec.map((r) => name(r.id)).join(" e ")} hanno battuto il loro record!`);
      else if (w.length === 1 && rounds > 1 && before.get(w[0].id) === ids.length) add("💪", `${name(w[0].id)} dall'ultimo posto vince la manche!`, w[0].id);
    }
  }
  return out;
}

// Allenamento: confronto col record (una frase)
export function commentSolo({ game, score, record, isRecord, pct }) {
  if (score === null || score === undefined) return null;
  if (isRecord) return { icon: "★", text: "Nuovo record personale!" , mine: true };
  if (pct >= 95) return { icon: "💯", text: "Perfetto: massimo raggiunto!", mine: true };
  if (record && game) {
    return { icon: "🎯", text: `Il tuo record è ${record.text}: ${pct >= 80 ? "ci sei quasi" : "riprova, si può fare"}!`, mine: true };
  }
  return null;
}
