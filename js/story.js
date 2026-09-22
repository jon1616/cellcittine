/*
  La storia della sfida (riassunto della serata) e i rivali.

  - positionsTimeline: posizione di ognuno dopo ogni manche (dalla storia della sfida,
    che tutti hanno: host e ospiti), per il grafico a linee.
  - challengeStory: le frasi del riassunto (partenza, cambi al comando, manche decisiva,
    rimonta più grande, record) e il testo da condividere.
  - rivals: dallo storico del telefono, con chi si è giocato di più e il bilancio.
  - revenge: sul podio, su chi ci si è presi la rivincita rispetto all'ultima volta.
*/

import { positionsAfter } from "./awards.js";
import { getEntry } from "./games/catalog.js";
import { getHistory } from "./storage.js";

// [{ round: k, pos: Map id -> posizione }] per k = 1..n
export function positionsTimeline(history, ids) {
  return history.map((_, k) => ({ round: k + 1, pos: positionsAfter(history, k + 1, ids) }));
}

function winners(ranking) {
  const best = ranking.find((r) => r.score !== null && r.score !== undefined && !r.out);
  return best ? ranking.filter((r) => r.score === best.score && !r.out).map((r) => r.id) : [];
}

// standings: classifica finale [{ id, name, points }]
export function challengeStory(history, standings, meId = null) {
  const ids = standings.map((s) => s.id);
  const name = (id) => standings.find((s) => s.id === id)?.name || "?";
  const title = (gameId) => getEntry(gameId)?.title || gameId;
  const n = history.length;
  const lines = [];
  if (n < 2 || ids.length < 2) return { lines, timeline: positionsTimeline(history, ids), decisive: null };
  const timeline = positionsTimeline(history, ids);
  const leaderAt = (k) => { const pos = timeline[k].pos; return ids.filter((id) => pos.get(id) === 1); };

  // Partenza
  const w1 = winners(history[0].ranking);
  if (w1.length === 1) lines.push({ icon: "🚀", text: `Partenza: ${name(w1[0])} vince ${title(history[0].gameId)}.` });
  else if (w1.length > 1) lines.push({ icon: "🤝", text: `Partenza in parità in ${title(history[0].gameId)}.` });

  // Cambi al comando (solo quando cambia chi è in testa da solo)
  const changes = [];
  let prev = leaderAt(0);
  for (let k = 1; k < n; k++) {
    const now = leaderAt(k);
    if (now.length === 1 && (prev.length !== 1 || prev[0] !== now[0])) changes.push({ round: k + 1, id: now[0], gameId: history[k].gameId });
    prev = now;
  }
  for (const c of changes.slice(-3)) lines.push({ icon: "👑", text: `Manche ${c.round} (${title(c.gameId)}): ${name(c.id)} prende la testa.` });
  if (changes.length > 3) lines.push({ icon: "🔁", text: `In tutto ${changes.length} cambi al comando: che sfida!` });

  // Manche decisiva: da quando chi vince è rimasto in testa fino alla fine
  const winner = standings[0];
  const tiedTop = standings.filter((s) => s.points === winner.points).length > 1;
  let decisive = null;
  if (!tiedTop) {
    let k = n - 1;
    while (k > 0 && leaderAt(k - 1).length === 1 && leaderAt(k - 1)[0] === winner.id) k--;
    decisive = k + 1;
    lines.push({ icon: "🏁", text: decisive === 1 ? `${name(winner.id)} in testa dalla prima manche all'ultima.` : `Manche decisiva: la ${decisive} (${title(history[decisive - 1].gameId)}), da lì ${name(winner.id)} non ha più mollato.` });
  } else lines.push({ icon: "🤝", text: "Finale in parità in testa: nessuno ha mollato." });

  // Rimonta più grande (dalla peggior posizione alla finale)
  let best = null;
  for (const id of ids) {
    const worst = Math.max(...timeline.map((t) => t.pos.get(id) || 0));
    const fin = timeline[n - 1].pos.get(id) || 0;
    const gain = worst - fin;
    if (gain >= 2 && (!best || gain > best.gain)) best = { id, gain, worst, fin };
  }
  if (best) lines.push({ icon: "📈", text: `Rimonta più grande: ${name(best.id)}, dal ${best.worst}º al ${best.fin}º posto.` });

  // Record personali e manche speciali
  const records = history.reduce((s, h) => s + h.ranking.filter((r) => r.record).length, 0);
  if (records) lines.push({ icon: "★", text: `${records} ${records === 1 ? "record personale battuto" : "record personali battuti"}.` });
  const specials = history.filter((h) => h.special).length;
  if (specials) lines.push({ icon: "🔥", text: `${specials} ${specials === 1 ? "manche speciale" : "manche speciali"}.` });
  if (meId) {
    const myPos = timeline[n - 1].pos.get(meId);
    if (myPos) lines.push({ icon: "📍", text: `Tu: ${myPos}º alla fine${changes.some((c) => c.id === meId) ? ", con almeno una manche in testa" : ""}.` });
  }
  return { lines, timeline, decisive };
}

export function storyText(story, standings, roomName = "") {
  const head = `Cellcittine · la storia della sfida${roomName ? ` “${roomName}”` : ""}`;
  const body = story.lines.map((l) => `${l.icon} ${l.text}`);
  const table = standings.map((s, i) => `${i + 1}. ${s.name} ${s.points} pt`);
  return [head, ...body, "", ...table, "https://jon1616.github.io/cellcittine/"].join("\n");
}

// ---------------------------------------------------------------
// Rivali (dallo storico del telefono)
// ---------------------------------------------------------------

// [{ id, name, together, myWins, theirWins }] ordinati per partite insieme
export function rivals(meId, history = getHistory()) {
  const map = new Map();
  for (const e of history) {
    if (e.solo || e.championship || !Array.isArray(e.players)) continue;
    const my = e.players.findIndex((p) => p.id === (e.meId || meId));
    if (my < 0) continue;
    e.players.forEach((p, i) => {
      if (i === my) return;
      const r = map.get(p.id) || { id: p.id, name: p.name, together: 0, myWins: 0, theirWins: 0 };
      r.name = p.name;
      r.together++;
      if (p.points !== e.players[my].points) { if (my < i) r.myWins++; else r.theirWins++; }
      map.set(p.id, r);
    });
  }
  return [...map.values()].sort((a, b) => b.together - a.together || b.myWins - a.myWins);
}

// Sul podio: su chi mi sono preso la rivincita (l'ultima volta insieme era davanti a me, ora sono davanti io)
export function revenge(meId, history = getHistory()) {
  const [now, ...past] = history.filter((e) => !e.solo && !e.championship && Array.isArray(e.players));
  if (!now) return [];
  const my = now.players.findIndex((p) => p.id === (now.meId || meId));
  if (my < 0) return [];
  const out = [];
  for (let i = my + 1; i < now.players.length; i++) {
    const other = now.players[i];
    if (other.points === now.players[my].points) continue;
    const last = past.find((e) => e.players.some((p) => p.id === other.id) && e.players.some((p) => p.id === (e.meId || meId)));
    if (!last) continue;
    const lm = last.players.findIndex((p) => p.id === (last.meId || meId)), lo = last.players.findIndex((p) => p.id === other.id);
    if (lo < lm && last.players[lo].points !== last.players[lm].points) {
      const r = rivals(meId, history).find((x) => x.id === other.id);
      out.push({ id: other.id, name: other.name, balance: r ? `${r.myWins} – ${r.theirWins}` : "" });
    }
  }
  return out;
}
