/* test40.js — Промт №40: финальная очистка и подготовка к сдаче.
   Проверяем:
   - DEBUG=false и отсутствие прямых console.log (только обёртка dbg);
   - отсутствие «в разработке» / «under development» / «ishlab chiqilmoqda»;
   - initDefaultData(): первичное заполнение localStorage;
   - таймер теста останавливается при logout и смене раздела;
   - README.md с инструкцией запуска и сброса базы;
   - console.error пуст.
   Запуск: node tests/test40.js */
const fs = require("fs");
const path = require("path");
const { createApp, HTML_PATH } = require("./harness");

const html = fs.readFileSync(HTML_PATH, "utf8");
const app = createApp();
const w = app.window;

let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log("  ok | " + name); }
  else { fail++; console.log("  FAIL | " + name + (extra !== undefined ? "  -> " + extra : "")); }
}

console.log("\n[1] Консоль и DEBUG");
T("DEBUG = false", w.eval("DEBUG") === false, w.eval("DEBUG"));
T("обёртка dbg() существует", typeof w.eval("dbg") === "function");
const directLogs = (html.match(/console\.log\(/g) || []).length;
T("прямой console.log только внутри dbg (1)", directLogs === 1, directLogs);
T("console.warn/error сохранены", /console\.warn\(/.test(html) && /console\.error\(/.test(html));

console.log("\n[2] Нет dev-заглушек в интерфейсе");
T("нет «в разработке»", !/в разработке/i.test(html));
T("нет «under development»", !/under development/i.test(html));
T("нет «ishlab chiqilmoqda»", !/ishlab chiqilmoqda/i.test(html));
const dict = JSON.parse(w.eval("JSON.stringify(translations)"));
const badStub = [];
for (const lang of ["ru", "uz", "en"]) {
  for (const [key, value] of Object.entries(dict[lang])) {
    if (/в разработке|under development|ishlab chiqilmoqda/i.test(String(value))) badStub.push(lang + "." + key);
  }
}
T("в словарях ru/uz/en нет dev-фраз", badStub.length === 0, badStub.join(", "));

console.log("\n[3] initDefaultData(): первичное заполнение localStorage");
T("функция initDefaultData существует", typeof w.eval("initDefaultData") === "function");
const keys = ["unitestalltests", "uniteststudents", "unitestteachers", "unitest_groups", "unitest_managers"];
const missing = keys.filter(k => !w.localStorage.getItem(k));
T("ключи демо-базы созданы", missing.length === 0, missing.join(", "));
const counts = {
  tests: JSON.parse(w.localStorage.getItem("unitestalltests") || "[]").length,
  students: JSON.parse(w.localStorage.getItem("uniteststudents") || "[]").length,
  teachers: JSON.parse(w.localStorage.getItem("unitestteachers") || "[]").length,
  groups: JSON.parse(w.localStorage.getItem("unitest_groups") || "[]").length
};
T("6 тестов / 7 студентов / 3 преподавателя / 4 группы",
  counts.tests === 6 && counts.students === 7 && counts.teachers === 3 && counts.groups === 4, JSON.stringify(counts));

console.log("\n[4] Таймер: logout и смена раздела");
w.selectRole("student");
w.startTest(1);
T("таймер запущен", w.eval("timerId") !== null, w.eval("timerId"));
w.logout();
T("logout → таймер остановлен", w.eval("timerId") === null, w.eval("timerId"));
T("logout → экран теста скрыт", w.document.getElementById("testScreen").classList.contains("hidden"));

w.selectRole("student");
w.startTest(1);
T("таймер запущен повторно", w.eval("timerId") !== null, w.eval("timerId"));
w.navigate("profile");
T("navigate → таймер остановлен", w.eval("timerId") === null, w.eval("timerId"));

console.log("\n[5] README и документация");
const readmePath = path.join(__dirname, "..", "README.md");
const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, "utf8") : "";
T("README.md создан", readme.length > 200, readme.length);
T("README: запуск через index.html", /index\.html/.test(readme));
T("README: 4 роли", /студент/i.test(readme) && /преподавател/i.test(readme)
  && /менеджер/i.test(readme) && /админ/i.test(readme));
T("README: сброс базы через админа", /сброс/i.test(readme) && /Настройк/i.test(readme));

console.log("\n[6] Консоль");
T("console.error пуст", app.errors.length === 0, app.errors.slice(0, 3).join(" | "));

console.log(`\n=== TEST40: пройдено ${pass}, провалено ${fail} ===`);
app.close();
process.exit(fail === 0 ? 0 : 1);
