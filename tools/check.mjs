#!/usr/bin/env node
/*
  Controllo rapido da riga di comando (senza browser), pensato per chi lavora
  sul codice: da eseguire prima di ogni commit.

      node tools/check.mjs

  Verifica:
    - sintassi di tutti i file JavaScript (un errore qui blocca il caricamento
      di un minigioco: l'app resta ferma sul conto alla rovescia)
    - ogni minigioco del catalogo ha il suo file js/games/<id>.js e viceversa
    - ogni file elencato in sw.js (PRECACHE) esiste, e ogni minigioco è elencato
    - js/version.js e sw.js dicono la stessa versione
  Esce con codice 1 se c'è almeno un errore. Per la prova completa (partite
  simulate, allenamento) c'è test.html nel browser.
*/

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let errors = 0;
let warnings = 0;
const ok = (msg) => console.log(`  OK   ${msg}`);
const warn = (msg) => { warnings++; console.log(`  AVV  ${msg}`); };
const fail = (msg) => { errors++; console.log(`  ERR  ${msg}`); };
const read = (p) => readFileSync(join(root, p), "utf8");

function listJs(dir) {
  const out = [];
  for (const name of readdirSync(join(root, dir))) {
    const p = join(dir, name);
    if (statSync(join(root, p)).isDirectory()) out.push(...listJs(p));
    else if (name.endsWith(".js") || name.endsWith(".mjs")) out.push(p);
  }
  return out;
}

// 1. Sintassi
console.log("Sintassi");
const files = [...listJs("js"), "sw.js", ...listJs("tools")];
let bad = 0;
for (const f of files) {
  // Attenzione: `node --check file.js` non segnala gli errori nei moduli ES con
  // estensione .js; passando il sorgente da stdin come modulo invece funziona.
  const r = spawnSync(process.execPath, ["--input-type=module", "--check"], { input: read(f), encoding: "utf8" });
  if (r.status !== 0) {
    bad++;
    const err = (r.stderr || "").split("\n");
    const where = err.find((l) => /^\[stdin\]:\d+/.test(l))?.match(/:(\d+)/)?.[1];
    const line = err.find((l) => /Error/.test(l)) || "errore";
    fail(`${f}${where ? `:${where}` : ""}: ${line.trim()}`);
  }
}
if (!bad) ok(`${files.length} file JavaScript, nessun errore di sintassi`);

// 2. Catalogo ↔ file
console.log("Catalogo");
const catalog = read("js/games/catalog.js");
const ids = [...catalog.matchAll(/^\s*id:\s*"([^"]+)"/gm)].map((m) => m[1]);
const imports = [...catalog.matchAll(/import\("\.\/([^"]+)\.js"\)/g)].map((m) => m[1]);
const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dup.length) fail(`id doppi nel catalogo: ${dup.join(", ")}`);
for (const id of ids) {
  if (!existsSync(join(root, "js/games", `${id}.js`))) fail(`"${id}" è nel catalogo ma manca js/games/${id}.js`);
}
for (const name of imports) {
  if (!ids.includes(name)) warn(`catalog.js importa ./${name}.js ma nessuna scheda ha id "${name}"`);
}
const gameFiles = readdirSync(join(root, "js/games")).filter((n) => n.endsWith(".js") && !["catalog.js", "shell.js"].includes(n)).map((n) => n.slice(0, -3));
for (const g of gameFiles) {
  if (!ids.includes(g)) warn(`js/games/${g}.js esiste ma non è nel catalogo`);
}
// Ogni minigioco deve avere id, order, maxSeconds, createParams, formatScore, isValidScore, mount, unmount
for (const id of ids) {
  const p = join(root, "js/games", `${id}.js`);
  if (!existsSync(p)) continue;
  const src = readFileSync(p, "utf8");
  const missing = ["createParams", "formatScore", "isValidScore", "mount", "unmount"].filter((k) => !new RegExp(`\\b${k}\\s*\\(`).test(src));
  if (!/\bid:\s*"/.test(src)) missing.push("id");
  if (!/\border:\s*"(asc|desc)"/.test(src)) missing.push("order");
  if (!/\bmaxSeconds:/.test(src)) missing.push("maxSeconds");
  if (missing.length) fail(`js/games/${id}.js: manca ${missing.join(", ")}`);
  if (!/sfx\.(play|pad|step|inflate)/.test(src)) warn(`js/games/${id}.js: nessun suono (sfx)`);
}
if (!errors) ok(`${ids.length} minigiochi nel catalogo, file tutti presenti`);

// 3. Service worker
console.log("Service worker (sw.js)");
const sw = read("sw.js");
const precache = [...new Set([...sw.matchAll(/"(\.\/[^"]*)"/g)].map((m) => m[1]))];
const missingFiles = precache.filter((p) => p !== "./" && !existsSync(join(root, p)));
if (missingFiles.length) fail(`file elencati in PRECACHE ma inesistenti (il service worker non si installerebbe): ${missingFiles.join(", ")}`);
else ok(`${precache.length} file in PRECACHE, tutti presenti`);
const notListed = ids.filter((id) => !precache.includes(`./js/games/${id}.js`));
if (notListed.length) warn(`minigiochi non elencati in PRECACHE (non funzionano offline): ${notListed.join(", ")}`);
else ok("tutti i minigiochi sono in PRECACHE");

// 4. Versione
console.log("Versione");
const v1 = read("js/version.js").match(/VERSION\s*=\s*"([^"]+)"/)?.[1];
const v2 = sw.match(/CACHE_VERSION\s*=\s*"([^"]+)"/)?.[1];
if (v1 && v1 === v2) ok(`v${v1} in version.js e sw.js`);
else fail(`version.js dice "${v1}", sw.js dice "${v2}"`);

console.log(`\n${errors ? "❌" : warnings ? "⚠️" : "✅"} ${errors} errori, ${warnings} avvisi  (${relative(process.cwd(), root) || "."})`);
process.exit(errors ? 1 : 0);
