#!/usr/bin/env node
/*
  Esegue il tester del browser (test.html) da riga di comando, in Chrome headless,
  e stampa il rapporto. Serve il server locale acceso (node .claude/serve.js).

      node tools/tester.mjs                 tutte le prove
      node tools/tester.mjs --solo=tocchi   un solo minigioco
      node tools/tester.mjs --no-giochi     salta le partite simulate
      node tools/tester.mjs --verbose       stampa tutte le righe del rapporto
      node tools/tester.mjs --url=http://localhost:8765/test.html

  Esce con codice 1 se il tester segnala errori. Usa il protocollo DevTools
  (WebSocket) senza librerie esterne: Chrome o Edge devono essere installati.
*/

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const base = args.url || "http://localhost:8765/test.html";
const PORT = 9333;
const BROWSERS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
];
const exe = BROWSERS.find((p) => existsSync(p));
if (!exe) { console.error("Nessun Chrome/Edge trovato"); process.exit(2); }

const profile = mkdtempSync(join(tmpdir(), "cellcittine-tester-"));
const chrome = spawn(exe, [`--remote-debugging-port=${PORT}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--autoplay-policy=no-user-gesture-required", `--user-data-dir=${profile}`, "--window-size=1200,1000", "about:blank"], { stdio: "ignore" });
const cleanup = () => { try { chrome.kill(); } catch (_) { /* già chiuso */ } setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch (_) { /* file ancora in uso */ } }, 500); };
process.on("exit", cleanup);
process.on("SIGINT", () => process.exit(130));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Aspetta che Chrome risponda e prendi la pagina
let target = null;
for (let i = 0; i < 100 && !target; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    target = list.find((t) => t.type === "page");
  } catch (_) { await sleep(200); }
}
if (!target) { console.error("Chrome non risponde sulla porta di debug"); process.exit(2); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || "errore nella pagina");
  return r.result?.result?.value;
};

await send("Page.enable");
await send("Runtime.enable");
const url = new URL(base);
url.searchParams.set("headless", "1");
await send("Page.navigate", { url: url.toString() });
// Aspetta il tester
for (let i = 0; i < 100; i++) {
  if (await evaluate("!!document.getElementById('btnAvvia') && !!document.getElementById('optGioco')?.options.length").catch(() => false)) break;
  await sleep(200);
}
// Opzioni
await evaluate(`
  document.getElementById('optStruttura').checked = ${args["no-struttura"] ? "false" : "true"};
  document.getElementById('optGiochi').checked = ${args["no-giochi"] ? "false" : "true"};
  document.getElementById('optApp').checked = ${args["no-app"] ? "false" : "true"};
  if (document.getElementById('optDaily')) document.getElementById('optDaily').checked = ${args["no-daily"] ? "false" : "true"};
  document.getElementById('optGioco').value = ${JSON.stringify(args.solo || "*")};
  document.getElementById('optDifficolta').value = ${JSON.stringify(args.difficolta || "normale")};
  document.getElementById('btnAvvia').click(); true`);

const started = Date.now();
let lastLog = "";
while (true) {
  await sleep(1000);
  const st = await evaluate(`({ running: document.getElementById('btnAvvia').disabled, log: document.getElementById('log').textContent })`);
  if (st.log.length > lastLog.length) { process.stdout.write(st.log.slice(lastLog.length)); lastLog = st.log; }
  if (!st.running) break;
  if (Date.now() - started > 15 * 60 * 1000) { console.error("\nTempo scaduto (15 min)"); process.exit(1); }
}
const report = await evaluate(`({
  summary: document.getElementById('summary').innerText.replace(/\\s+/g, ' '),
  bad: [...document.querySelectorAll('.row.fail, .row.warn')].map(r => ((r.closest('.section')?.querySelector('h2 span')?.textContent || '') + ' — ' + r.innerText.replace(/\\s+/g, ' ')).slice(0, 400)),
  fails: document.querySelectorAll('.row.fail').length,
  all: [...document.querySelectorAll('.row')].map(r => r.innerText.replace(/\\s+/g, ' ').slice(0, 300)),
})`);
if (args.verbose) for (const r of report.all) console.log(`  ${r}`);
console.log(`\n${report.summary}`);
for (const b of report.bad) console.log(`  ${b}`);
ws.close();
process.exit(report.fails ? 1 : 0);
