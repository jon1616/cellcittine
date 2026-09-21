/*
  Stanza: apertura (host), ingresso (guest), allenamento (solo) e uscita.
  Collega gli eventi di rete (net.js) alle schermate e alla sfida.
*/

import { Net } from "./net.js";
import { el } from "./utils.js";
import { state } from "./state.js";
import { setStatus } from "./ui.js";
import { showHome } from "./screens/home.js";
import { showLobby, broadcastConfig } from "./screens/lobby.js";
import { handleMessage, checkRoundComplete } from "./challenge.js";

function makeNet() {
  return new Net({
    onPlayers: () => {
      if (state.net?.isHost) {
        broadcastConfig();
        checkRoundComplete();
      }
      if (state.screen === "lobby") showLobby();
    },
    onMessage: handleMessage,
    onStatus: (text) => setStatus(text),
    onDisconnected: () => {
      leaveRoom();
      showHome("La stanza è stata chiusa.");
    },
  });
}

// Chiude tutto: rete, manche in corso, sfida. Non cambia schermata.
export function leaveRoom() {
  state.round?.game?.unmount();
  clearTimeout(state.round?.deadline);
  state.net?.leave();
  state.net = null;
  state.round = null;
  state.challenge = null;
  state.hostConfig = null;
}

export function exitButton(text = "Esci") {
  return el("button", {
    text,
    class: "secondary",
    onclick: () => {
      leaveRoom();
      showHome();
    },
  });
}

export async function createRoom() {
  setStatus("Apro la stanza…");
  state.net = makeNet();
  try {
    await state.net.host(state.name);
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
    showLobby();
  } catch (err) {
    leaveRoom();
    throw err;
  }
}

export function playSolo() {
  state.net = makeNet();
  state.net.solo(state.name);
  showLobby();
}
