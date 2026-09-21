/*
  Tasto "indietro" di Android (e del browser).

  Fuori dalla home teniamo UNA voce fittizia nella cronologia ("guardia"):
  premere indietro la consuma e noi decidiamo dove andare (schermata
  precedente, oppure conferma con doppia pressione quando si perderebbe
  qualcosa). In home non c'è guardia: indietro chiude l'app, come sempre.

  Chi cambia schermata deve chiamare syncBackGuard() (lo fanno show() e
  showRaw() di ui.js; le schermate che non passano da lì lo chiamano a mano).
*/

import { state, isSolo } from "./state.js";
import { toast, hideToast } from "./ui.js";
import { leaveRoom } from "./room.js";
import { showHome } from "./screens/home.js";
import { showLobby } from "./screens/lobby.js";

let backGuard = false;     // c'è una voce fittizia in cima alla cronologia?
let ignoreNextPop = false; // stiamo consumando noi la guardia, non l'utente
let backArmedAt = 0;       // istante della prima pressione, per la doppia conferma

export function syncBackGuard() {
  if (state.screen !== "home" && !backGuard) {
    backGuard = true;
    history.pushState({ guard: true }, "");
  } else if (state.screen === "home" && backGuard) {
    backGuard = false;
    ignoreNextPop = true;
    history.back();
  }
}

// Azione da fare solo se si preme indietro due volte di seguito (entro 2,5 s).
function confirmBack(text, action) {
  if (Date.now() - backArmedAt < 2500) {
    backArmedAt = 0;
    hideToast();
    action();
  } else {
    backArmedAt = Date.now();
    toast(text);
  }
}

function exitToHome() {
  leaveRoom();
  showHome();
}

// Cosa fa "indietro" in ogni schermata.
function goBack() {
  const inRoom = state.net && !isSolo();
  switch (state.screen) {
    case "records":
    case "history":
    case "catalog":
    case "join":
      showHome();
      break;
    case "info":
      (state.infoBack || showHome)();
      break;
    case "list":
      showLobby();
      break;
    case "picker":
      state.picker?.done ? state.picker.done() : showLobby();
      break;
    case "lobby":
      if (!inRoom) exitToHome();
      else confirmBack("Premi ancora ◀ per uscire dalla stanza", exitToHome);
      break;
    case "countdown":
    case "game":
    case "results":
    case "final":
      confirmBack(inRoom ? "Premi ancora ◀ per abbandonare la sfida" : "Premi ancora ◀ per interrompere l'allenamento", exitToHome);
      break;
    default:
      showHome();
  }
}

window.addEventListener("popstate", () => {
  if (ignoreNextPop) { ignoreNextPop = false; return; }
  backGuard = false; // la voce fittizia è stata consumata dalla pressione
  if (state.screen === "home") return;
  goBack();
  syncBackGuard(); // se siamo ancora fuori dalla home, rimetti la guardia
});

// Una guardia rimasta da una sessione precedente (ricarica) non conta.
history.replaceState(null, "");
