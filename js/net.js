/*
  Net: collegamento fra telefoni (P2P via PeerJS / WebRTC).

  Modello "host-arbitro": chi crea la stanza è l'host, tutte le altre
  giocatrici si collegano a lei. L'host decide cosa succede (minigioco,
  tempi, punteggi) e lo comunica a tutte; le altre mandano all'host solo
  i propri input/risultati.

  Il codice stanza (4 lettere) è parte dell'ID PeerJS dell'host:
  chi conosce il codice sa a chi collegarsi.
*/

const PREFIX = "cellcittine-";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // senza I e O: si confondono con 1 e 0

export function randomCode() {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

export class Net {
  constructor(handlers) {
    this.handlers = handlers;
    this.isHost = false;
    this.peer = null;
    this.code = null;
    this.me = null;          // { id, name, isHost }
    this.players = [];       // lista condivisa, nell'ordine di ingresso
    this.conns = new Map();  // host: peerId -> DataConnection
    this.hostConn = null;    // guest: connessione verso l'host
    this.timeOffset = 0;     // guest: hostTime - localTime
  }

  // Orologio comune: il tempo dell'host. Serve per far partire tutte insieme.
  now() {
    return Date.now() + this.timeOffset;
  }

  // ---------------------------------------------------------------
  // Modalità solo: nessuna rete, ma la stessa interfaccia.
  // ---------------------------------------------------------------
  solo(name) {
    this.isHost = true;
    this.me = { id: "me", name, isHost: true };
    this.players = [this.me];
    return Promise.resolve(null);
  }

  // ---------------------------------------------------------------
  // HOST
  // ---------------------------------------------------------------
  host(name, attempt = 0) {
    return new Promise((resolve, reject) => {
      const code = randomCode();
      const peer = new Peer(PREFIX + code, { debug: 1 });

      peer.on("open", (id) => {
        this.peer = peer;
        this.isHost = true;
        this.code = code;
        this.me = { id, name, isHost: true };
        this.players = [this.me];
        this._status(`Stanza ${code} aperta`);
        resolve(code);
      });

      peer.on("connection", (conn) => this._hostAccept(conn));

      peer.on("error", (err) => {
        if (err.type === "unavailable-id" && attempt < 5) {
          peer.destroy();
          resolve(this.host(name, attempt + 1));
          return;
        }
        reject(this._describe(err));
      });

      peer.on("disconnected", () => {
        // Persa la connessione al server di "presentazione": le partite in corso
        // continuano (sono dirette), ma nessuna nuova giocatrice può entrare.
        this._status("Collegamento al server perso, provo a ricollegarmi…");
        try { peer.reconnect(); } catch (_) { /* ignora */ }
      });
    });
  }

  _hostAccept(conn) {
    conn.on("open", () => {
      this.conns.set(conn.peer, conn);
    });

    conn.on("data", (msg) => {
      if (!msg || typeof msg !== "object") return;

      switch (msg.type) {
        case "join": {
          const name = String(msg.name || "Ospite").slice(0, 16);
          const player = { id: conn.peer, name, isHost: false };
          this.players = this.players.filter((p) => p.id !== conn.peer);
          this.players.push(player);
          conn.send({ type: "welcome", you: player, players: this.players, hostTime: Date.now() });
          this.broadcast({ type: "players", players: this.players });
          this.handlers.onPlayers?.(this.players);
          break;
        }
        case "ping":
          conn.send({ type: "pong", t0: msg.t0, t1: Date.now() });
          break;
        default:
          this.handlers.onMessage?.(msg, conn.peer);
      }
    });

    const drop = () => {
      this.conns.delete(conn.peer);
      const before = this.players.length;
      this.players = this.players.filter((p) => p.id !== conn.peer);
      if (this.players.length !== before) {
        this.broadcast({ type: "players", players: this.players });
        this.handlers.onPlayers?.(this.players);
      }
    };
    conn.on("close", drop);
    conn.on("error", drop);
  }

  // Host → tutte le giocatrici
  broadcast(msg) {
    for (const conn of this.conns.values()) {
      if (conn.open) conn.send(msg);
    }
  }

  // Host → una sola giocatrice
  sendTo(peerId, msg) {
    const conn = this.conns.get(peerId);
    if (conn?.open) conn.send(msg);
  }

  // ---------------------------------------------------------------
  // GUEST
  // ---------------------------------------------------------------
  join(code, name) {
    code = code.toUpperCase().trim();
    return new Promise((resolve, reject) => {
      const peer = new Peer(undefined, { debug: 1 });
      let settled = false;
      // Fase del collegamento, per dire con precisione dove si è fermato:
      //   "server"  = non abbiamo ancora raggiunto il server di presentazione
      //   "connect" = server raggiunto, stiamo cercando il telefono dell'host
      let phase = "server";

      const fail = (err) => {
        if (settled) return;
        settled = true;
        try { peer.destroy(); } catch (_) { /* ignora */ }
        reject(this._describe(err, phase, code));
      };

      const timeout = setTimeout(() => fail({ type: "timeout" }), 15000);

      peer.on("open", () => {
        this.peer = peer;
        phase = "connect";
        this._status("Cerco la stanza…");
        const conn = peer.connect(PREFIX + code, { reliable: true });

        conn.on("open", () => {
          this.hostConn = conn;
          this._status("Entro nella stanza…");
          conn.send({ type: "join", name });
        });

        conn.on("data", async (msg) => {
          if (!msg || typeof msg !== "object") return;

          switch (msg.type) {
            case "welcome":
              this.isHost = false;
              this.code = code;
              this.me = msg.you;
              this.players = msg.players;
              await this._syncClock(conn);
              clearTimeout(timeout);
              settled = true;
              this.handlers.onPlayers?.(this.players);
              resolve(code);
              break;
            case "players":
              this.players = msg.players;
              this.handlers.onPlayers?.(this.players);
              break;
            case "pong":
              this._pongResolve?.(msg);
              break;
            default:
              this.handlers.onMessage?.(msg, "host");
          }
        });

        conn.on("close", () => {
          clearTimeout(timeout);
          if (!settled) fail({ type: "peer-unavailable" });
          else this.handlers.onDisconnected?.();
        });
        conn.on("error", fail);
      });

      peer.on("error", fail);
    });
  }

  // Misura lo scarto fra l'orologio locale e quello dell'host.
  async _syncClock(conn) {
    let best = null;
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      const pong = await new Promise((res) => {
        this._pongResolve = res;
        conn.send({ type: "ping", t0 });
        setTimeout(() => res(null), 1000);
      });
      if (!pong) continue;
      const t2 = Date.now();
      const rtt = t2 - pong.t0;
      const offset = pong.t1 - (pong.t0 + rtt / 2);
      if (best === null || rtt < best.rtt) best = { rtt, offset };
    }
    this._pongResolve = null;
    this.timeOffset = best ? best.offset : 0;
  }

  // Guest → host
  sendToHost(msg) {
    if (this.hostConn?.open) this.hostConn.send(msg);
  }

  // ---------------------------------------------------------------
  // Comune
  // ---------------------------------------------------------------
  leave() {
    try { this.peer?.destroy(); } catch (_) { /* ignora */ }
    this.peer = null;
    this.conns.clear();
    this.hostConn = null;
    this.players = [];
    this.me = null;
    this.code = null;
    this.isHost = false;
  }

  _status(text) {
    this.handlers.onStatus?.(text);
  }

  // Messaggi per chi gioca: dicono dove si è fermato il collegamento e cosa provare.
  //   phase "server"  = il telefono non raggiunge il server di presentazione
  //   phase "connect" = la stanza c'è, ma i due telefoni non si collegano tra loro
  _describe(err, phase = null, code = "") {
    const type = err?.type || "";
    const SAME_NET = "Prova sulla stessa rete Wi‑Fi di chi ha creato la stanza, spegni la VPN, oppure usate l'hotspot di un telefono.";
    const map = {
      "peer-unavailable": `Stanza ${code || ""} non trovata. Controlla le 4 lettere (non ci sono mai I e O) e che chi l'ha creata sia ancora dentro.`.replace("  ", " "),
      "timeout": phase === "connect"
        ? `La stanza c'è, ma i due telefoni non riescono a collegarsi tra loro. ${SAME_NET}`
        : "Non riesco a raggiungere il server di collegamento. C'è connessione? Se sei sotto VPN o su un Wi‑Fi aziendale, prova con i dati del telefono.",
      "network": "Problema di rete: non raggiungo il server di collegamento. Controlla la connessione (o spegni la VPN) e riprova.",
      "browser-incompatible": "Questo browser non supporta il gioco in gruppo. Prova con Chrome o Safari.",
      "server-error": "Il server di collegamento non risponde. Riprova fra poco.",
      "unavailable-id": "Codice già in uso, riprova.",
      "webrtc": `Il collegamento diretto tra i telefoni non è riuscito. ${SAME_NET}`,
    };
    return new Error(map[type] || `Errore di collegamento (${type || err?.message || "sconosciuto"})`);
  }
}
