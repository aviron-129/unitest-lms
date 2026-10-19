/* test29.js — Промт №28: панель администратора, глобальные отчёты.
   Проверяем: рендер раздела, фильтры курс+направление, карточки сводки,
   таблицу успеваемости с CSS progress bar, мобильные карточки, логи,
   экспорт-заглушку через dict, переводы ru/uz/en и регресс.
   Запуск: node tests/test29.js */
const { createApp } = require("./harness");

const app = createApp();
const w = app.window, d = app.document;
let pass = 0, fail = 0;

function T(name, cond, extra) {
  if (cond) { pass++; console.log("  ok | " + name); }
  else { fail++; console.log("  FAIL | " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra) : "")); }
}
const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
const sectionText = () => txt(d.getElementById("sectionContent"));
const rows = () => [...d.querySelectorAll(".admin-reports-table tbody tr")];
const cards = () => [...d.querySelectorAll(".admin-report-cards .admin-report-card")];
const courseSelect = () => d.getElementById("adminReportCourse");
const dirSelect = () => d.getElementById("adminReportDirection");
const setFilter = (el, value) => {
  el.value = value;
  el.dispatchEvent(new w.Event("change", { bubbles: true }));
};
const resetFilters = () => {
  if (!courseSelect()) w.navigate("reports");
  setFilter(courseSelect(), "");
  setFilter(dirSelect(), "");
};

console.log("\n[1] Рендер раздела «Отчёты»");
w.selectRole("admin");
w.navigate("reports");
T("раздел отрисован (не заглушка)", !!d.querySelector("#sectionContent .admin-reports-toolbar"));
T("нет «в разработке»", !sectionText().includes("в разработке"));
T("фильтр курса", !!courseSelect());
T("фильтр направления", !!dirSelect());
T("кнопка экспорта", !!d.getElementById("adminReportExport"));
T("6 опций курса (все + 1–5)", courseSelect() && courseSelect().options.length === 6,
  courseSelect() && courseSelect().options.length);
T("2 направления из mockTeacherGroups", dirSelect() && dirSelect().options.length === 3,
  dirSelect() && dirSelect().options.length);
T("лог отрисовки", app.logs.some(l => l.startsWith("Глобальные отчеты. Всего групп в вузе: 4")));

console.log("\n[2] Карточки общей статистики");
const statCards = [...d.querySelectorAll("#adminReportStats .stat-card")];
T("2 карточки", statCards.length === 2, statCards.length);
T("всего сдано = 4 (история + unitest_results)", txt(statCards[0]).includes("4"));
T("средний балл по вузу = 4.25", txt(statCards[1]).includes("4.25"));
T("подпись «Всего сдано тестов»", txt(statCards[0]).includes("Всего сдано тестов"));
T("подпись «Средний балл по вузу»", txt(statCards[1]).includes("Средний балл по вузу"));

console.log("\n[3] Таблица успеваемости");
T("4 строки групп", rows().length === 4, rows().length);
const header = txt(d.querySelector(".admin-reports-table thead"));
T("колонки: Группа/Курс/Направление/Студенты/Балл/Успеваемость",
  ["Группа", "Курс", "Направление", "Кол-во студентов", "Средний балл", "Успеваемость"]
    .every(h => header.includes(h)));
T("101-PR: средний балл 4.25", txt(rows()[0]).includes("4.25"));
T("101-PR: 3 студента (mockAllStudents)", txt(rows()[0]).includes("3"));
T("201-PR без результатов — «Нет данных»", txt(rows()[1]).includes("Нет данных"));
T("102-DZ: направление Дизайн", txt(rows()[2]).includes("Дизайн"));
T("4 progress-track в таблице", d.querySelectorAll(".admin-reports-table .progress-track").length === 4,
  d.querySelectorAll(".admin-reports-table .progress-track").length);
const fill = rows()[0].querySelector(".progress-fill");
T("ширина полоски 85% (4.25 / 5)", fill && fill.getAttribute("style").includes("85.0%"),
  fill && fill.getAttribute("style"));
T("цвет 4.25 — синий (3.5 < avg ≤ 4.5)", fill && fill.classList.contains("progress-fill--blue"),
  fill && fill.className);
T("пустая группа — серая полоска",
  rows()[1].querySelector(".progress-fill").classList.contains("progress-fill--gray"));
T("мобильных карточек 4", cards().length === 4, cards().length);
T("карточка содержит прогресс-бар", !!cards()[0].querySelector(".progress-track"));

console.log("\n[4] Логи самопроверки");
T("лог фильтров", app.logs.some(l => l === "Применены фильтры. Курс: all Направление: all"));
T("лог общего среднего", app.logs.some(l => l === "Общий средний балл по вузу: 4.25"));
T("лог группы 101-PR", app.logs.some(l => l === "Группа: 101-PR Средний балл: 4.25 Результатов: 4"));
T("лог пустой группы", app.logs.some(l => l === "Группа: 201-PR Средний балл: 0 Результатов: 0"));

console.log("\n[5] Фильтры пересчитывают карточки и таблицу");
setFilter(courseSelect(), "1");
T("курс 1 → 2 группы", rows().length === 2, rows().length);
T("курс 1 → 101-PR и 102-DZ",
  txt(d.querySelector(".admin-reports-table tbody")).includes("101-PR")
  && txt(d.querySelector(".admin-reports-table tbody")).includes("102-DZ"));
T("курс 1: сдано 4", txt(d.querySelectorAll("#adminReportStats .stat-card")[0]).includes("4"));
T("лог фильтра по курсу", app.logs.some(l => l === "Применены фильтры. Курс: 1 Направление: all"));
setFilter(dirSelect(), "design");
T("курс 1 + дизайн → 1 группа", rows().length === 1, rows().length);
T("это 102-DZ", txt(rows()[0]).includes("102-DZ"));
T("по фильтру нет результатов → 0", txt(d.querySelectorAll("#adminReportStats .stat-card")[0]).includes("0"));
T("средний балл «—» при отсутствии данных",
  txt(d.querySelectorAll("#adminReportStats .stat-card")[1]).includes("—"));
T("лог фильтра по направлению", app.logs.some(l => l === "Применены фильтры. Курс: 1 Направление: design"));
setFilter(courseSelect(), "2");
T("курс 2 + дизайн → 202-DZ", rows().length === 1 && txt(rows()[0]).includes("202-DZ"));
setFilter(dirSelect(), "");
T("курс 2 без направления → 2 группы", rows().length === 2, rows().length);
setFilter(courseSelect(), "3");
T("курс 3 → пусто (групп нет)", rows().length === 0, rows().length);
T("заглушка «группы не найдены»", sectionText().includes("По выбранным фильтрам группы не найдены"));
resetFilters();
T("сброс фильтров → снова 4 группы", rows().length === 4, rows().length);

console.log("\n[6] Экспорт (заглушка через dict)");
d.getElementById("adminReportExport").click();
T("alert показан", app.alerts.length === 1, app.alerts);
T("текст из словаря", app.alerts[0] === "Экспорт в Excel в разработке", app.alerts);

console.log("\n[7] Нормализация групп и результаты из localStorage");
T("«101-ПР» → «101-PR»", w.eval("adminReportGroupKey('101-ПР')") === "101-PR");
T("«102-ДЗ» → «102-DZ»", w.eval("adminReportGroupKey('102-ДЗ')") === "102-DZ");
w.localStorage.setItem("unitest_results", JSON.stringify([
  { testId: 1, score: 5, correct: 18, total: 20, date: "2026-10-01", studentGroup: "201-PR" }
]));
w.navigate("reports");
T("результат из unitest_results попал в отчёт",
  txt(rows()[1]).includes("5.00"), txt(rows()[1]));
T("201-PR: 1 сданный тест", txt(rows()[1]).includes("1"));
T("общий средний пересчитан (5+3+5)/3 = 4.33",
  txt(d.querySelectorAll("#adminReportStats .stat-card")[1]).includes("4.33"));

console.log("\n[8] Переводы ru/uz/en");
const keys = ["adminReportsSubtitle", "adminReportsAllCourses", "adminReportsAllDirections",
  "adminReportsExport", "adminReportsExportDev", "adminReportsTotalPassed",
  "adminReportsGlobalAvg", "adminReportsGroup", "adminReportsStudents",
  "adminReportsPerformance", "adminReportsNoData", "adminReportsNoGroups"];
T("ключи есть в ru/uz/en",
  ["ru", "uz", "en"].every(lang => keys.every(k => typeof w.eval(`translations.${lang}`)[k] === "string")));
w.changeLanguage("en");
T("английский: All courses / Performance",
  sectionText().includes("All courses") && sectionText().includes("Performance"));
T("английский: University average grade", sectionText().includes("University average grade"));
w.changeLanguage("uz");
T("узбекский: Barcha kurslar / O'zlashtirish",
  sectionText().includes("Barcha kurslar") && sectionText().includes("O'zlashtirish"));
T("узбекский: Jami topshirilgan testlar", sectionText().includes("Jami topshirilgan testlar"));
w.changeLanguage("ru");

console.log("\n[9] Регресс");
T("дашборд админа цел", (w.navigate("dashboard"), d.querySelectorAll("#sectionContent .stat-card").length === 4));
T("пользователи целы", (w.navigate("users"), d.querySelectorAll("#adminUsersRows tr[data-admin-user]").length === 12));
T("отчёты менеджера целы", (w.selectRole("manager"), w.navigate("reports"),
  d.querySelectorAll("#sectionContent .report-card").length === 2));
T("console.error пуст", app.errors.length === 0, app.errors);

console.log(`\n=== ИТОГ: пройдено ${pass}, провалено ${fail} ===`);
app.close();
process.exit(fail === 0 ? 0 : 1);
