/* Тест Промта №21 / 21.1: тесты направления, фильтр, отчёты, графики дашборда. */
const fs = require("fs");
const { JSDOM } = require("jsdom");
const HTML = require("path").join(__dirname, "..", "index.html");
const html = fs.readFileSync(HTML, "utf8");
let pass = 0, fail = 0;
function T(n, c, e) { if (c) { pass++; console.log("  ok | " + n); } else { fail++; console.log("  FAIL | " + n + (e !== undefined ? "  -> " + e : "")); } }
const safe = x => { try { return JSON.stringify(x); } catch (e) { return String(x); } };

const logs = { log: [], error: [] };
const dom = new JSDOM(html, {
  url: "https://unitest.local/", runScripts: "dangerously", pretendToBeVisual: true,
  beforeParse(w) {
    w.console.log = (...a) => logs.log.push(a.map(x => typeof x === "string" ? x : safe(x)).join(" "));
    w.console.error = (...a) => logs.error.push(a.map(x => typeof x === "string" ? x : safe(x)).join(" "));
    w.alert = () => {}; w.confirm = () => true; w.setInterval = () => 1; w.clearInterval = () => {};
  }
});
const w = dom.window, D = w.document;
if (D.readyState === "loading") w.initApp();
const txt = el => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
const hasLog = s => logs.log.some(l => l.includes(s));

// Тест направления от Sardor + чужой тест от Ivanova (Дизайн)
w.eval(`mockTests.push(
  {id:'manager_own', title:'Математика. Тест направления', author: mockTeacher.name,
   teacher: mockTeacher.name, targetGroup:['101-PR'], targetDirection:'programming',
   questionsCount: 5, status:'active'},
  {id:'manager_foreign', title:'Дизайн. Чужой тест', author:'Ivanova E.P.',
   teacher:'Ivanova E.P.', targetGroup:['102-DZ'], targetDirection:'design',
   questionsCount: 3, status:'active'}
)`);

console.log("\n[1] Тесты направления");
w.selectRole("manager");
w.navigate("tests");
const cards = () => [...D.querySelectorAll("#managerTestsGrid .manager-test-card")];
T("карточка теста направления есть", cards().length === 1, cards().length);
T("название и автор", txt(D.getElementById("managerTestsGrid")).includes("Тест направления")
  && txt(D.getElementById("managerTestsGrid")).includes("Sardor Rahimov"));
T("чужие тесты (Ivanova) скрыты", !txt(D.getElementById("managerTestsGrid")).includes("Дизайн. Чужой тест"));
T("фильтр «Все преподаватели» есть", !!D.getElementById("managerTestAuthor")
  && D.getElementById("managerTestAuthor").options.length === 2);
T("логи тестов направления", hasLog("Всего тестов в базе: 8")
  && hasLog("Тестов направления менеджера: 1"), logs.log.join(" | "));

const sel = D.getElementById("managerTestAuthor");
sel.value = "Sardor Rahimov";
sel.dispatchEvent(new w.Event("change", { bubbles: true }));
T("фильтр по Sardor → 1", cards().length === 1);
T("лог фильтра", hasLog('Фильтр по автору: Sardor Rahimov Найдено: 1'));
T("Ивановой нет в фильтре (чужое направление)",
  ![...sel.options].some(o => o.value === "Ivanova E.P."));
sel.value = "";
sel.dispatchEvent(new w.Event("change", { bubbles: true }));
T("сброс фильтра → снова 1 тест", cards().length === 1);

console.log("\n[2] Отчёты по группам");
w.navigate("reports");
const reportCards = [...D.querySelectorAll("#sectionContent .report-card")];
T("2 карточки групп", reportCards.length === 2, reportCards.length);
const g101 = reportCards.find(c => c.textContent.includes("101-PR"));
const g201 = reportCards.find(c => c.textContent.includes("201-PR"));
T("101-PR: средний балл 4.3 и 4 сданных", txt(g101).includes("4.3") && txt(g101).includes("4"));
T("201-PR: прочерк и 0", txt(g201).includes("—") && txt(g201).includes("0"));
T("progress bar 86% у 101-PR", (g101.querySelector(".progress-fill").getAttribute("style") || "").includes("86"));
T("лог среднего балла", hasLog("Группа 101-PR Средний балл: 4.3"), logs.log.join(" | "));

console.log("\n[3] Графики дашборда менеджера");
w.navigate("dashboard");
T("блок графиков есть", !!D.querySelector("#sectionContent .manager-charts"));
T("bar chart: 2 группы", D.querySelectorAll("#sectionContent .bar-row").length === 2);
T("donut: 5 студентов", txt(D.querySelector("#sectionContent .donut-center")) === "5");
T("легенда: Лучник 3 / Обычный 2",
  txt(D.querySelector("#sectionContent .chart-legend")).includes("Лучник: 3")
  && txt(D.querySelector("#sectionContent .chart-legend")).includes("Обычный: 2"));

console.log("\n[4] Переводы и консоль");
const keys = ["allTeachers", "author", "viewResults", "detailedResultsDev", "managerNoTests",
  "avgGrade", "testsPassed", "noData", "studentsByGroups", "studentCategories"];
T("ключи есть в ru/uz/en",
  ["ru", "uz", "en"].every(l => keys.every(k => typeof w.eval(`translations.${l}`)[k] === "string")));
T("console.error пуст", logs.error.length === 0, safe(logs.error));

console.log(`\n=== ИТОГ: пройдено ${pass}, провалено ${fail} ===`);
process.exit(fail ? 1 : 0);
