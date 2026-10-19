/* static.js — статические проверки: переводы, data-i18n, дубли id,
   каркас панели, z-index, ключевые элементы и правила из «Не-забыть».
   Запуск: node tests/static.js */
const fs = require("fs");
const path = require("path");
const { createApp, HTML_PATH } = require("./harness");

const html = fs.readFileSync(HTML_PATH, "utf8");
const app = createApp();
const { window: w, document: d } = app;

let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log("  ok | " + name); }
  else { fail++; console.log("  FAIL | " + name + (extra !== undefined ? "  -> " + extra : "")); }
}

console.log("\n[1] Переводы");
const translations = JSON.parse(app.eval("JSON.stringify(translations)"));
const langs = Object.keys(translations);
T("3 языка: ru/uz/en", langs.length === 3 && ["ru", "uz", "en"].every(l => langs.includes(l)), langs.join(","));

const ruKeys = Object.keys(translations.ru).sort();
for (const lang of langs) {
  const keys = Object.keys(translations[lang]).sort();
  const missing = ruKeys.filter(k => !keys.includes(k));
  const extra = keys.filter(k => !ruKeys.includes(k));
  T(`${lang}: ключи совпадают с ru (${ruKeys.length})`, missing.length === 0 && extra.length === 0,
    `missing=${missing.join(",") || "-"} extra=${extra.join(",") || "-"}`);
}

const emptyValues = [];
for (const lang of langs) {
  for (const [k, v] of Object.entries(translations[lang])) {
    if (v === null || v === undefined || String(v).trim() === "") emptyValues.push(`${lang}.${k}`);
  }
}
T("нет пустых значений переводов", emptyValues.length === 0, emptyValues.slice(0, 10).join(", "));

console.log("\n[2] data-i18n");
const nodes = [...d.querySelectorAll("[data-i18n]")];
const badKeys = [];
for (const el of nodes) {
  const key = el.getAttribute("data-i18n");
  for (const lang of langs) if (!(key in translations[lang])) badKeys.push(`${key} (${lang})`);
}
T(`все data-i18n (${nodes.length}) есть во всех языках`, badKeys.length === 0, badKeys.slice(0, 10).join(", "));

console.log("\n[3] DOM");
const ids = [...d.querySelectorAll("[id]")].map(el => el.id);
const dupIds = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
T("нет дублей id", dupIds.length === 0, dupIds.join(","));

const required = [
  "loginScreen", "panelScreen", "sectionContent", "sidebar", "sidebarOverlay",
  "themeToggle", "themeTogglePanel", "notifDropdown", "notifModal",
  "testScreen", "resultScreen"
];
const missingEls = required.filter(id => !d.getElementById(id));
T(`ключевые элементы на месте (${required.length})`, missingEls.length === 0, missingEls.join(","));
T("#panelScreen имеет класс panel-layout", !!d.getElementById("panelScreen")?.classList.contains("panel-layout"));

console.log("\n[4] Каркас и слои (CSS)");
T("глобальный main ограничен через body > main", /body\s*>\s*main\s*\{/.test(html));
T("сброс панели через body.in-panel > main", /body\.in-panel\s*>\s*main\s*\{/.test(html));
T(".app-header имеет z-index: 120", /\.app-header\s*\{[^}]*z-index:\s*120/s.test(html));
T("sidebar фиксированной ширины (--sidebar-w)", /--sidebar-w\s*:/.test(html) && /\.sidebar\s*\{[^}]*width:\s*var\(--sidebar-w\)/s.test(html));
T("попапы непрозрачные (--surface-solid)", /--surface-solid\s*:/.test(html) && /\.notif-dropdown\s*\{[^}]*background:\s*var\(--surface-solid\)/s.test(html));
T("скроллбар панели уведомлений скрыт", /\.notif-list[^{]*\{[^}]*scrollbar-width:\s*none/s.test(html));
T("нет бейджей «Новость/Событие»", !/notif-news-badge|notif-tag/.test(html));

console.log("\n[5] Использование ключей");
const staticDictRefs = [...html.matchAll(/\bdict\.([a-zA-Z_$][\w$]*)/g)].map(m => m[1]);
const unknownDict = [...new Set(staticDictRefs)].filter(k => !(k in translations.ru));
T(`все статические dict.<key> (${new Set(staticDictRefs).size}) есть в ru`, unknownDict.length === 0, unknownDict.join(","));

console.log("\n[6] Ошибки загрузки");
T("console.error при инициализации пуст", app.errors.length === 0, app.errors.slice(0, 3).join(" | "));

console.log("\n[7] Расписание: 6 колонок без внутреннего скролла (аудит q10)");
T("сетка расписания — 6 равных колонок", /\.schedule-grid\s*\{[^}]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/s.test(html));
T("у колонок нет жёсткого min-width", /\.schedule-day\s*\{[^}]*min-width:\s*0/s.test(html));
T("3 колонки до 1440px", /@media\s*\(max-width:\s*1439\.98px\)\s*\{[^}]*\.schedule-grid[^}]*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s.test(html));
T("длинный предмет не рвётся одной буквой (0.85rem)", /\.schedule-subject\s*\{[^}]*font-size:\s*0\.85rem/s.test(html));

console.log(`\n=== STATIC: пройдено ${pass}, провалено ${fail} ===`);
app.close();
process.exit(fail === 0 ? 0 : 1);
