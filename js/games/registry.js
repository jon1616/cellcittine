// Elenco dei minigiochi disponibili. Per aggiungerne uno: crea il file
// in js/games/, importalo qui e mettilo nella lista (e in PRECACHE in sw.js).
// Tutto il resto (stanza, manche, punteggi, sincronizzazione) è gestito dal telaio.

import semaforo from "./semaforo.js";
import memory from "./memory.js";
import sequenza from "./sequenza.js";
import numeri from "./numeri.js";
import bersagli from "./bersagli.js";
import calcoli from "./calcoli.js";

export const GAMES = [semaforo, memory, sequenza, numeri, bersagli, calcoli];

export function getGame(id) {
  return GAMES.find((g) => g.id === id);
}
