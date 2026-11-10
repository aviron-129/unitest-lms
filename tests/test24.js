/* Тест Промта №23: дашборд администратора.
   Проверяем: приветствие, 4 карточки статистики (студенты/преподаватели/группы/тесты),
   ленту последних событий, активные направления с числом групп, логи, пустые данные,
   переводы ru/uz/en и регресс других ролей. */
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
const cards = () => [...D.querySelectorAll("#sectionContent .stat-card")];
const values = () => cards().map(c => txt(c.querySelector(".stat-value")));
const labels = () => cards().map(c => txt(c.querySelector(".stat-label")));

console.log("\n[1] Приветствие и 4 карточки статистики");
w.selectRole("admin");
w.navigate("dashboard");
T("дашборд отрисован", !!D.querySelector("#sectionContent .admin-stats"));
T("4 карточки статистики", cards().length === 4, cards().length);
const welcome = txt(D.querySelector("#sectionContent .dash-welcome"));
T("приветствие с именем админа", welcome.includes("Добро пожаловать") && welcome.includes("Aziz Karimov"), welcome);
T("подпись роли «Супер-админ»", txt(D.querySelector("#sectionContent .dash-subject")).includes("Супер-админ"),
  txt(D.querySelector("#sectionContent .dash-subject")));
T("значения: студенты 7, преподаватели 3, группы 4, тесты 6",
  values().join(",") === "7,3,4,6", values().join(","));
T("подписи карточек", labels().join("|") === "Всего студентов|Всего преподавателей|Всего групп|Всего тестов",
  labels().join("|"));
T("иконки FontAwesome в карточках", cards().every(c => !!c.querySelector("i.fas")));
T("подпись рядом с иконкой сверху", cards().every(c => {
  const head = c.querySelector(".stat-head");
  return !!head && head.contains(c.querySelector("i.fas")) && head.contains(c.querySelector(".stat-label"));
}));
T("число стоит под строкой иконки", cards().every(c =>
  !!c.querySelector(".stat-value") && !c.querySelector(".stat-head .stat-value")
));

console.log("\n[2] Лента последних событий");
const events = [...D.querySelectorAll("#sectionContent .admin-event")];
T("3 события", events.length === 3, events.length);
const eventsText = events.map(txt).join(" | ");
T("создание теста преподавателем", eventsText.includes("Sardor Rahimov") && eventsText.includes("создал тест")
  && eventsText.includes("Математика"), eventsText);
T("добавление группы менеджером", eventsText.includes("Dilnoza Yusupova") && eventsText.includes("202-DZ"), eventsText);
T("сдача теста студентом", eventsText.includes("Malika Tosheva") && eventsText.includes("сдал тест на 5"), eventsText);
T("время событий", eventsText.includes("2 часа назад") && eventsText.includes("5 часов назад")
  && eventsText.includes("вчера"), eventsText);

console.log("\n[3] Активные направления и число групп");
const directions = [...D.querySelectorAll("#sectionContent .admin-direction")];
T("2 направления", directions.length === 2, directions.length);
const dirText = directions.map(txt).join(" | ");
T("Программирование — 2 группы", dirText.includes("Программирование") && dirText.includes("Групп: 2"), dirText);
T("Дизайн — 2 группы", dirText.includes("Дизайн") && dirText.includes("Групп: 2"), dirText);
T("нет русских ключей направлений", !dirText.includes("programming") && !dirText.includes("design"), dirText);

console.log("\n[4] Логи самопроверки");
T("лог статистики", hasLog("Статистика Админа - Студентов: 7 Групп: 4"), logs.log.join(" | "));
T("лог направлений", logs.log.some(l => l.includes("Направления и количество групп:")
  && l.includes("programming") && l.includes("design")), logs.log.join(" | "));

console.log("\n[5] Переводы ru/uz/en");
const keys = ["adminRoleLabel", "adminTotalStudents", "adminTotalTeachers", "adminTotalGroups",
  "adminTotalTests", "adminRecentEvents", "adminActiveDirections", "adminEventTestCreated",
  "adminEventGroupAdded", "adminEventTestPassed", "adminTime2h", "adminTime5h", "adminTimeYesterday",
  "adminDirectionGroups", "adminNoEvents", "adminNoDirections"];
T("ключи есть в ru/uz/en",
  ["ru", "uz", "en"].every(l => keys.every(k => typeof w.eval(`translations.${l}`)[k] === "string")));
w.changeLanguage("en");
w.navigate("dashboard");
T("английские подписи", labels().join("|") === "Total students|Total teachers|Total groups|Total tests",
  labels().join("|"));
T("английское приветствие", txt(D.querySelector("#sectionContent .dash-welcome")) === "Welcome, Aziz Karimov",
  txt(D.querySelector("#sectionContent .dash-welcome")));
T("английские направления", txt(D.getElementById("sectionContent")).includes("Programming")
  && txt(D.getElementById("sectionContent")).includes("Design"));
w.changeLanguage("uz");
w.navigate("dashboard");
T("узбекские подписи", labels().join("|") === "Jami talabalar|Jami o'qituvchilar|Jami guruhlar|Jami testlar",
  labels().join("|"));
T("узбекские направления", txt(D.getElementById("sectionContent")).includes("Dasturlash")
  && txt(D.getElementById("sectionContent")).includes("Dizayn"));

console.log("\n[6] Пустые данные: 0 вместо undefined");
w.changeLanguage("ru");
const saved = {
  students: w.eval("JSON.stringify(mockAllStudents)"),
  teachers: w.eval("JSON.stringify(mockAllTeachers)"),
  groups: w.eval("JSON.stringify(mockTeacherGroups)"),
  tests: w.eval("JSON.stringify(mockTests)")
};
w.eval("mockAllStudents.length = 0; mockAllTeachers.length = 0; mockTeacherGroups.length = 0; mockTests.length = 0");
w.navigate("dashboard");
T("все карточки показывают 0", values().join(",") === "0,0,0,0", values().join(","));
T("заглушка направлений", txt(D.getElementById("sectionContent")).includes(w.eval("translations.ru.adminNoDirections")),
  txt(D.getElementById("sectionContent")));
T("нет undefined/NaN", !/undefined|\bNaN\b/.test(txt(D.getElementById("sectionContent"))),
  txt(D.getElementById("sectionContent")));
w.eval(`mockAllStudents.length = 0; JSON.parse(${JSON.stringify(saved.students)}).forEach(x => mockAllStudents.push(x));
  mockAllTeachers.length = 0; JSON.parse(${JSON.stringify(saved.teachers)}).forEach(x => mockAllTeachers.push(x));
  mockTeacherGroups.length = 0; JSON.parse(${JSON.stringify(saved.groups)}).forEach(x => mockTeacherGroups.push(x));
  mockTests.length = 0; JSON.parse(${JSON.stringify(saved.tests)}).forEach(x => mockTests.push(x))`);
w.navigate("dashboard");
T("данные восстановлены", values().join(",") === "7,3,4,6", values().join(","));

console.log("\n[7] Регресс других ролей");
w.selectRole("manager");
w.navigate("dashboard");
T("менеджер: 3 карточки", cards().length === 3, cards().length);
T("менеджер: приветствие", txt(D.querySelector("#sectionContent .dash-welcome")).includes("Dilnoza Yusupova"));
w.selectRole("teacher");
w.navigate("dashboard");
T("преподаватель: 3 карточки", cards().length === 3, cards().length);
w.selectRole("student");
w.navigate("profile");
T("студент: профиль", !!D.querySelector("#sectionContent .profile-card, #sectionContent .dash-welcome, #sectionContent .info-item"));
T("console.error пуст", logs.error.length === 0, safe(logs.error));

console.log(`\n=== ИТОГ: пройдено ${pass}, провалено ${fail} ===`);
process.exit(fail ? 1 : 0);
