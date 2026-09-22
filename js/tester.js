/*
  Tester: prova tutto il gioco in pochi secondi, dentro il browser (test.html).

  Tre gruppi di prove:
    Struttura     versione allineata, file elencati nel service worker esistenti,
                  schede del catalogo complete, pacchetti coerenti, manifest.
    Minigiochi    per ogni minigioco: il codice si carica (un errore di sintassi
                  viene scoperto qui), rispetta il contratto (vedi semaforo.js),
                  i parametri sono deterministici e trasmissibili in rete, e una
                  partita simulata (tocchi a caso, orologio accelerato) finisce
                  senza errori con un punteggio sensato.
    Allenamento   l'app vera dentro un riquadro: home → Allenamento → Inizia →
                  conto alla rovescia → minigioco → risultati → fine; poi Prova
                  subito "Senza fine": una partita, Fine al conto della seconda.

  L'orologio accelerato sostituisce performance.now / Date.now / setTimeout:
  una manche da 30 secondi dura un secondo e mezzo. requestAnimationFrame viene
  rifatto con setTimeout, così i test girano anche con la scheda in secondo piano
  (dove il browser sospenderebbe le animazioni e i timer dei minigiochi).
*/

import { CATALOG, CATEGORIES, PACES, ALL_GAME_IDS, loadGame } from "./games/catalog.js";
import { BUILTIN_PACKS, resolvePack } from "./packs.js";
import { getUserPacks, DIFFICULTIES } from "./storage.js";
import { VERSION } from "./version.js";
import { seededRandom, el } from "./utils.js";
import { sfx } from "./audio.js";
import { dailyPlan, dailyKey } from "./daily.js";
import { ratingOf, hasReference } from "./rating.js";

// ---------------------------------------------------------------
// Orologio accelerato (applicabile a qualsiasi finestra, anche un iframe)
// ---------------------------------------------------------------

function installWarp(win, getFactor) {
  const perf = win.performance;
  const realNow = perf.now.bind(perf);
  const realDateNow = win.Date.now;
  const realSetTimeout = win.setTimeout.bind(win);
  const realSetInterval = win.setInterval.bind(win);
  let anchorReal = realNow();
  let anchorWarp = anchorReal;
  let dateOffset = realDateNow() - anchorReal;
  let factor = getFactor();

  const now = () => {
    const f = getFactor();
    if (f !== factor) { // cambio di velocità senza salti nel tempo
      anchorWarp = anchorWarp + (realNow() - anchorReal) * factor;
      anchorReal = realNow();
      factor = f;
    }
    return anchorWarp + (realNow() - anchorReal) * factor;
  };
  perf.now = now;
  win.Date.now = () => Math.round(dateOffset + now());
  win.setTimeout = (fn, ms = 0, ...args) => realSetTimeout(fn, Math.max(0, ms) / getFactor(), ...args);
  win.setInterval = (fn, ms = 0, ...args) => realSetInterval(fn, Math.max(1, ms / getFactor()), ...args);
  // Fotogrammi: uno ogni 16 ms di tempo *di gioco* (quindi molto fitti quando
  // l'orologio corre), così i giochi che limitano il passo per fotogramma
  // avanzano comunque alla velocità giusta. Sotto i 4 ms setTimeout non
  // scende: si usa un MessageChannel, che non ha quel limite.
  let rafId = 0;
  const rafQueue = new Map();
  let frameScheduled = false;
  let frameAt = 0;
  const channel = new win.MessageChannel();
  const runFrame = () => {
    if (realNow() < frameAt - 0.05) { channel.port2.postMessage(0); return; } // troppo presto: ripassa
    frameScheduled = false;
    const cbs = [...rafQueue.values()];
    rafQueue.clear();
    const t = now();
    for (const cb of cbs) cb(t);
  };
  channel.port1.onmessage = runFrame;
  win.requestAnimationFrame = (cb) => {
    rafQueue.set(++rafId, cb);
    if (!frameScheduled) {
      frameScheduled = true;
      const delay = 16 / getFactor();
      frameAt = realNow() + delay;
      if (delay >= 4) realSetTimeout(runFrame, delay);
      else channel.port2.postMessage(0);
    }
    return rafId;
  };
  win.cancelAnimationFrame = (id) => { rafQueue.delete(id); };
  return { now, realNow, realSetTimeout, realSetInterval };
}

const speedSel = document.getElementById("optVelocita");
const getFactor = () => Number(speedSel.value) || 1;
const warp = installWarp(window, getFactor);
const realSleep = (ms) => new Promise((r) => warp.realSetTimeout(r, ms));

// ---------------------------------------------------------------
// Rapporto: sezioni e righe (✅ ok, ⚠️ avviso, ❌ errore)
// ---------------------------------------------------------------

const resultsEl = document.getElementById("results");
const summaryEl = document.getElementById("summary");
const logEl = document.getElementById("log");
const stage = document.getElementById("stage");
const stageTitle = document.getElementById("stageTitle");
const stageClock = document.getElementById("stageClock");
const counts = { ok: 0, warn: 0, fail: 0 };
const report = [];
let currentSection = null;

function section(title) {
  const h = el("h2", {}, [el("span", { text: title }), el("small", { text: "" })]);
  const box = el("div", { class: "section" }, [h]);
  resultsEl.append(box);
  currentSection = { box, small: h.lastChild, ok: 0, warn: 0, fail: 0 };
  report.push(`\n== ${title} ==`);
  return currentSection;
}

function row(status, label, msg = "") {
  const icon = { ok: "✅", warn: "⚠️", fail: "❌", running: "⏳" }[status];
  const r = el("div", { class: `row ${status}` }, [el("span", { text: icon }), el("div", {}, [el("div", { text: label }), el("div", { class: "msg", text: msg })])]);
  currentSection.box.append(r);
  if (status !== "running") tally(status, label, msg);
  return {
    // Una riga "in corso" si può chiudere dopo, con l'esito vero
    set(newStatus, newMsg = "") {
      r.className = `row ${newStatus}`;
      r.firstChild.textContent = { ok: "✅", warn: "⚠️", fail: "❌" }[newStatus];
      r.lastChild.lastChild.textContent = newMsg;
      tally(newStatus, label, newMsg);
    },
  };
}

function tally(status, label, msg) {
  counts[status]++;
  currentSection[status]++;
  const s = currentSection;
  s.small.textContent = [s.fail && `${s.fail} errori`, s.warn && `${s.warn} avvisi`, `${s.ok} ok`].filter(Boolean).join(" · ");
  report.push(`${{ ok: "OK  ", warn: "AVV ", fail: "ERR " }[status]} ${label}${msg ? ` — ${msg}` : ""}`);
  summaryEl.replaceChildren(
    el("span", { class: "ok", text: `${counts.ok} ok` }),
    el("span", { class: "warn", text: `${counts.warn} avvisi` }),
    el("span", { class: "fail", text: `${counts.fail} errori` })
  );
}

function log(text) {
  logEl.textContent += `${text}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

// Errori "volanti" (dentro timer, animazioni, eventi) attribuiti alla prova in corso
const flying = [];
window.addEventListener("error", (ev) => flying.push(ev.message || String(ev.error)));
window.addEventListener("unhandledrejection", (ev) => flying.push(`promise: ${ev.reason?.message || ev.reason}`));
function takeFlying() { return flying.splice(0, flying.length); }

// ---------------------------------------------------------------
// STRUTTURA
// ---------------------------------------------------------------

async function fetchText(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function testStruttura() {
  section("Struttura");

  // Versione: js/version.js e sw.js devono dire la stessa cosa
  let sw = "";
  try {
    sw = await fetchText("sw.js");
    const m = sw.match(/CACHE_VERSION\s*=\s*"([^"]+)"/);
    if (m && m[1] === VERSION) row("ok", `Versione ${VERSION}`, "version.js e sw.js allineati");
    else row("fail", "Versione non allineata", `version.js dice ${VERSION}, sw.js dice ${m ? m[1] : "?"}`);
  } catch (e) {
    row("fail", "sw.js non raggiungibile", e.message);
  }

  // File elencati nel service worker: devono esistere tutti (altrimenti niente offline né aggiornamenti)
  const precache = [...sw.matchAll(/"(\.\/[^"]*)"/g)].map((m) => m[1]);
  if (precache.length) {
    const missing = [];
    await Promise.all(precache.map(async (p) => {
      try {
        const res = await fetch(p, { cache: "no-store" });
        if (!res.ok) missing.push(`${p} (${res.status})`);
      } catch (_) { missing.push(p); }
    }));
    if (missing.length) row("fail", "File mancanti tra quelli elencati in sw.js", missing.join(", "));
    else row("ok", `${precache.length} file elencati in sw.js, tutti presenti`);

    const notListed = ALL_GAME_IDS.filter((id) => !precache.includes(`./js/games/${id}.js`));
    if (notListed.length) row("warn", "Minigiochi non elencati in sw.js (non funzioneranno offline)", notListed.join(", "));
    else row("ok", "Tutti i minigiochi sono elencati in sw.js");
  }

  // Catalogo: schede complete e coerenti
  const required = ["id", "title", "icon", "description", "howTo", "category", "skills", "theme", "duration", "pace", "input", "hands", "difficultyNote", "scoring", "added", "tags", "load"];
  const problems = [];
  const seen = new Set();
  for (const g of CATALOG) {
    if (seen.has(g.id)) problems.push(`${g.id}: id doppio`);
    seen.add(g.id);
    const missing = required.filter((k) => g[k] === undefined || g[k] === "" || (Array.isArray(g[k]) && g[k].length === 0));
    if (missing.length) problems.push(`${g.id}: manca ${missing.join(", ")}`);
    if (!CATEGORIES.some((c) => c.id === g.category)) problems.push(`${g.id}: categoria sconosciuta "${g.category}"`);
    if (!PACES[g.pace]) problems.push(`${g.id}: ritmo sconosciuto "${g.pace}"`);
    if (typeof g.load !== "function") problems.push(`${g.id}: load non è una funzione`);
    if (typeof g.duration !== "number") problems.push(`${g.id}: duration non è un numero`);
    if (typeof g.added === "string" && Number.isNaN(Date.parse(g.added))) problems.push(`${g.id}: data "${g.added}" non valida`);
  }
  if (problems.length) row("fail", "Schede del catalogo con problemi", problems.join(" · "));
  else row("ok", `${CATALOG.length} schede nel catalogo, tutte complete`);

  // Pacchetti: ogni id deve esistere nel catalogo
  const packProblems = [];
  for (const p of BUILTIN_PACKS) {
    const raw = typeof p.games === "function" ? p.games() : p.games;
    const unknown = raw.filter((id) => !ALL_GAME_IDS.includes(id));
    if (unknown.length) packProblems.push(`${p.name}: ${unknown.join(", ")}`);
    if (resolvePack(p).length === 0 && !p.optional) packProblems.push(`${p.name}: vuoto`); // "optional": può essere vuoto (es. Preferiti)
  }
  if (packProblems.length) row("fail", "Pacchetti integrati con id sconosciuti o vuoti", packProblems.join(" · "));
  else row("ok", `${BUILTIN_PACKS.length} pacchetti integrati coerenti`);
  const userPacks = getUserPacks();
  const userUnknown = userPacks.flatMap((p) => p.games.filter((id) => !ALL_GAME_IDS.includes(id)).map((id) => `${p.name}: ${id}`));
  if (userUnknown.length) row("warn", "Pacchetti personali con minigiochi che non esistono più", userUnknown.join(", "));
  else if (userPacks.length) row("ok", `${userPacks.length} pacchetti personali su questo dispositivo, tutti validi`);

  // Sfida del giorno: piano deterministico, 5 minigiochi diversi, riferimenti per la percentuale
  try {
    const a = dailyPlan("2026-01-01"), b = dailyPlan("2026-01-01"), c = dailyPlan("2026-01-02");
    const probs = [];
    if (JSON.stringify(a) !== JSON.stringify(b)) probs.push("stesso giorno, piano diverso");
    if (JSON.stringify(a.games) === JSON.stringify(c.games) && JSON.stringify(a.seeds) === JSON.stringify(c.seeds)) probs.push("due giorni con lo stesso piano");
    if (new Set(a.games).size !== a.games.length || a.games.length !== 5) probs.push(`minigiochi: ${a.games.join(", ")}`);
    if (a.games.some((id) => !ALL_GAME_IDS.includes(id))) probs.push("minigioco sconosciuto nel piano");
    const noRef = [];
    for (const g of CATALOG) {
      const game = await loadGame(g.id);
      const params = game.createParams(seededRandom(1), "normale");
      if (!hasReference(game, params)) noRef.push(g.id);
      else if (!Number.isFinite(ratingOf(game, 1, params))) probs.push(`${g.id}: percentuale non numerica`);
    }
    if (noRef.length) probs.push(`senza riferimento per la percentuale: ${noRef.join(", ")}`);
    if (probs.length) row("fail", "Sfida del giorno / percentuali con problemi", probs.join(" · "));
    else row("ok", `Sfida del giorno: piano di oggi (${dailyKey()}) = ${dailyPlan().games.join(", ")}; percentuali disponibili per tutti i minigiochi`);
  } catch (e) {
    row("fail", "Sfida del giorno non calcolabile", e.message);
  }

  // Manifest e icone
  try {
    const man = JSON.parse(await fetchText("manifest.webmanifest"));
    const icons = man.icons || [];
    const bad = [];
    for (const ic of icons) {
      const res = await fetch(ic.src, { cache: "no-store" }).catch(() => null);
      if (!res?.ok) bad.push(ic.src);
    }
    if (bad.length) row("fail", "Icone del manifest mancanti", bad.join(", "));
    else row("ok", `Manifest valido (${man.name || "senza nome"}, ${icons.length} icone)`);
  } catch (e) {
    row("fail", "Manifest non valido", e.message);
  }
}

// ---------------------------------------------------------------
// MINIGIOCHI
// ---------------------------------------------------------------

// I parametri viaggiano in rete come JSON: niente undefined, NaN, funzioni…
function findUnserializable(value, path = "params") {
  if (value === null || typeof value === "string" || typeof value === "boolean") return null;
  if (typeof value === "number") return Number.isFinite(value) ? null : `${path} = ${value}`;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const p = findUnserializable(value[i], `${path}[${i}]`);
      if (p) return p;
    }
    return null;
  }
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [k, v] of Object.entries(value)) {
      const p = findUnserializable(v, `${path}.${k}`);
      if (p) return p;
    }
    return null;
  }
  return `${path} è ${typeof value === "object" ? value.constructor?.name || "oggetto strano" : typeof value}`;
}

// La "scimmia": tocca, tiene premuto e trascina a caso dentro il telefono di prova.
// `doc`/`root` diversi da quelli della pagina quando il gioco sta in un iframe;
// `within` (selettore) limita i tocchi a quella zona: nell'app intera solo l'area di
// gioco, altrimenti la scimmia tocca "Prossima manche" prima del tester.
function makeMonkey(container, doc = document, root = container, within = null) {
  let stopped = false;
  let taps = 0;
  const inIframe = doc !== document;
  const W = doc.defaultView;
  // Coordinate nel sistema del documento in cui si tocca
  const rect = () => (inIframe ? { left: 0, top: 0, width: W.innerWidth, height: W.innerHeight } : container.getBoundingClientRect());
  const pt = () => {
    const r = rect();
    return { x: r.left + 8 + Math.random() * (r.width - 16), y: r.top + 8 + Math.random() * (r.height - 16) };
  };
  const allowed = (t) => !!t && root.contains(t) && !t.classList.contains("tap") && (!within || !!t.closest(within));
  const fire = (type, target, p, extra = {}) => {
    target.dispatchEvent(new W.PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true, pointerId: 1, isPrimary: true, pointerType: "touch",
      clientX: p.x, clientY: p.y, button: 0, buttons: type === "pointerup" ? 0 : 1, ...extra,
    }));
  };
  const ripple = (p) => {
    const r = rect();
    const dot = el("div", { class: "tap" });
    dot.style.left = `${p.x - r.left}px`;
    dot.style.top = `${p.y - r.top}px`;
    container.append(dot);
    warp.realSetTimeout(() => dot.remove(), 400);
  };
  // Se il punto non trova nulla (finestra ancora senza dimensioni), tocca un elemento a caso
  const fallback = () => {
    const all = [...root.querySelectorAll("*")].filter((n) => !n.classList.contains("tap"));
    return all.length ? all[Math.floor(Math.random() * all.length)] : null;
  };
  const loop = async () => {
    while (!stopped) {
      const p = pt();
      const target = doc.elementFromPoint(p.x, p.y) || fallback();
      if (allowed(target)) {
        taps++;
        ripple(p);
        fire("pointerdown", target, p);
        // a volte tiene premuto e trascina (per "tieni premuto" e "scorri"); durate in tempo di gioco
        const hold = (Math.random() < 0.35 ? 60 + Math.random() * 400 : 20) / getFactor();
        const q = Math.random() < 0.5 ? pt() : p;
        const steps = 3;
        for (let i = 1; i <= steps && !stopped; i++) {
          await realSleep(hold / steps);
          const m = { x: p.x + ((q.x - p.x) * i) / steps, y: p.y + ((q.y - p.y) * i) / steps };
          const t = doc.elementFromPoint(m.x, m.y);
          if (allowed(t)) fire("pointermove", t, m);
        }
        const up = doc.elementFromPoint(q.x, q.y) || target;
        if (!stopped && allowed(up)) {
          fire("pointerup", up, q);
          up.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, clientX: q.x, clientY: q.y }));
        }
      }
      await realSleep((120 + Math.random() * 300) / getFactor());
    }
  };
  loop();
  return { stop() { stopped = true; }, get taps() { return taps; } };
}

async function testGioco(entry, difficulty) {
  section(`${entry.icon} ${entry.title}`);
  stageTitle.textContent = `${entry.icon} ${entry.title}`;
  takeFlying();

  // 1. Il codice si carica (qui si scoprono gli errori di sintassi)
  let game;
  try {
    game = await loadGame(entry.id);
    row("ok", "Codice caricato");
  } catch (e) {
    row("fail", "Il codice non si carica", `${e.constructor.name}: ${e.message}`);
    return;
  }

  // 2. Contratto
  const contract = [];
  if (game.id !== entry.id) contract.push(`id "${game.id}" diverso dal catalogo`);
  if (!["asc", "desc"].includes(game.order)) contract.push(`order "${game.order}" (atteso asc/desc)`);
  if (!(Number.isFinite(game.maxSeconds) && game.maxSeconds > 0)) contract.push(`maxSeconds "${game.maxSeconds}"`);
  for (const fn of ["createParams", "formatScore", "isValidScore", "mount", "unmount"]) {
    if (typeof game[fn] !== "function") contract.push(`manca ${fn}()`);
  }
  if (contract.length) { row("fail", "Contratto non rispettato", contract.join(", ")); return; }
  if (game.maxSeconds < entry.duration) row("warn", "Scadenza di sicurezza più corta della durata", `maxSeconds ${game.maxSeconds} < duration ${entry.duration}`);
  else row("ok", `Contratto rispettato (${game.order === "asc" ? "vince il più basso" : "vince il più alto"}, max ${game.maxSeconds} s)`);

  // 3. Parametri: deterministici (stesso seme → stessi parametri) e trasmissibili
  let params = null;
  try {
    for (const d of DIFFICULTIES) {
      const a = game.createParams(seededRandom(12345), d.id);
      const b = game.createParams(seededRandom(12345), d.id);
      const bad = findUnserializable(a);
      if (bad) throw new Error(`${d.label}: ${bad} non si può mandare in rete`);
      if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${d.label}: stesso seme, parametri diversi (i telefoni non vedrebbero la stessa partita)`);
      if (d.id === difficulty) params = a;
      if (typeof game.maxScore === "function") {
        const mx = game.maxScore(a);
        if (!(mx === null || Number.isFinite(mx))) throw new Error(`${d.label}: maxScore() ha dato ${mx}`);
      }
    }
    row("ok", "Parametri deterministici e trasmissibili", `${JSON.stringify(params).length} caratteri a difficoltà ${difficulty}`);
  } catch (e) {
    row("fail", "Parametri con problemi", e.message);
    return;
  }

  // 4. Partita simulata
  const running = row("running", "Partita simulata", "in corso…");
  stage.replaceChildren();
  let finishCalls = 0;
  let finishScore, finishDetail;
  let resolveFinish;
  const finished = new Promise((r) => { resolveFinish = r; });
  const ctx = {
    params,
    difficulty,
    me: { id: "me", name: "Tester" },
    now: () => Date.now(),
    onFinish: (score, detail) => {
      finishCalls++;
      if (finishCalls === 1) { finishScore = score; finishDetail = detail; resolveFinish(); }
    },
  };
  const t0 = warp.realNow();
  let monkey = null;
  try {
    game.mount(stage, ctx);
  } catch (e) {
    running.set("fail", `mount() ha dato errore: ${e.message}`);
    try { game.unmount(); } catch (_) { /* ignora */ }
    return;
  }
  const problems = [];
  if (stage.childElementCount === 0) problems.push("dopo mount() lo schermo è vuoto");

  monkey = makeMonkey(stage);
  const limitMs = ((game.maxSeconds + 3) * 1000) / getFactor() + 500;
  const timedOut = await Promise.race([finished.then(() => false), realSleep(limitMs).then(() => true)]);
  monkey.stop();
  const played = ((warp.realNow() - t0) * getFactor()) / 1000;

  if (timedOut) {
    problems.push(`non è finito da solo entro ${game.maxSeconds + 3} s di gioco (serve un giocatore vero? in sfida chiude la scadenza di sicurezza)`);
  } else {
    if (!Number.isFinite(finishScore)) problems.push(`punteggio "${finishScore}" non è un numero`);
    if (!(finishDetail === null || finishDetail === undefined || typeof finishDetail === "string")) problems.push("detail non è una frase");
    try {
      const txt = game.formatScore(finishScore);
      if (typeof txt !== "string" || !txt) problems.push("formatScore() non dà un testo");
      if (typeof game.isValidScore(finishScore) !== "boolean") problems.push("isValidScore() non dà vero/falso");
    } catch (e) { problems.push(`formatScore/isValidScore: ${e.message}`); }
  }
  await realSleep(150); // il gioco può fare ancora qualcosa subito dopo la fine
  try { game.unmount(); } catch (e) { problems.push(`unmount() ha dato errore: ${e.message}`); }
  if (stage.querySelector(".game-area, .game-shell, canvas")) problems.push("dopo unmount() lo schermo non è stato ripulito");
  stage.replaceChildren();
  await realSleep(250); // timer o animazioni dimenticati si manifestano qui
  if (finishCalls > 1) problems.push(`onFinish chiamato ${finishCalls} volte (deve essere una sola)`);
  const errs = takeFlying();
  if (errs.length) problems.push(`errori durante la partita: ${[...new Set(errs)].join(" | ")}`);

  const outcome = timedOut
    ? `${monkey.taps} tocchi, nessuna fine`
    : `${monkey.taps} tocchi, finito dopo ${played.toFixed(1)} s di gioco: ${game.formatScore(finishScore)}${finishDetail ? ` (${finishDetail})` : ""}`;
  if (problems.some((p) => !p.startsWith("non è finito"))) running.set("fail", `${outcome} · ${problems.join(" · ")}`);
  else if (problems.length) running.set("warn", `${outcome} · ${problems.join(" · ")}`);
  else running.set("ok", outcome);
}

// ---------------------------------------------------------------
// ALLENAMENTO: l'app vera in un iframe, con l'orologio accelerato
// ---------------------------------------------------------------

async function testAllenamento(gameId, difficulty) {
  section("Allenamento (app intera)");
  stageTitle.textContent = "App · Allenamento";
  const running = row("running", "Manche di allenamento completa", "in corso…");

  // Le impostazioni dell'app vivono in localStorage: le mettiamo da parte e le rimettiamo dopo.
  const backup = Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]));
  const restore = () => {
    localStorage.clear();
    for (const [k, v] of Object.entries(backup)) localStorage.setItem(k, v);
  };
  localStorage.setItem("name", "Tester");
  localStorage.setItem("music", "off"); // niente musica durante il test
  localStorage.setItem("config", JSON.stringify({ games: [gameId], rounds: "tutti", difficulty, pack: null }));

  const iframe = el("iframe", { src: `index.html?tester=${Date.now()}`, title: "app" });
  stage.replaceChildren(iframe);
  const steps = [];
  const errors = [];
  let win, doc;
  const waitFor = async (what, test, ms) => {
    const until = warp.realNow() + ms;
    while (warp.realNow() < until) {
      let v = null;
      try { v = test(); } catch (_) { /* ancora niente */ }
      if (v) return v;
      await realSleep(50);
    }
    throw new Error(`aspettando: ${what}`);
  };
  const button = (text) => [...doc.querySelectorAll("button")].find((b) => b.textContent.replace(/^[^\p{L}\p{N}]+/u, "").trim().startsWith(text));

  try {
    await new Promise((res, rej) => { iframe.onload = res; iframe.onerror = rej; });
    win = iframe.contentWindow;
    doc = iframe.contentDocument;
    win.addEventListener("error", (ev) => errors.push(ev.message));
    win.addEventListener("unhandledrejection", (ev) => errors.push(`promise: ${ev.reason?.message || ev.reason}`));
    installWarp(win, getFactor);

    await waitFor("la home", () => button("Allenamento"), 8000);
    steps.push("home");
    const v = doc.getElementById("version")?.textContent.trim();
    if (v && !v.includes(VERSION)) errors.push(`la home mostra "${v}" ma version.js dice ${VERSION}`);
    const link = button("Tutti i");
    if (link && !link.textContent.includes(String(CATALOG.length))) errors.push(`la home dice "${link.textContent}" ma il catalogo ne ha ${CATALOG.length}`);

    button("Allenamento").click();
    const start = await waitFor("il pulsante Inizia!", () => button("Inizia!"), 3000);
    steps.push("lobby");
    if (start.disabled) throw new Error("Inizia! è disabilitato (nessun minigioco selezionato?)");
    start.click();

    const number = await waitFor("il conto alla rovescia", () => doc.querySelector("#app .game-area .big"), 3000);
    steps.push("conto alla rovescia");
    // Il conto alla rovescia sparisce quando il minigioco parte (o quando si torna alla lobby con un errore)
    await waitFor("la fine del conto alla rovescia", () => { doc.querySelector(".ready-btn")?.click(); return !doc.contains(number); }, 6000 / getFactor() + 3000);
    const status = doc.querySelector("#app .status.error")?.textContent;
    if (status) throw new Error(`invece del minigioco è comparso: "${status}"`);
    if (!doc.querySelector("#app .game-area")) throw new Error("dopo il conto alla rovescia non c'è nessun minigioco a schermo");
    steps.push("minigioco partito");

    const monkey = makeMonkey(stage, doc, doc.body, ".game-area");
    const game = await loadGame(gameId);
    try {
      await waitFor("i risultati della manche", () => doc.querySelector("#app .ranking"), ((game.maxSeconds + 12) * 1000) / getFactor() + 3000);
    } finally { monkey.stop(); }
    steps.push(`risultati (${monkey.taps} tocchi)`);
    if (!doc.getElementById("app").textContent.includes("Tester")) {
      const seen = doc.getElementById("app").textContent.replace(/s+/g, " ").trim().slice(0, 160);
      errors.push(`nei risultati non compare il nome del giocatore (a schermo: "${seen}" · nome salvato: "${win.localStorage.getItem("name")}" · config: ${win.localStorage.getItem("config")})`);
    }

    const finalBtn = await waitFor("il pulsante del risultato finale", () => button("Vedi il risultato finale"), 3000);
    finalBtn.click();
    await waitFor("la schermata finale", () => /completat/i.test(doc.querySelector("#app")?.textContent || ""), 3000);
    steps.push("fine");
    // Statistiche: la manche appena giocata deve risultare
    button("Cambia impostazioni")?.click();
    (await waitFor("il pulsante Esci", () => button("Esci"), 3000)).click();
    (await waitFor("la home", () => button("Statistiche"), 3000)).click();
    await waitFor("le statistiche", () => /Le mie statistiche/.test(doc.querySelector("#app")?.textContent || ""), 3000);
    const stats = JSON.parse(win.localStorage.getItem("stats") || "{}");
    if (!stats[gameId] || stats[gameId].n < 1) errors.push(`le statistiche non registrano la manche di ${gameId}: ${JSON.stringify(stats)}`);
    else steps.push("statistiche");
  } catch (e) {
    errors.push(e.message);
  }

  await realSleep(200);
  iframe.remove();
  restore();
  const path = steps.join(" → ");
  if (errors.length) running.set("fail", `${path || "niente"} · ${[...new Set(errors)].join(" · ")}`);
  else running.set("ok", `${path} (minigioco "${CATALOG.find((g) => g.id === gameId)?.title}", difficoltà ${difficulty})`);
}

// ---------------------------------------------------------------
// PROVA SUBITO SENZA FINE: catalogo → scheda → "Senza fine" → una partita →
// al conto della seconda si preme Fine → podio della serie con una partita
// ---------------------------------------------------------------

async function testProvaSubito(gameId) {
  section("Prova subito senza fine (app intera)");
  stageTitle.textContent = "App · Prova subito";
  const running = row("running", "Serie senza fine: una partita, poi Fine", "in corso…");
  const backup = Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]));
  const restore = () => { localStorage.clear(); for (const [k, v] of Object.entries(backup)) localStorage.setItem(k, v); };
  localStorage.setItem("name", "Tester");
  localStorage.setItem("music", "off");
  localStorage.removeItem("stats");
  localStorage.removeItem("quickSeries");

  const iframe = el("iframe", { src: `index.html?tester=${Date.now()}`, title: "app" });
  stage.replaceChildren(iframe);
  const steps = [];
  const errors = [];
  let win, doc;
  const waitFor = async (what, test, ms) => {
    const until = warp.realNow() + ms;
    while (warp.realNow() < until) {
      let v = null;
      try { v = test(); } catch (_) { /* ancora niente */ }
      if (v) return v;
      await realSleep(50);
    }
    throw new Error(`aspettando: ${what}`);
  };
  const button = (text) => [...doc.querySelectorAll("button")].find((b) => b.textContent.replace(/^[^\p{L}\p{N}]+/u, "").trim().startsWith(text));
  const entry = CATALOG.find((g) => g.id === gameId);

  try {
    await new Promise((res, rej) => { iframe.onload = res; iframe.onerror = rej; });
    win = iframe.contentWindow;
    doc = iframe.contentDocument;
    win.addEventListener("error", (ev) => errors.push(ev.message));
    win.addEventListener("unhandledrejection", (ev) => errors.push(`promise: ${ev.reason?.message || ev.reason}`));
    installWarp(win, getFactor);

    await waitFor("la home", () => button("Allenamento"), 8000);
    const link = button("Tutti i");
    if (!link) throw new Error("in home manca il pulsante del catalogo (Tutti i N minigiochi)");
    link.click();
    steps.push("catalogo");
    const rowEl = await waitFor("la riga del minigioco nel catalogo", () => [...doc.querySelectorAll(".game-row")].find((r) => r.textContent.includes(entry.title)), 3000);
    rowEl.click();
    await waitFor("la scheda del minigioco", () => button("Prova subito"), 3000);
    steps.push("scheda");
    const seg = await waitFor("la scelta Senza fine", () => [...doc.querySelectorAll(".seg")].find((b) => b.textContent === "Senza fine"), 2000);
    seg.click();
    (await waitFor("il pulsante Gioca senza fine", () => button("Gioca senza fine"), 2000)).click();
    steps.push("serie avviata");

    const number = await waitFor("il conto alla rovescia", () => doc.querySelector("#app .game-area .big"), 3000);
    await waitFor("la fine del conto alla rovescia", () => { doc.querySelector(".ready-btn")?.click(); return !doc.contains(number); }, 6000 / getFactor() + 3000);
    if (!doc.querySelector("#app .game-area")) throw new Error("dopo il conto alla rovescia non c'è nessun minigioco a schermo");
    if (!doc.querySelector("#app .series-end")) errors.push("nel minigioco manca il pulsante Fine della serie");
    steps.push("partita 1");

    const monkey = makeMonkey(stage, doc, doc.body, ".game-area");
    const game = await loadGame(gameId);
    let countdown2;
    try {
      countdown2 = await waitFor("il conto alla rovescia della seconda partita", () => { const a = doc.querySelector("#app .game-area.countdown"); return a && /Partita 2/.test(a.textContent) ? a : null; }, ((game.maxSeconds + 12) * 1000) / getFactor() + 3000);
    } finally { monkey.stop(); }
    steps.push(`partita 2 (${monkey.taps} tocchi)`);
    if (!/Finora 1 partita/.test(countdown2.textContent)) errors.push(`al conto della seconda partita manca il riassunto "Finora 1 partita": "${countdown2.textContent.replace(/\s+/g, " ").trim().slice(0, 120)}"`);
    const fine = countdown2.querySelector(".series-end");
    if (!fine) throw new Error("nel conto alla rovescia manca il pulsante Fine");
    fine.click();
    await waitFor("il podio della serie", () => /Serie finita/.test(doc.querySelector("#app")?.textContent || ""), 3000);
    steps.push("fine");
    const big = doc.querySelector("#app .series-big")?.textContent || "";
    if (!/^1 partita/.test(big)) errors.push(`il podio dice "${big}" invece di "1 partita di fila"`);
    const stats = JSON.parse(win.localStorage.getItem("stats") || "{}");
    if (!stats[gameId] || stats[gameId].n !== 1) errors.push(`le statistiche dovrebbero contare 1 partita di ${gameId}: ${JSON.stringify(stats[gameId] || null)}`);
    else steps.push("statistiche");
    (await waitFor("il pulsante della scheda", () => button("Scheda del minigioco"), 2000)).click();
    await waitFor("la scheda di nuovo", () => button("Gioca senza fine"), 3000);
    steps.push("scheda di nuovo");
  } catch (e) {
    errors.push(e.message);
  }

  await realSleep(200);
  iframe.remove();
  restore();
  const path = steps.join(" → ");
  if (errors.length) running.set("fail", `${path || "niente"} · ${[...new Set(errors)].join(" · ")}`);
  else running.set("ok", `${path} (minigioco "${entry?.title}")`);
}

// ---------------------------------------------------------------
// SFIDA DEL GIORNO: l'app vera in un iframe, cinque manche di fila
// ---------------------------------------------------------------

async function testSfidaDelGiorno() {
  section("Sfida del giorno (app intera)");
  stageTitle.textContent = "App · Sfida del giorno";
  const running = row("running", "Sfida del giorno completa", "in corso…");
  const backup = Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]));
  const restore = () => { localStorage.clear(); for (const [k, v] of Object.entries(backup)) localStorage.setItem(k, v); };
  localStorage.setItem("name", "Tester");
  localStorage.setItem("music", "off");
  localStorage.removeItem("daily");

  const iframe = el("iframe", { src: `index.html?tester=${Date.now()}`, title: "app" });
  stage.replaceChildren(iframe);
  const steps = [];
  const errors = [];
  let win, doc;
  const waitFor = async (what, test, ms) => {
    const until = warp.realNow() + ms;
    while (warp.realNow() < until) {
      let v = null;
      try { v = test(); } catch (_) { /* ancora niente */ }
      if (v) return v;
      await realSleep(50);
    }
    throw new Error(`aspettando: ${what}`);
  };
  const button = (text) => [...doc.querySelectorAll("button")].find((b) => b.textContent.replace(/^[^\p{L}\p{N}]+/u, "").trim().startsWith(text));
  const plan = dailyPlan();
  try {
    await new Promise((res, rej) => { iframe.onload = res; iframe.onerror = rej; });
    win = iframe.contentWindow;
    doc = iframe.contentDocument;
    win.addEventListener("error", (ev) => errors.push(ev.message));
    win.addEventListener("unhandledrejection", (ev) => errors.push(`promise: ${ev.reason?.message || ev.reason}`));
    installWarp(win, getFactor);
    const trace = [];
    win.__trace = (s) => trace.push(`${((warp.realNow() - t0) / 1000).toFixed(2)}s ${s}`);
    const t0 = warp.realNow();
    const tstep = (s) => win.__trace(`[tester] ${s}`);
    win.__traceLog = () => trace;
    (await waitFor("la home", () => button("Gioca la sfida di oggi"), 8000)).click();
    steps.push("home");
    for (let i = 0; i < plan.games.length; i++) {
      const game = await loadGame(plan.games[i]);
      const number = await waitFor(`il conto alla rovescia ${i + 1}`, () => doc.querySelector("#app .game-area .big"), 5000);
      tstep(`countdown ${i + 1} trovato: "${number.textContent}" in ${number.parentElement?.className}`);
      await waitFor("la fine del conto alla rovescia", () => { doc.querySelector(".ready-btn")?.click(); return !doc.contains(number); }, 8000 / getFactor() + 3000);
      tstep(`countdown ${i + 1} finito; screen ${win.cellcittine?.state?.screen}`);
      const monkey = makeMonkey(stage, doc, doc.body, ".game-area");
      try {
        await waitFor(`i risultati della manche ${i + 1}`, () => doc.querySelector("#app .ranking"), ((game.maxSeconds + 12) * 1000) / getFactor() + 3000);
      } finally { monkey.stop(); }
      tstep(`ranking ${i + 1} trovato; screen ${win.cellcittine?.state?.screen}`);
      const shown = doc.getElementById("app").textContent.match(/Manche (d+) di/)?.[1];
      if (shown && Number(shown) !== i + 1) errors.push(`dopo la manche ${i + 1} a schermo c'è "Manche ${shown}" (sfida.index ${win.cellcittine?.state?.challenge?.index}, round.index ${win.cellcittine?.state?.round?.index})`);
      steps.push(`${game.title}`);
      let next;
      try {
        next = await waitFor("il pulsante di avanzamento", () => button(i === plan.games.length - 1 ? "Vedi il risultato finale" : "Prossima manche"), 3000);
      } catch (e) {
        const st = win.cellcittine?.state;
        throw new Error(`${e.message} (schermata: ${st?.screen}, sfida.index ${st?.challenge?.index}, round.index ${st?.round?.index}, storia ${st?.challenge?.history?.map((h) => h.gameId).join(">")}, a schermo: "${doc.getElementById("app").textContent.replace(/s+/g, " ").trim().slice(0, 160)}")`);
      }
      tstep(`click "${next.textContent}"`);
      next.click();
    }
    await waitFor("il podio della sfida del giorno", () => /Sfida del giorno/.test(doc.querySelector("#app h2")?.textContent || ""), 4000);
    const txt = doc.getElementById("app").textContent;
    if (!/punti/.test(txt)) errors.push("nel podio non compare il totale in punti");
    if (!button("Condividi")) errors.push("manca il pulsante Condividi");
    const saved = JSON.parse(win.localStorage.getItem("daily") || "{}");
    const today = saved[dailyKey()];
    if (!today || !Number.isFinite(today.total) || today.rounds?.length !== plan.games.length) errors.push(`risultato del giorno non salvato: ${JSON.stringify(today)}`);
    else steps.push(`podio (${today.total} punti)`);
  } catch (e) {
    errors.push(e.message);
  }
  if (errors.length && win?.__traceLog) log(win.__traceLog().join(String.fromCharCode(10)));
  await realSleep(200);
  iframe.remove();
  restore();
  const path = steps.join(" → ");
  if (errors.length) running.set("fail", `${path || "niente"} · ${[...new Set(errors)].join(" · ")}`);
  else running.set("ok", path);
}

// ---------------------------------------------------------------
// MULTIPLAYER: host e ospite in due riquadri, una manche insieme (tempo reale:
// il collegamento passa dal server pubblico di PeerJS e i suoi tempi non si
// possono accelerare). Se il server non risponde, la prova è un avviso, non un errore.
// ---------------------------------------------------------------

async function testMultiplayer() {
  section("Multiplayer (host + ospite)");
  stageTitle.textContent = "App · Multiplayer";
  const running = row("running", "Una manche in due", "in corso…");
  const backup = Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]));
  const restore = () => { localStorage.clear(); for (const [k, v] of Object.entries(backup)) localStorage.setItem(k, v); };
  localStorage.setItem("name", "Tester");
  localStorage.setItem("music", "off");
  localStorage.setItem("sound", "off");
  localStorage.setItem("seen", JSON.stringify(["tocchi"]));
  localStorage.setItem("config", JSON.stringify({ games: ["tocchi"], rounds: "tutti", difficulty: "normale", pack: null, auto: false, teams: 0, special: false, championship: false, mode: "punti" }));

  const stamp = Date.now();
  const mk = (cid) => el("iframe", { src: `index.html?tester=${stamp}&cid=${cid}`, title: cid, class: "half" });
  const A = mk("host-" + stamp), B = mk("guest-" + stamp);
  stage.replaceChildren(A, B);
  const steps = [];
  const errors = [];
  let skip = null;
  const load = (f) => new Promise((res, rej) => { f.onload = res; f.onerror = rej; });
  const waitFor = async (what, test, ms) => {
    const until = warp.realNow() + ms;
    while (warp.realNow() < until) {
      let v = null;
      try { v = test(); } catch (_) { /* ancora niente */ }
      if (v) return v;
      await realSleep(100);
    }
    throw new Error(`aspettando: ${what}`);
  };
  const button = (doc, text) => [...doc.querySelectorAll("button")].find((b) => b.textContent.replace(/^[^\p{L}\p{N}]+/u, "").trim().startsWith(text));
  const monkeys = [];
  try {
    await Promise.all([load(A), load(B)]);
    const [wa, wb] = [A.contentWindow, B.contentWindow];
    const [da, db] = [A.contentDocument, B.contentDocument];
    for (const w of [wa, wb]) {
      w.addEventListener("error", (ev) => errors.push(ev.message));
      w.addEventListener("unhandledrejection", (ev) => errors.push(`promise: ${ev.reason?.message || ev.reason}`));
    }
    await waitFor("le home", () => button(da, "Crea una stanza") && button(db, "Entra con un codice"), 8000);
    button(da, "Crea una stanza").click();
    let code;
    try {
      code = await waitFor("il codice della stanza", () => da.querySelector(".code-big")?.textContent?.trim(), 20000);
    } catch (e) {
      skip = `server di collegamento non raggiunto (${da.querySelector(".status")?.textContent || e.message})`;
      throw e;
    }
    steps.push(`stanza ${code}`);
    button(db, "Entra con un codice").click();
    const input = await waitFor("il campo del codice", () => db.querySelector("#app input"), 3000);
    input.value = code;
    input.dispatchEvent(new wb.Event("input", { bubbles: true }));
    [...db.querySelectorAll("button")].find((b) => /^Entra/.test(b.textContent.trim()) && !/codice/.test(b.textContent)).click();
    await waitFor("l'ospite in stanza", () => /In stanza \(2\)/.test(da.getElementById("app").textContent) && /In stanza \(2\)/.test(db.getElementById("app").textContent), 25000);
    steps.push("ospite entrato");
    button(da, "Inizia la sfida!").click();
    await waitFor("il conto alla rovescia su entrambi", () => da.querySelector(".game-area .big") && db.querySelector(".game-area .big"), 8000);
    steps.push("conto alla rovescia");
    await waitFor("la manche su entrambi", () => { da.querySelector(".ready-btn")?.click(); db.querySelector(".ready-btn")?.click(); return da.querySelector(".game-shell") && db.querySelector(".game-shell"); }, 12000);
    monkeys.push(makeMonkey(stage, da, da.body, ".game-area"), makeMonkey(stage, db, db.body, ".game-area"));
    await waitFor("i risultati su entrambi", () => da.querySelector("#app .ranking") && db.querySelector("#app .ranking"), 40000);
    monkeys.forEach((m) => m.stop());
    steps.push("risultati");
    const names = ["Tester", "Tester 2"];
    for (const [who, doc] of [["host", da], ["ospite", db]]) {
      const txt = doc.getElementById("app").textContent;
      for (const n of names) if (!txt.includes(n)) errors.push(`${who}: nei risultati manca "${n}"`);
    }
    if (!da.querySelector(".group-record") || !db.querySelector(".group-record")) errors.push("manca la riga del record del gruppo nei risultati");
    (await waitFor("il pulsante del risultato finale", () => button(da, "Vedi il risultato finale"), 5000)).click();
    await waitFor("il podio su entrambi", () => /Fine della sfida/.test(da.getElementById("app").textContent) && /Fine della sfida/.test(db.getElementById("app").textContent), 8000);
    steps.push("podio");
  } catch (e) {
    if (!skip) errors.push(e.message);
  }
  monkeys.forEach((m) => m.stop());
  await realSleep(300);
  try { A.contentWindow.cellcittine?.state?.net?.leave(); } catch (_) { /* già chiuso */ }
  try { B.contentWindow.cellcittine?.state?.net?.leave(); } catch (_) { /* già chiuso */ }
  A.remove(); B.remove();
  restore();
  const path = steps.join(" → ");
  if (skip) running.set("warn", `prova saltata: ${skip}`);
  else if (errors.length) running.set("fail", `${path || "niente"} · ${[...new Set(errors)].join(" · ")}`);
  else running.set("ok", path);
}

// ---------------------------------------------------------------
// Avvio
// ---------------------------------------------------------------

const gameSel = document.getElementById("optGioco");
gameSel.append(el("option", { value: "*", text: "Tutti i minigiochi" }));
for (const g of CATALOG) gameSel.append(el("option", { value: g.id, text: `${g.icon} ${g.title}` }));

const btnAvvia = document.getElementById("btnAvvia");
const btnCopia = document.getElementById("btnCopia");

async function run() {
  btnAvvia.disabled = true;
  btnCopia.disabled = true;
  resultsEl.replaceChildren();
  logEl.textContent = "";
  report.length = 0;
  counts.ok = counts.warn = counts.fail = 0;
  summaryEl.replaceChildren();
  const soundWas = sfx.isEnabled();
  sfx.setEnabled(false); // niente suoni durante i test (rimessi come prima alla fine)
  const t0 = warp.realNow();
  const difficulty = document.getElementById("optDifficolta").value;
  const only = gameSel.value;
  const games = only === "*" ? CATALOG : CATALOG.filter((g) => g.id === only);
  report.push(`Tester Cellcittine v${VERSION} · ${new Date().toLocaleString("it-IT")} · orologio ×${getFactor()} · difficoltà ${difficulty}`);

  const clock = warp.realSetInterval(() => {
    stageClock.textContent = `${((warp.realNow() - t0) / 1000).toFixed(0)} s`;
  }, 250);

  try {
    if (document.getElementById("optStruttura").checked) await testStruttura();
    if (document.getElementById("optGiochi").checked) {
      for (const g of games) {
        log(`▶ ${g.title}`);
        await testGioco(g, difficulty);
      }
    }
    if (document.getElementById("optApp").checked) {
      // Per la manche completa: il minigioco scelto, oppure uno breve che finisce da solo
      const pick = only !== "*" ? only : (CATALOG.find((g) => g.id === "tocchi") || CATALOG[0]).id;
      await testAllenamento(pick, difficulty);
      await testProvaSubito(pick);
    }
    if (document.getElementById("optDaily")?.checked) await testSfidaDelGiorno();
    if (document.getElementById("optMulti")?.checked) await testMultiplayer();
  } catch (e) {
    section("Tester");
    row("fail", "Il tester stesso ha avuto un errore", e.stack || e.message);
  }

  clearInterval(clock);
  sfx.setEnabled(soundWas);
  stage.replaceChildren();
  stageTitle.textContent = "Telefono di prova";
  const secs = ((warp.realNow() - t0) / 1000).toFixed(1);
  report.push(`\nTotale: ${counts.ok} ok, ${counts.warn} avvisi, ${counts.fail} errori in ${secs} s`);
  log(`Fatto in ${secs} s: ${counts.ok} ok, ${counts.warn} avvisi, ${counts.fail} errori`);
  document.title = `${counts.fail ? "❌" : counts.warn ? "⚠️" : "✅"} Tester · Cellcittine`;
  btnAvvia.disabled = false;
  btnCopia.disabled = false;
}

btnAvvia.addEventListener("click", run);
btnCopia.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(report.join("\n"));
    btnCopia.textContent = "Copiato!";
  } catch (_) {
    btnCopia.textContent = "Non riesco a copiare";
  }
  warp.realSetTimeout(() => { btnCopia.textContent = "Copia rapporto"; }, 1500);
});

document.getElementById("version").textContent = `v${VERSION}`;
// ?auto nell'indirizzo: parte da solo (comodo per gli agenti)
if (new URLSearchParams(location.search).has("auto")) run();
