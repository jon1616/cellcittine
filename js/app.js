/*
  Avvio dell'app. La logica sta nei moduli:
    state.js        stato condiviso
    ui.js           mattoni dell'interfaccia (schermate, stato, toast, icone…)
    nav.js          tasto indietro
    room.js         stanza: crea / entra / allenamento / esci
    challenge.js    sfida e manche, punteggi, messaggi di rete
    screens/*.js    una schermata per file
*/

import { VERSION } from "./version.js";
import { sfx } from "./audio.js";
import { applyTheme } from "./theme.js";
import { state } from "./state.js";
import { detectPack } from "./screens/lobby.js";
import { showHome } from "./screens/home.js";
import { readInviteFromUrl, joinRoom, leaveRoom } from "./room.js";

document.getElementById("version").textContent = `v${VERSION}`;
applyTheme();

// Se la selezione salvata coincide con un pacchetto, mostralo col suo nome.
if (!state.config.pack) state.config.pack = detectPack(state.config.games);

// Service worker: offline e aggiornamenti automatici.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
  // Quando si attiva una versione nuova, ricarica una volta per usarla subito.
  const hadController = !!navigator.serviceWorker.controller; // false alla prima installazione
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading || !hadController) return;
    if (state.screen !== "home") return; // mai a metà partita
    reloading = true;
    location.reload();
  });
}

// Click leggero su ogni pulsante dell'interfaccia (i minigiochi hanno i loro suoni)
document.addEventListener("pointerdown", (ev) => {
  const btn = ev.target.closest("button");
  if (btn && !btn.closest(".game-area")) sfx.play("click");
}, { passive: true });

// Arrivo da un link di invito (?stanza=XXXX)
state.pendingCode = readInviteFromUrl();
if (state.pendingCode && state.name) {
  showHome(`Entro nella stanza ${state.pendingCode}…`, false);
  joinRoom(state.pendingCode)
    .then(() => { state.pendingCode = null; })
    .catch((err) => { leaveRoom(); showHome(err.message); });
} else {
  showHome();
}
