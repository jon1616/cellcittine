/*
  Ponte di rete (TURN): serve quando due telefoni non riescono a collegarsi
  direttamente (SIM con rete chiusa, uffici, VPN). Il ponte fa da passamano.

  Il gioco usa Open Relay di metered.ca (20 GB gratuiti al mese). Serve un
  account gratuito su https://www.metered.ca/ : nel pannello si trovano il
  nome dell'app (es. "cellcittine" → cellcittine.metered.live) e la API key.
  Quella chiave è fatta per stare nel codice dell'app (chi la legge può solo
  consumare la quota gratuita del ponte, nient'altro), ma la scelta di
  pubblicarla spetta a chi possiede l'account.

  Finché RELAY.app e RELAY.apiKey sono vuoti, il ponte è spento: si usano solo
  i server STUN (collegamento diretto), come prima.
*/

export const RELAY = {
  app: "",     // es. "cellcittine"
  apiKey: "",  // dal pannello di metered.ca
};

// Server sempre presenti: dicono a un telefono il suo indirizzo pubblico
const STUN_SERVERS = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: "stun:stun.relay.metered.ca:80" },
];

let cached = null;

// Elenco dei server per WebRTC: STUN, più il ponte se configurato.
// Le credenziali del ponte sono temporanee e vanno chieste ogni volta (con un
// limite di tempo: se il servizio non risponde si va avanti senza ponte).
export async function iceServers() {
  if (!RELAY.app || !RELAY.apiKey) return STUN_SERVERS;
  if (cached && cached.until > Date.now()) return cached.servers;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`https://${RELAY.app}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(RELAY.apiKey)}`, { signal: ctrl.signal });
    clearTimeout(timer);
    const list = await res.json();
    if (Array.isArray(list) && list.length) {
      cached = { servers: [...STUN_SERVERS, ...list], until: Date.now() + 10 * 60 * 1000 };
      return cached.servers;
    }
  } catch (_) { /* ponte non raggiungibile: si prova il diretto */ }
  return STUN_SERVERS;
}

export function relayEnabled() {
  return !!(RELAY.app && RELAY.apiKey);
}
