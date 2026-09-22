/*
  Net: collegamento fra telefoni (P2P via PeerJS / WebRTC).

  Modello "host-arbitro": chi crea la stanza è l'host, tutti gli altri si
  collegano a lui. L'host decide cosa succede (minigioco, tempi, punteggi)
  e lo comunica a tutti; gli altri mandano all'host solo i propri risultati.

  Il codice stanza (4 lettere) è parte dell'ID PeerJS dell'host:
  chi conosce il codice sa a chi collegarsi.

  Identità stabile: ogni telefono ha un id fisso (storage.getClientId) che
  manda nel "join". I partecipanti sono riconosciuti da quello, non dalla
  connessione: chi perde la linea e rientra ritrova nome, colore e punti.

  Ricollegamento: se un ospite perde la connessione con l'host, riprova da
  solo per RECONNECT_WINDOW ms (handlers.onLink: "lost" / "back" / "failed");
  i messaggi da mandare nel frattempo restano in coda. Solo se non ci riesce
  chiama handlers.onDisconnected.
*/

import { getClientId, getSeenGames } from "./storage.js";
import { iceServers } from "./relay.js";

const PREFIX = "cellcittine-";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // senza I e O: si confondono con 1 e 0
const COLORS = 8;                 // quante tinte diverse esistono (la palette sta in ui.js)
const JOIN_TIMEOUT = 15000;       // primo ingresso: tempo massimo totale
const RECONNECT_WINDOW = 30000;   // quanto a lungo un ospite riprova dopo aver perso la linea
const RECONNECT_EVERY = 2000;
const PHASE_MESSAGES = new Set(["start", "results", "final", "lobby", "champion"]); // l'ultimo viene rimandato a chi rientra

// Server per il collegamento fra telefoni (vedi relay.js): STUN per il collegamento
// diretto, più il ponte TURN se configurato. Con ?rete=ponte nell'indirizzo si usa
// SOLO il ponte (per provare che funzioni davvero).
async function peerOptions() {
  const forceRelay = new URLSearchParams(location.search).get("rete") === "ponte";
  return { debug: 1, config: { iceServers: await iceServers(), iceTransportPolicy: forceRelay ? "relay" : "all" } };
}

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
    this.me = null;          // { id, name, isHost, color }
    this.players = [];       // lista condivisa, nell'ordine di ingresso (id = id stabile del telefono)
    this.conns = new Map();  // host: id stabile -> DataConnection
    this.hostConn = null;    // guest: connessione verso l'host
    this.timeOffset = 0;     // guest: hostTime - localTime
    this.lastBroadcast = null; // host: ultimo messaggio "di fase", rimandato a chi rientra
    this.queue = [];         // guest: messaggi da mandare quando torna la linea
    this.seenBy = new Map(); // host: id -> minigiochi già giocati da quella persona (per la presentazione lunga)
    this.reconnecting = false;
    this._leaving = false;
    this._name = "";
  }

  // Orologio comune: il tempo dell'host. Serve per far partire tutti insieme.
  now() {
    return Date.now() + this.timeOffset;
  }

  // ---------------------------------------------------------------
  // Modalità solo: nessuna rete, ma la stessa interfaccia.
  // ---------------------------------------------------------------
  solo(name) {
    this.isHost = true;
    this.me = { id: getClientId(), name, isHost: true, color: 0 };
    this.players = [this.me];
    return Promise.resolve(null);
  }

  // ---------------------------------------------------------------
  // HOST
  // ---------------------------------------------------------------
  async host(name, attempt = 0) {
    const options = await peerOptions();
    return new Promise((resolve, reject) => {
      const code = randomCode();
      const peer = new Peer(PREFIX + code, options);

      peer.on("open", () => {
        this.peer = peer;
        this.isHost = true;
        this.code = code;
        this.me = { id: getClientId(), name, isHost: true, color: 0 };
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
        // continuano (sono dirette), ma nessuno di nuovo può entrare.
        this._status("Collegamento al server perso, provo a ricollegarmi…");
        try { peer.reconnect(); } catch (_) { /* ignora */ }
      });
    });
  }

  _hostAccept(conn) {
    conn.on("data", (msg) => {
      if (!msg || typeof msg !== "object") return;

      switch (msg.type) {
        case "join": {
          const id = String(msg.cid || conn.peer).slice(0, 40);
          const old = this.conns.get(id);
          if (old && old !== conn) { try { old.close(); } catch (_) { /* ignora */ } }
          this.conns.set(id, conn);
          conn.cid = id;

          // Rientro: stesso telefono, tiene nome, colore e (in challenge) punti.
          let player = this.players.find((p) => p.id === id);
          const rejoin = !!player;
          if (!player) {
            // Nome unico in stanza ("Giulia", "Giulia 2"…) e prima tinta libera
            const name = this._uniqueName(String(msg.name || "Ospite").trim().slice(0, 16) || "Ospite");
            player = { id, name, isHost: false, color: this._freeColor() };
            this.players.push(player);
          }
          if (Array.isArray(msg.seen)) this.seenBy.set(id, new Set(msg.seen.map(String)));
          delete player.away; // chi (ri)entra è presente
          conn.send({ type: "welcome", you: player, players: this.players, hostTime: Date.now() });
          // Chi rientra riceve il punto in cui siamo; chi è nuovo a sfida iniziata vede
          // i risultati correnti (giocherà dalla prossima manche), ma non una manche già partita.
          const last = this.lastBroadcast;
          if (last && (rejoin || last.type === "results" || last.type === "final")) conn.send(last);
          this.broadcast({ type: "players", players: this.players });
          this.handlers.onPlayers?.(this.players);
          break;
        }
        case "ping":
          conn.send({ type: "pong", t0: msg.t0, t1: Date.now() });
          break;
        default:
          if (conn.cid) this.handlers.onMessage?.(msg, conn.cid);
      }
    });

    const drop = () => {
      // Una connessione già sostituita da un rientro non conta più
      if (!conn.cid || this.conns.get(conn.cid) !== conn) return;
      this.conns.delete(conn.cid);
      const before = this.players.length;
      this.players = this.players.filter((p) => p.id !== conn.cid);
      if (this.players.length !== before) {
        this.broadcast({ type: "players", players: this.players });
        this.handlers.onPlayers?.(this.players);
      }
    };
    conn.on("close", drop);
    conn.on("error", drop);
  }

  _uniqueName(base) {
    const taken = (n) => this.players.some((p) => p.name.toLowerCase() === n.toLowerCase());
    let name = base;
    for (let i = 2; taken(name); i++) name = `${base} ${i}`;
    return name;
  }

  _freeColor() {
    const used = new Set(this.players.map((p) => p.color));
    for (let i = 0; i < COLORS; i++) if (!used.has(i)) return i;
    return this.players.length % COLORS;
  }

  // Host → tutti
  broadcast(msg) {
    if (PHASE_MESSAGES.has(msg.type)) this.lastBroadcast = msg;
    for (const conn of this.conns.values()) {
      if (conn.open) conn.send(msg);
    }
  }

  // Host: questa persona ha già giocato quel minigioco? (per sé stesso guarda il telefono)
  hasSeen(id, gameId) {
    if (this.me && id === this.me.id) return getSeenGames().includes(gameId);
    return this.seenBy.get(id)?.has(gameId) ?? true; // sconosciuto = non allungare
  }

  // Host: cambia la squadra di una persona e aggiorna tutti (senza richiamare onPlayers)
  setTeam(id, team) {
    const p = this.players.find((x) => x.id === id);
    if (!p) return;
    if (team === null) delete p.team; else p.team = team;
  }
  broadcastPlayers() {
    this.broadcast({ type: "players", players: this.players });
  }

  // Host → una sola persona (id stabile)
  sendTo(id, msg) {
    const conn = this.conns.get(id);
    if (conn?.open) conn.send(msg);
  }

  // ---------------------------------------------------------------
  // GUEST
  // ---------------------------------------------------------------
  async join(code, name) {
    code = code.toUpperCase().trim();
    this._name = name;
    this._leaving = false;
    let phase = "server"; // dove siamo arrivati, per un messaggio d'errore preciso
    let giveUpTimer = null;
    const giveUp = new Promise((_, rej) => { giveUpTimer = setTimeout(() => rej({ type: "timeout" }), JOIN_TIMEOUT); });
    giveUp.catch(() => {}); // se entriamo in tempo, il rifiuto tardivo non deve fare rumore
    try {
      await Promise.race([this._ensurePeer(), giveUp]);
      phase = "connect";
      this._status("Cerco la stanza…");
      await Promise.race([this._connectToHost(code, false), giveUp]);
      this.isHost = false;
      this.code = code;
      this.handlers.onPlayers?.(this.players);
      return code;
    } catch (err) {
      this.leave();
      throw this._describe(err, phase, code);
    } finally {
      clearTimeout(giveUpTimer);
    }
  }

  // Un Peer pronto (creato ora, o ricollegato al server se serve).
  async _ensurePeer() {
    const options = await peerOptions();
    return new Promise((resolve, reject) => {
      if (this.peer && !this.peer.destroyed && !this.peer.disconnected) return resolve();
      if (this.peer && !this.peer.destroyed) {
        // Server di presentazione perso: riaggancia lo stesso Peer
        const peer = this.peer;
        const onOpen = () => { peer.off("open", onOpen); peer.off("error", onErr); resolve(); };
        const onErr = (err) => { peer.off("open", onOpen); peer.off("error", onErr); reject(err); };
        peer.on("open", onOpen);
        peer.on("error", onErr);
        try { peer.reconnect(); } catch (err) { onErr(err); }
        return;
      }
      const peer = new Peer(undefined, options);
      peer.on("open", () => { this.peer = peer; resolve(); });
      peer.on("error", (err) => {
        if (this.peer !== peer) { try { peer.destroy(); } catch (_) { /* ignora */ } reject(err); }
        else if (err.type !== "peer-unavailable") this._status(this._describe(err).message);
      });
    });
  }

  // Apre la connessione dati verso l'host e aspetta il "welcome".
  _connectToHost(code, again) {
    return new Promise((resolve, reject) => {
      const conn = this.peer.connect(PREFIX + code, { reliable: true });
      let done = false;
      const settle = (fn, v) => { if (!done) { done = true; fn(v); } };
      const failTimer = setTimeout(() => settle(reject, { type: "timeout" }), 10000);

      conn.on("open", () => {
        this._status(again ? "Rientro nella stanza…" : "Entro nella stanza…");
        conn.send({ type: "join", name: this._name, cid: getClientId(), again, seen: getSeenGames() });
      });

      conn.on("data", async (msg) => {
        if (!msg || typeof msg !== "object") return;
        switch (msg.type) {
          case "welcome":
            this.hostConn = conn;
            this.me = msg.you;
            this.players = msg.players;
            await this._syncClock(conn);
            clearTimeout(failTimer);
            settle(resolve);
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
        clearTimeout(failTimer);
        if (!done) settle(reject, { type: "peer-unavailable" });
        else if (this.hostConn === conn) this._lost();
      });
      conn.on("error", (err) => {
        clearTimeout(failTimer);
        if (!done) settle(reject, err);
        else if (this.hostConn === conn) this._lost();
      });

      // PeerJS segnala "stanza inesistente" come errore del Peer, non della connessione
      const onPeerErr = (err) => {
        if (err.type === "peer-unavailable") { clearTimeout(failTimer); settle(reject, err); }
        this.peer?.off("error", onPeerErr);
      };
      this.peer.on("error", onPeerErr);
    });
  }

  // Linea con l'host persa: riprova per un po', poi si arrende.
  _lost() {
    if (this._leaving || this.reconnecting) return;
    this.reconnecting = true;
    this.hostConn = null;
    this.handlers.onLink?.("lost");
    const deadline = Date.now() + RECONNECT_WINDOW;
    const attempt = async () => {
      if (this._leaving) return;
      if (Date.now() > deadline) {
        this.reconnecting = false;
        this.handlers.onLink?.("failed");
        this.handlers.onDisconnected?.();
        return;
      }
      try {
        await this._ensurePeer();
        await this._connectToHost(this.code, true);
        this.reconnecting = false;
        this.handlers.onLink?.("back");
        this.handlers.onPlayers?.(this.players);
        this._flush();
      } catch (_) {
        setTimeout(attempt, RECONNECT_EVERY);
      }
    };
    setTimeout(attempt, 500);
  }

  _flush() {
    const pending = this.queue;
    this.queue = [];
    for (const msg of pending) this.sendToHost(msg);
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

  // Guest → host (in coda se la linea è momentaneamente persa)
  sendToHost(msg) {
    if (this.hostConn?.open) this.hostConn.send(msg);
    else if (this.reconnecting) this.queue.push(msg);
  }

  // ---------------------------------------------------------------
  // Comune
  // ---------------------------------------------------------------
  leave() {
    this._leaving = true;
    this.reconnecting = false;
    try { this.peer?.destroy(); } catch (_) { /* ignora */ }
    this.peer = null;
    this.conns.clear();
    this.hostConn = null;
    this.players = [];
    this.me = null;
    this.code = null;
    this.isHost = false;
    this.queue = [];
    this.lastBroadcast = null;
    this.seenBy.clear();
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
