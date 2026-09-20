// Elenco dei minigiochi disponibili. Per aggiungerne uno: crea il file
// in js/games/, importalo qui e mettilo nella lista (e in PRECACHE in sw.js).
// Tutto il resto (stanza, manche, punteggi, sincronizzazione) è gestito dal telaio.

import semaforo from "./semaforo.js";
import memory from "./memory.js";
import sequenza from "./sequenza.js";
import numeri from "./numeri.js";
import bersagli from "./bersagli.js";
import calcoli from "./calcoli.js";
import colori from "./colori.js";
import precisione from "./precisione.js";
import salta from "./salta.js";
import intruso from "./intruso.js";
import frecce from "./frecce.js";
import palloncini from "./palloncini.js";
import dipiu from "./dipiu.js";

export const GAMES = [
  semaforo, memory, sequenza, numeri, bersagli, calcoli,
  colori, precisione, salta, intruso, frecce, palloncini, dipiu,
];

export function getGame(id) {
  return GAMES.find((g) => g.id === id);
}
