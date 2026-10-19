/* check.js — синтаксис inline-<script> из index.html (аналог node --check).
   Запуск: node tests/check.js */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const HTML_PATH = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(HTML_PATH, "utf8");

const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(m => m[1])
  .filter(code => code.trim().length > 0);

let fail = 0;
scripts.forEach((code, i) => {
  const tmp = path.join(os.tmpdir(), `unitest-check-${process.pid}-${i}.js`);
  fs.writeFileSync(tmp, code, "utf8");
  const r = spawnSync(process.execPath, ["--check", tmp], { encoding: "utf8" });
  fs.rmSync(tmp, { force: true });
  if (r.status === 0) {
    console.log(`  ok | inline script #${i + 1} (${code.length} chars)`);
  } else {
    fail++;
    console.error(`  FAIL | inline script #${i + 1}`);
    console.error((r.stderr || r.stdout || "").trim());
  }
});

if (scripts.length === 0) {
  fail++;
  console.error("  FAIL | inline script не найден");
}

console.log(`\n=== CHECK: ${fail === 0 ? "OK" : "FAIL"} (${scripts.length} script, ${fail} fail) ===`);
process.exit(fail === 0 ? 0 : 1);
