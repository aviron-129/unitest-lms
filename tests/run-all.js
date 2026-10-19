/* run-all.js — единая точка входа для всех проверок.
   Запуск: node tests/run-all.js
   Код выхода 0 — всё зелёное, 1 — есть провалы. */
const path = require("path");
const { spawnSync } = require("child_process");

const TESTS = [
  ["check.js", "Синтаксис"],
  ["test15.js", "№13–14 + LaTeX"],
  ["test16.js", "№15–16"],
  ["test17.js", "Формулы + таблица Менделеева"],
  ["test18.js", "Live Preview"],
  ["test19.js", "Math Pad"],
  ["test20.js", "№17–20"],
  ["test21.js", "Схемы"],
  ["test22.js", "№21–21.1"],
  ["static.js", "Статика/i18n"],
  ["smoke.js", "Smoke: роли/разделы/языки/темы"]
];

const results = [];
const started = Date.now();

for (const [file, title] of TESTS) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [file], {
    cwd: __dirname,
    encoding: "utf8",
    timeout: 180000
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  const lines = out.trim().split(/\r?\n/);
  const summary = [...lines].reverse().find(l => /===.*(ИТОГ|CHECK|STATIC|SMOKE)/.test(l)) || lines.slice(-1)[0] || "";
  const ok = r.status === 0;
  results.push({ file, title, ok, summary, ms: Date.now() - t0 });
  console.log(`${ok ? "✅" : "❌"} ${file.padEnd(12)} ${title.padEnd(32)} ${summary.trim()}`);
  if (!ok) {
    console.log("---- вывод ----");
    console.log(lines.slice(-40).join("\n"));
    console.log("---------------");
  }
}

const failed = results.filter(r => !r.ok);
console.log("\n==================================================");
console.log(`ИТОГО: ${results.length - failed.length}/${results.length} наборов зелёные | ${((Date.now() - started) / 1000).toFixed(1)} c`);
if (failed.length) {
  console.log("ПРОВАЛЫ: " + failed.map(r => r.file).join(", "));
}
console.log("==================================================");

process.exit(failed.length ? 1 : 0);
