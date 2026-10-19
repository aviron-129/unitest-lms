/* Тест Промта №22: расписание направления у менеджера.
   Проверяем: фильтр по группам направления, карточку (время/предмет/преподаватель/
   группа/аудитория), логи, пустое состояние и переводы ru/uz/en. */
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
const cards = () => [...D.querySelectorAll("#sectionContent .schedule-card")];

console.log("\n[1] Менеджер: только группы направления");
w.selectRole("manager");
w.navigate("schedule");
T("сетка расписания отрисована", !!D.querySelector("#sectionContent .schedule-grid"));
T("6 дней недели", D.querySelectorAll("#sectionContent .schedule-day").length === 6,
  D.querySelectorAll("#sectionContent .schedule-day").length);
T("10 пар направления", cards().length === 10, cards().length);
const bodyText = txt(D.getElementById("sectionContent"));
T("видна группа 101-PR", bodyText.includes("101-PR"));
T("видна группа 201-PR", bodyText.includes("201-PR"));
T("пара 102-PR (Дизайн) скрыта", !bodyText.includes("102-PR"));
T("лог «Всего пар в базе: 11»", hasLog("Всего пар в базе: 11"), logs.log.join(" | "));
T("лог групп менеджера", hasLog("Группы менеджера:")
  && logs.log.some(l => l.includes("Группы менеджера:") && l.includes("101-PR") && l.includes("201-PR")));
T("лог «Пар для направления менеджера: 10»", hasLog("Пар для направления менеджера: 10"));

console.log("\n[2] Карточка пары: время, предмет, преподаватель, группа, аудитория");
const first = cards()[0];
const ft = txt(first);
T("время", /\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/.test(ft), ft);
T("предмет (переведён)", ft.includes("Математика"), ft);
T("преподаватель", ft.includes("Smirnov A.A."), ft);
T("группа", ft.includes("101-PR"), ft);
T("аудитория", ft.includes("204") && ft.includes("ауд."), ft);
T("тип занятия", ft.includes("Лекция"), ft);
const sardor = cards().filter(c => txt(c).includes("Sardor Rahimov"));
T("пары Sardor Rahimov в направлении", sardor.length === 3, sardor.length);

console.log("\n[3] Пустое состояние");
const saved = w.eval("JSON.stringify(mockSchedule)");
w.eval(`mockSchedule.length = 0; JSON.parse(${JSON.stringify(saved)})
  .filter(i => !['101-PR', '201-PR'].includes(i.group))
  .forEach(i => mockSchedule.push(i))`);
w.navigate("schedule");
const emptyText = txt(D.getElementById("sectionContent"));
T("заглушка вместо пар", cards().length === 0 && !!D.querySelector("#sectionContent .content-placeholder"));
T("текст заглушки", emptyText.includes(w.eval("translations.ru.managerScheduleEmpty")), emptyText);
w.eval(`mockSchedule.length = 0; JSON.parse(${JSON.stringify(saved)}).forEach(i => mockSchedule.push(i))`);
w.navigate("schedule");
T("расписание восстановлено (10 пар)", cards().length === 10, cards().length);

console.log("\n[4] Переводы ru/uz/en");
const keys = ["managerScheduleTitle", "managerScheduleEmpty"];
T("ключи есть в ru/uz/en",
  ["ru", "uz", "en"].every(l => keys.every(k => typeof w.eval(`translations.${l}`)[k] === "string")));
w.changeLanguage("en");
w.navigate("schedule");
T("английский заголовок", txt(D.querySelector("#sectionContent .schedule-title")) === "Direction schedule",
  txt(D.querySelector("#sectionContent .schedule-title")));
T("английские дни", txt(D.getElementById("sectionContent")).includes("Monday"));
T("карточек по-прежнему 10", cards().length === 10, cards().length);
w.changeLanguage("uz");
w.navigate("schedule");
T("узбекский заголовок", txt(D.querySelector("#sectionContent .schedule-title")) === "Yo'nalish dars jadvali",
  txt(D.querySelector("#sectionContent .schedule-title")));
T("узбекский предмет", txt(D.getElementById("sectionContent")).includes("Matematika"));

console.log("\n[5] Регресс других ролей");
w.changeLanguage("ru");
w.selectRole("student");
w.navigate("schedule");
T("студент видит свои 7 пар", D.querySelectorAll("#sectionContent .schedule-card").length === 7,
  D.querySelectorAll("#sectionContent .schedule-card").length);
w.selectRole("teacher");
w.navigate("schedule");
T("преподаватель видит свои 3 пары", D.querySelectorAll("#sectionContent .schedule-card").length === 3,
  D.querySelectorAll("#sectionContent .schedule-card").length);
T("console.error пуст", logs.error.length === 0, safe(logs.error));

console.log(`\n=== ИТОГ: пройдено ${pass}, провалено ${fail} ===`);
process.exit(fail ? 1 : 0);
