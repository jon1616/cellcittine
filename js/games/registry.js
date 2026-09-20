// Elenco dei minigiochi disponibili. Per aggiungerne uno: crea il file
// in js/games/, importalo qui e mettilo nella lista. Tutto il resto
// (lobby, timer, punteggi, sincronizzazione) è gestito dal telaio.

import semaforo from "./semaforo.js";

export const GAMES = [semaforo];

export function getGame(id) {
  return GAMES.find((g) => g.id === id);
}
