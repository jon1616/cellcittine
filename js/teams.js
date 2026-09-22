/*
  Squadre: 2 o 3 squadre fisse (config.teams = 0 | 2 | 3). L'host assegna
  ogni persona a una squadra in stanza (player.team = 0 | 1 | 2); la scelta
  viaggia nella lista dei partecipanti.

  Punteggio: in ogni manche ogni persona prende i suoi punti come sempre;
  la squadra vale la MEDIA dei punti dei suoi membri (così squadre di
  grandezza diversa restano alla pari) e le squadre vengono classificate
  tra loro: la prima prende T punti, la seconda T-1… (T = squadre in gara,
  a pari media pari punti). Il podio finale è della squadra con più punti.
*/

export const TEAMS = [
  { id: 0, name: "Squadra Rossa", short: "Rossa", color: "#ff4d6d" },
  { id: 1, name: "Squadra Blu", short: "Blu", color: "#4cc9f0" },
  { id: 2, name: "Squadra Verde", short: "Verde", color: "#43d17a" },
];

export const TEAM_OPTIONS = [
  { id: 0, label: "Nessuna" },
  { id: 2, label: "2 squadre" },
  { id: 3, label: "3 squadre" },
];

export function teamInfo(index) {
  return TEAMS[index] ?? null;
}

// Distribuisce i partecipanti nelle squadre in modo bilanciato (ordine dato).
export function balancedAssignment(players, count) {
  return players.map((p, i) => ({ id: p.id, team: i % count }));
}

// La squadra con meno membri (per chi entra a squadre già fatte).
export function smallestTeam(players, count) {
  const sizes = Array.from({ length: count }, () => 0);
  for (const p of players) if (Number.isInteger(p.team) && p.team < count) sizes[p.team]++;
  let best = 0;
  for (let i = 1; i < count; i++) if (sizes[i] < sizes[best]) best = i;
  return best;
}

// Classifica delle squadre in una manche.
//   ranking: [{ id, points }] della manche · teamOf(id) -> indice squadra o null
// Ritorna [{ team, avg, members, points }] in ordine di classifica.
//   sum: true = Staffetta (somma dei punti invece della media)
export function teamRound(ranking, teamOf, sum = false) {
  const byTeam = new Map();
  for (const r of ranking) {
    const t = teamOf(r.id);
    if (!Number.isInteger(t)) continue;
    if (!byTeam.has(t)) byTeam.set(t, []);
    byTeam.get(t).push(r.points || 0);
  }
  const rows = [...byTeam.entries()]
    .map(([team, pts]) => ({ team, members: pts.length, sum, avg: sum ? pts.reduce((a, b) => a + b, 0) : Math.round((pts.reduce((a, b) => a + b, 0) / pts.length) * 10) / 10 }))
    .sort((a, b) => b.avg - a.avg);
  const n = rows.length;
  let pos = 0;
  rows.forEach((r, i) => {
    if (i === 0 || r.avg !== rows[i - 1].avg) pos = i;
    r.points = n - pos;
  });
  return rows;
}

export function formatAvg(avg) {
  return Number.isInteger(avg) ? String(avg) : String(avg).replace(".", ",");
}
