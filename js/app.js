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
import { applyPrefs } from "./utils.js";
import { detectPack } from "./screens/lobby.js";
import { showHome } from "./screens/home.js";
import { readInviteFromUrl, readDailyFromUrl, joinRoom, leaveRoom, playDaily } from "./room.js";
import { dailyKey, todayResult } from "./daily.js";

document.getElementById("version").textContent = `v${VERSION}`;
applyTheme();
applyPrefs();

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
    if (new URLSearchParams(location.search).has("tester")) return; // sotto il tester la ricarica falserebbe la prova
    reloading = true;
    location.reload();
  });
}

// Click leggero su ogni pulsante dell'interfaccia (i minigiochi hanno i loro suoni)
document.addEventListener("pointerdown", (ev) => {
  const btn = ev.target.closest("button");
  if (btn && !btn.closest(".game-area")) sfx.play("click");
}, { passive: true });

// Installazione: il browser (Android/Chrome) ci passa l'evento da usare col pulsante in home
window.addEventListener("beforeinstallprompt", (ev) => {
  ev.preventDefault();
  state.installPrompt = ev;
  if (state.screen === "home") showHome();
});
window.addEventListener("appinstalled", () => {
  state.installPrompt = null;
  if (state.screen === "home") showHome();
});

// In locale, lo stato è raggiungibile dalla console per prove e diagnosi
if (location.hostname === "localhost") window.cellcittine = { state };

// Arrivo da un link di invito (?stanza=XXXX)
state.pendingCode = readInviteFromUrl();
state.pendingDaily = readDailyFromUrl();
// Link alla Sfida del giorno: con il nome già scritto si parte subito (se oggi non è ancora fatta)
if (state.pendingDaily && !state.pendingCode && state.name && !todayResult(dailyKey())) {
  state.pendingDaily = null;
  playDaily();
} else if (state.pendingCode && state.name) {
  showHome(`Entro nella stanza ${state.pendingCode}…`, false);
  joinRoom(state.pendingCode)
    .then(() => { state.pendingCode = null; })
    .catch((err) => { leaveRoom(); showHome(err.message); });
} else {
  showHome();
}
