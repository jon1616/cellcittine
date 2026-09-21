/*
  Stato condiviso dell'app: un solo oggetto, importato da tutti i moduli.
  Chi cambia schermata chiama setScreen(); chi vuole sapere dove siamo legge state.screen.

  Schermate: "home" | "records" | "catalog" | "info" | "join" | "lobby" | "list" |
             "picker" | "countdown" | "game" | "results" | "final"
*/

import { loadConfig } from "./storage.js";
import { ALL_GAME_IDS } from "./games/catalog.js";

export const state = {
  screen: "home",
  net: null,                        // collegamento (Net) o null in home
  name: localStorage.getItem("name") || "",
  config: loadConfig(ALL_GAME_IDS), // configurazione della sfida (host)
  hostConfig: null,                 // copia ricevuta dall'host (guest)
  challenge: null,                  // { rounds, total, difficulty, index, standings: Map, history: [] }
  round: null,                      // { index, game, params, startAt, scores: Map, participants, deadline, my* }
  picker: null,                     // stato della schermata di scelta minigiochi
  infoBack: null,                   // dove torna la scheda di un minigioco
  pendingCode: null,                // codice stanza arrivato da un link di invito (?stanza=XXXX)
  installPrompt: null,              // evento beforeinstallprompt (Android/Chrome), se il browser lo offre
};

export function setScreen(name) {
  state.screen = name;
}

// Allenamento: c'è un Net, ma senza codice stanza.
export function isSolo() {
  return state.net?.code === null;
}
