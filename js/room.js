/*
  Stanza: apertura (host), ingresso (guest), allenamento (solo) e uscita.
  Collega gli eventi di rete (net.js) alle schermate e alla sfida.
*/

import { Net } from "./net.js";
import { el } from "./utils.js";
import { state } from "./state.js";
import { setStatus, toast } from "./ui.js";
import { showHome } from "./screens/home.js";
import { showLobby, broadcastConfig } from "./screens/lobby.js";
import { handleMessage, checkRoundComplete, startChallenge } from "./challenge.js";
import { dailyPlan } from "./daily.js";
import { saveLastRoom, forgetLastRoom } from "./storage.js";
import { smallestTeam } from "./teams.js";

// ---------------------------------------------------------------
// Schermo sempre acceso dalla stanza al podio (Wake Lock API).
// Il blocco cade da solo quando l'app va in secondo piano: al ritorno lo
// richiediamo se siamo ancora in stanza. Se il telefono non lo supporta,
// non succede nulla.
// ---------------------------------------------------------------

let wakeLock = null;

async function keepScreenOn() {
  if (!("wakeLock" in navigator) || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => { wakeLock = null; });
  } catch (_) { /* negato (batteria bassa, permessi): pazienza */ }
}

function letScreenSleep() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && state.net) keepScreenOn();
  // Presenza: l'host mostra 💤 accanto a chi ha l'app in secondo piano
  const net = state.net;
  if (net && !net.isHost && net.code) net.sendToHost({ type: "presence", away: document.hidden });
});

function makeNet() {
  return new Net({
    onPlayers: () => {
      const net = state.net;
      if (net?.isHost) {
        // Con le squadre attive, chi entra senza squadra va nella più piccola
        const count = state.config.teams;
        let changed = false;
        for (const p of net.players) {
          if (count && !(Number.isInteger(p.team) && p.team < count)) { net.setTeam(p.id, smallestTeam(net.players, count)); changed = true; }
        }
        if (changed) net.broadcastPlayers();
        broadcastConfig();
        checkRoundComplete();
      }
      if (state.screen === "lobby") showLobby();
    },
    onMessage: handleMessage,
    onStatus: (text) => setStatus(text),
    // Linea con l'host persa e ritrovata (solo ospiti)
    onLink: (what) => {
      if (what === "lost") toast("Collegamento perso, mi ricollego…");
      else if (what === "back") toast("Ricollegato!");
    },
    onDisconnected: () => {
      leaveRoom();
      forgetLastRoom();
      showHome("La stanza è stata chiusa o non risponde più.");
    },
  });
}

// Chiude tutto: rete, manche in corso, sfida. Non cambia schermata.
export function leaveRoom() {
  letScreenSleep();
  state.round?.game?.unmount();
  clearTimeout(state.round?.deadline);
  state.net?.leave();
  state.net = null;
  state.round = null;
  state.challenge = null;
  state.hostConfig = null;
  state.championship = null;
}

export function exitButton(text = "Esci") {
  return el("button", {
    text,
    class: "secondary",
    onclick: () => {
      leaveRoom();
      forgetLastRoom();
      showHome();
    },
  });
}

export async function createRoom() {
  setStatus("Apro la stanza…");
  state.net = makeNet();
  try {
    await state.net.host(state.name);
    keepScreenOn();
    showLobby();
  } catch (err) {
    leaveRoom();
    setStatus(err.message, true);
  }
}

export async function joinRoom(code) {
  state.net = makeNet();
  try {
    await state.net.join(code, state.name);
    keepScreenOn();
    saveLastRoom(code); // se l'app si chiude per sbaglio, in home si può rientrare
    // Se rientrando abbiamo già ricevuto una manche o dei risultati, la schermata è già quella giusta
    if (!state.challenge) showLobby();
  } catch (err) {
    leaveRoom();
    throw err;
  }
}

// ---------------------------------------------------------------
// Invito con link: …/?stanza=XXXX
// ---------------------------------------------------------------

export function inviteLink(code) {
  return `${location.origin}${location.pathname}?stanza=${code}`;
}

// Menu di condivisione del telefono se c'è, altrimenti copia negli appunti.
export async function shareInvite(code) {
  const url = inviteLink(code);
  const text = `Entra nella mia stanza Cellcittine! Codice ${code}`;
  if (navigator.share) {
    try { await navigator.share({ title: "Cellcittine", text, url }); return; } catch (_) { /* annullato o non riuscito: copia */ }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast("Link copiato: incollalo in chat");
  } catch (_) {
    toast(`Codice stanza: ${code}`);
  }
}

// Legge ?stanza=XXXX dall'indirizzo (una volta sola) e lo toglie dalla barra,
// così ricaricare la pagina non tenta di rientrare.
export function readInviteFromUrl() {
  const code = new URLSearchParams(location.search).get("stanza");
  if (!code) return null;
  const keep = new URLSearchParams(location.search);
  keep.delete("stanza");
  history.replaceState(history.state, "", location.pathname + (keep.toString() ? `?${keep}` : ""));
  const clean = code.trim().toUpperCase();
  return /^[A-Z]{4}$/.test(clean) ? clean : null;
}

export function playSolo() {
  state.net = makeNet();
  state.net.solo(state.name);
  keepScreenOn();
  showLobby();
}

// Prova subito: un solo minigioco da soli, dalla sua scheda (senza passare dalla stanza)
export function playQuick(gameId) {
  state.net = makeNet();
  state.net.solo(state.name || "Tu");
  keepScreenOn();
  startChallenge({ games: [gameId], quick: true });
}

// Sfida del giorno: da soli, subito, con il piano di oggi (uguale per tutti)
export function playDaily() {
  const plan = dailyPlan();
  state.net = makeNet();
  state.net.solo(state.name);
  keepScreenOn();
  startChallenge({ games: plan.games, seeds: plan.seeds, difficulty: plan.difficulty, daily: { key: plan.key } });
}
