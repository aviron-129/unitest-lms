/* test32.js — Промт №32: геймификация, бейджи студента.
   Проверяем: блок «Мои достижения» в профиле, 4 бейджа, условия выдачи
   из unitest_results (+ исторические результаты), состояния unlocked/locked,
   замок у заблокированных, счётчик, логи, пустой список и переводы ru/uz/en.
   Запуск: node tests/test32.js */
const fs = require("fs");
const path = require("path");
const { createApp } = require("./harness");

const app = createApp();
const w = app.window, d = app.document;
let pass = 0, fail = 0;

function T(name, cond, extra) {
  if (cond) { pass++; console.log("  ok | " + name); }
  else { fail++; console.log("  FAIL | " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra) : "")); }
}
const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
const section = () => d.getElementById("sectionContent");
const cards = () => [...d.querySelectorAll("#sectionContent .badge-card")];
const card = (id) => d.querySelector(`#sectionContent .badge-card[data-badge-id="${id}"]`);
const unlocked = (id) => card(id)?.getAttribute("data-unlocked") === "true";
const hasLog = (s) => app.logs.some(l => l.includes(s));

function openProfile() {
  w.selectRole("student");
  w.navigate("profile");
}

function setResults(list) {
  w.localStorage.setItem("unitest_results", JSON.stringify(list));
}

console.log("\n[1] Блок «Мои достижения» в профиле");
openProfile();
T("блок .badges-section отрисован", !!d.querySelector("#sectionContent .badges-section"));
T("заголовок «Мои достижения»", txt(d.querySelector("#sectionContent .badges-title")).includes("Мои достижения"),
  txt(d.querySelector("#sectionContent .badges-title")));
T("4 карточки-бейджа", cards().length === 4, cards().length);
T("сетка .badges-grid", !!d.querySelector("#sectionContent .badges-grid"));
T("бейджи идут после статистики", (() => {
  const st = d.querySelector("#sectionContent .stats-row");
  const bg = d.querySelector("#sectionContent .badges-section");
  return !!st && !!bg && (st.compareDocumentPosition(bg) & w.Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
})());
T("счётчик 2/4 (демо: 2 результата)", txt(d.querySelector("#sectionContent .badges-count")) === "2/4",
  txt(d.querySelector("#sectionContent .badges-count")));

console.log("\n[2] Условия выдачи (unitest_results)");
T("first_test: пройден 1 тест — открыт", unlocked("first_test"));
T("excellent: есть оценка 5 — открыт", unlocked("excellent"));
T("active: 2 теста < 3 — закрыт", !unlocked("active"));
T("perfect: нет 100% — закрыт", !unlocked("perfect"));
T("открытая карточка цветная (--unlocked)", !!card("first_test")?.classList.contains("badge-card--unlocked"));
T("закрытая карточка полупрозрачная (--locked)", !!card("active")?.classList.contains("badge-card--locked"));
T("у закрытой иконка замка", !!card("active")?.querySelector(".badge-icon .fa-lock"));
T("у открытой иконка достижения, не замок", !!card("excellent")?.querySelector(".badge-icon .fa-star")
  && !card("excellent")?.querySelector(".fa-lock"));
T("подсказка закрытого: «Пройдите 3 теста»", txt(card("active")).includes("Пройдите 3 теста"), txt(card("active")));

console.log("\n[3] Логи самопроверки");
T("лог по каждому бейджу", hasLog("Бейдж first_test разблокирован? true")
  && hasLog("Бейдж active разблокирован? false"), app.logs.filter(l => l.startsWith("Бейдж")).slice(-6).join(" | "));

console.log("\n[4] Пустой список результатов");
setResults([]);
openProfile();
T("все 4 бейджа закрыты", cards().every(c => c.getAttribute("data-unlocked") === "false"));
T("счётчик 0/4", txt(d.querySelector("#sectionContent .badges-count")) === "0/4");
T("лог «У студента пока нет достижений»", hasLog("У студента пока нет достижений"));

console.log("\n[5] Три теста и 100% раскрывают все бейджи");
setResults([
  { testId: 1, score: 5, correct: 20, total: 20, date: "2026-10-01" },
  { testId: 2, score: 4, correct: 15, total: 20, date: "2026-10-03" },
  { testId: 3, score: 3, correct: 18, total: 30, date: "2026-10-05" }
]);
openProfile();
T("active открыт (3 теста)", unlocked("active"));
T("perfect открыт (percent вычислен 100%)", unlocked("perfect"));
T("все четыре открыты", cards().every(c => c.getAttribute("data-unlocked") === "true"));
T("счётчик 4/4", txt(d.querySelector("#sectionContent .badges-count")) === "4/4");

console.log("\n[6] Старый формат результатов (score = оценка)");
setResults([{ testId: 1, score: 5, correct: 18, total: 20, date: "2026-10-01" }]);
openProfile();
T("first_test открыт", unlocked("first_test"));
T("excellent открыт по score=5", unlocked("excellent"));
T("active закрыт (1 тест)", !unlocked("active"));
T("perfect закрыт (90%)", !unlocked("perfect"));
w.localStorage.setItem("unitest_results", JSON.stringify({ bad: true }));
openProfile();
T("не-массив в localStorage не ломает профиль", cards().length === 4 && app.errors.length === 0,
  app.errors.slice(0, 2).join(" | "));

console.log("\n[7] mockHistoricalResults: только свои записи");
setResults([]);
openProfile();
T("чужие исторические результаты не открывают бейджи", cards().every(c => c.getAttribute("data-unlocked") === "false"));
w.eval(`mockHistoricalResults.push({ testId:'mock1', testTitle:'X', studentName:'Tosheva Malika Alisherovna',
  studentGroup:'101-PR', score:20, maxScore:20, percent:100, grade:5, date:'12.10.2026' });`);
openProfile();
T("свой исторический результат учитывается (perfect)", unlocked("perfect"));
T("и excellent из исторической записи", unlocked("excellent"));
w.eval("mockHistoricalResults.pop();");
openProfile();

console.log("\n[8] Переводы ru/uz/en");
const dictKeys = ["badgesTitle", "badgeFirstTest", "badgeFirstTestDesc", "badgeExcellent", "badgeExcellentDesc",
  "badgeActive", "badgeActiveDesc", "badgePerfect", "badgePerfectDesc"];
for (const lang of ["ru", "uz", "en"]) {
  const ok = w.eval(`(${JSON.stringify(dictKeys)}).every(k => typeof translations[${JSON.stringify(lang)}][k] === 'string' && translations[${JSON.stringify(lang)}][k].trim())`);
  T(`${lang}: все ключи бейджей заполнены`, ok);
}
w.changeLanguage("uz");
openProfile();
T("uz: заголовок «Mening yutuqlarim»", txt(d.querySelector("#sectionContent .badges-title")).includes("Mening yutuqlarim"),
  txt(d.querySelector("#sectionContent .badges-title")));
T("uz: описание «3 ta testni topshiring»", txt(section()).includes("3 ta testni topshiring"));
w.changeLanguage("en");
openProfile();
T("en: заголовок «My achievements»", txt(d.querySelector("#sectionContent .badges-title")).includes("My achievements"));
T("en: описание «Pass 1 test»", txt(section()).includes("Pass 1 test"));
w.changeLanguage("ru");

console.log("\n[9] CSS и ошибки");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
T("CSS: сетка 4 колонки на десктопе", /\.badges-grid\s*\{[^}]*repeat\(4/s.test(html));
T("CSS: 2 колонки на мобильном", /\.badges-grid\s*\{[^}]*repeat\(2/s.test(html));
T("CSS: opacity 0.4 у закрытого бейджа", /\.badge-card--locked\s*\{[^}]*opacity:\s*0\.4/s.test(html));
T("CSS: hover-переход без анимаций", /\.badge-card--unlocked:hover\s*\{[^}]*translateY/s.test(html));
T("console.error пуст", app.errors.length === 0, app.errors.slice(0, 3).join(" | "));

console.log(`\n=== TEST32: пройдено ${pass}, провалено ${fail} ===`);
app.close();
process.exit(fail === 0 ? 0 : 1);
