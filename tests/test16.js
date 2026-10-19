/* Тест Промтов №15 (таблица результатов преподавателя) и №16 (расписание преподавателя)
   Запуск: node test16.js   (jsdom установлен в этой же папке) */
const fs = require("fs");
const { JSDOM } = require("jsdom");

const HTML_PATH = require("path").join(__dirname, "..", "index.html");
const html = fs.readFileSync(HTML_PATH, "utf8");

let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log("  ok | " + name); }
  else { fail++; console.log("  FAIL | " + name + (extra !== undefined ? "  -> " + extra : "")); }
}
function safeJson(x) { try { return JSON.stringify(x); } catch (e) { return String(x); } }
const hasLog = (w, s) => w.__logs.log.some(l => l.includes(s));

// Создаёт окно приложения; storage — объект для предзаполнения localStorage («перезагрузка»)
function makeWindow(storage) {
  const logs = { log: [], error: [] };
  const alerts = [];
  const dom = new JSDOM(html, {
    url: "https://unitest.local/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.console.log = (...a) => logs.log.push(a.map(x => typeof x === "string" ? x : safeJson(x)).join(" "));
      window.console.error = (...a) => logs.error.push(a.map(x => typeof x === "string" ? x : safeJson(x)).join(" "));
      window.alert = m => alerts.push(String(m));
      window.confirm = () => true;
      window.setInterval = () => 1;      // таймер теста — заглушка, чтобы процесс не висел
      window.clearInterval = () => {};
      if (storage) for (const [k, v] of Object.entries(storage)) window.localStorage.setItem(k, v);
    }
  });
  dom.window.__logs = logs;
  dom.window.__alerts = alerts;
  // jsdom откладывает DOMContentLoaded на следующий тик событий, а тест синхронный —
  // вызываем initApp вручную (иначе не привяжутся .lang-btn, кнопки теста
  // и не выполнится loadTestsFromStorage).
  if (dom.window.document.readyState === "loading") dom.window.initApp();
  return dom.window;
}

const w = makeWindow(null);

/* ============================================================
   [1] ПРОМТ №15: раздел «Результаты» — пустое состояние
   ============================================================ */
console.log("\n[1] Результаты: пустое состояние (своих тестов нет)");
w.selectRole("teacher");
w.navigate("results");

T("заголовок раздела «Результаты студентов»",
  w.document.getElementById("sectionHeading").textContent === "Результаты студентов",
  w.document.getElementById("sectionHeading").textContent);
T("заголовок дублируется в шапке панели",
  w.document.getElementById("appHeaderTitle").textContent === "Результаты студентов");
T("лог «Всего результатов в базе: 4» (2 исторических + 2 демо из unitest_results)",
  hasLog(w, "Всего результатов в базе: 4"), w.__logs.log.filter(l => l.includes("Всего результатов")).join(" | "));
T("лог «Результатов для тестов преподавателя: 0»",
  hasLog(w, "Результатов для тестов преподавателя: 0"));
T("заглушка «Пока никто не прошел ваши тесты»",
  w.document.getElementById("trResultsBox").textContent.includes("Пока никто не прошел ваши тесты"));

// фильтр: только пункт «Все тесты» (своих тестов ещё нет)
const opts0 = [...w.document.querySelectorAll("#trTestFilter option")].map(o => o.value);
T("фильтр: только «Все тесты»", JSON.stringify(opts0) === JSON.stringify([""]), safeJson(opts0));

// клик по экспорту — заглушка
w.document.getElementById("trExportBtn").click();
T("экспорт → честное демо-сообщение (без «в разработке»)",
  w.__alerts[0] === "Экспорт файла в демо-версии недоступен — результаты показаны в таблице.", w.__alerts[0]);

// смена фильтра не падает
const filterSel = w.document.getElementById("trTestFilter");
filterSel.dispatchEvent(new w.Event("change", { bubbles: true }));
T("лог фильтра «Фильтр по тесту:» + «Найдено: 0»",
  hasLog(w, "Фильтр по тесту:") && hasLog(w, "Найдено: 0"));

/* ============================================================
   [2] Преподаватель создаёт тест (шаг 1 + конструктор, компактно)
   ============================================================ */
console.log("\n[2] Создание теста через UI (2 вопроса)");
w.navigate("createTest");
w.document.getElementById("ctName").value = "Тест по геометрии";
w.document.getElementById("ctForm").value = "both";
w.document.querySelector('#ctGroups input[name="ctGroup"]').checked = true;
w.document.getElementById("ctQuestions").value = "2";
w.document.getElementById("ctTime").value = "15";
w.document.getElementById("createTestForm")
  .dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
T("конструктор открыт", !!w.document.getElementById("qbAdd"));

function addQ(text, corr) {
  w.document.getElementById("qText").value = text;
  [0, 1, 2, 3].forEach(i => { w.document.getElementById("qOpt" + i).value = "вариант " + i; });
  w.document.getElementById("qCorr" + corr).checked = true;
  w.document.getElementById("qbAdd").click();
}
addQ("Чему равен угол при вершине равностороннего треугольника?", 1);
addQ("Сколько диагоналей у пятиугольника?", 2);
T("2 вопроса добавлены", w.eval("currentTestDraft.questions.length") === 2);
w.document.getElementById("qbFinish").click();
T("тест сохранён (в памяти 7)", w.eval("mockTests.length") === 7);
T("перешли в «Мои тесты»", hasLog(w, "Мои тесты. Найдено: 1"));
const TEST_TITLE = "Тест по геометрии";

/* ============================================================
   [3] Студент проходит тест: 1 верно + 1 неверно → 50% → оценка 2
   ============================================================ */
console.log("\n[3] Студент проходит тест (1 из 2 → 50%)");
w.logout();
w.selectRole("student");
w.navigate("availableTests");
const sCard = [...w.document.querySelectorAll(".test-card")]
  .find(c => c.textContent.includes(TEST_TITLE));
T("студент видит новый тест", !!sCard);
sCard.querySelector(".btn-start").click();

w.document.querySelector('#testOptions .test-option[data-index="1"]').click(); // верно
w.document.getElementById("testNextBtn").click();
w.document.querySelector('#testOptions .test-option[data-index="0"]').click(); // неверно
w.document.getElementById("testFinishBtn").click();
T("результат 50%", w.document.getElementById("resultScreen").textContent.includes("50%"));
T("лог «Правильных: 1 из 2»", hasLog(w, "Правильных: 1 из 2"));
w.backToTests();

/* ============================================================
   [4] ПРОМТ №15: таблица с результатом студента
   ============================================================ */
console.log("\n[4] Результаты: строка таблицы + фильтр + локализация");
w.logout();
w.selectRole("teacher");
w.navigate("results");

T("лог «Всего результатов в базе: 5» (4 + 1 студенческий)",
  hasLog(w, "Всего результатов в базе: 5"), w.__logs.log.filter(l => l.includes("Всего результатов")).join(" | "));
T("лог «Результатов для тестов преподавателя: 1»",
  hasLog(w, "Результатов для тестов преподавателя: 1"));

const rows = w.document.querySelectorAll("#trResultsBox .results-table tbody tr");
T("в таблице 1 строка", rows.length === 1, rows.length);
if (rows.length === 1) {
  const cells = [...rows[0].querySelectorAll("td")].map(td => td.textContent.trim());
  T("Студент: Tosheva M.A. (из mockStudent — в unitest_results имени нет)",
    cells[0] === "Tosheva M.A.", cells[0]);
  T("Группа: 101-PR", cells[1] === "101-PR", cells[1]);
  T("Тест: Тест по геометрии", cells[2] === TEST_TITLE, cells[2]);
  T("Баллы: 1/2", cells[3] === "1/2", cells[3]);
  const badge = rows[0].querySelector(".grade-badge");
  T("Оценка: бейдж «2» (50% → grade 2)", badge && badge.textContent === "2" && badge.className.includes("grade-badge-2"),
    badge && badge.className + " / " + badge.textContent);
  T("Дата в формате DD.MM.YYYY", /^\d{2}\.\d{2}\.\d{4}$/.test(cells[5]), cells[5]);
  // заголовки таблицы
  const ths = [...w.document.querySelectorAll("#trResultsBox .results-table th")].map(t => t.textContent);
  T("заголовки: Студент/Группа/Тест/Баллы/Оценка/Дата",
    JSON.stringify(ths) === JSON.stringify(["Студент", "Группа", "Тест", "Баллы", "Оценка", "Дата"]),
    safeJson(ths));
}
// мобильные карточки (рендерятся вместе с таблицей, скрыты CSS)
const rcards = w.document.querySelectorAll("#trResultsBox .results-card");
T("мобильная карточка результата отрендерена (1 шт.)", rcards.length === 1, rcards.length);
T("карточка: ФИО + оценка + группа + баллы + дата",
  rcards.length === 1 && ["Tosheva M.A.", "101-PR", TEST_TITLE, "1/2", "2"]
    .every(s => rcards[0].textContent.includes(s)));

// фильтр по конкретному тесту
const opts1 = [...w.document.querySelectorAll("#trTestFilter option")].map(o => o.value);
T("в фильтре появился свой тест (+ «Все тесты»)", opts1.length === 2 && opts1[0] === "", safeJson(opts1));
const sel = w.document.getElementById("trTestFilter");
sel.value = opts1[1];
sel.dispatchEvent(new w.Event("change", { bubbles: true }));
T("лог «Фильтр по тесту:» содержит id теста", hasLog(w, "Фильтр по тесту: " + opts1[1]),
  w.__logs.log.filter(l => l.includes("Фильтр по тесту")).join(" | "));
T("после фильтрации — 1 строка", w.document.querySelectorAll("#trResultsBox .results-table tbody tr").length === 1);
sel.value = "";
sel.dispatchEvent(new w.Event("change", { bubbles: true }));
T("сброс фильтра → снова 1 строка", w.document.querySelectorAll("#trResultsBox .results-table tbody tr").length === 1);

// локализация
w.document.querySelector('.lang-btn[data-lang="en"]').click();
T("EN: заголовок «Student results»",
  w.document.getElementById("sectionHeading").textContent === "Student results",
  w.document.getElementById("sectionHeading").textContent);
const thsEn = [...w.document.querySelectorAll("#trResultsBox .results-table th")].map(t => t.textContent);
T("EN: заголовки Student/Group/Test/Points/Grade/Date",
  JSON.stringify(thsEn) === JSON.stringify(["Student", "Group", "Test", "Points", "Grade", "Date"]),
  safeJson(thsEn));
w.document.querySelector('.lang-btn[data-lang="uz"]').click();
T("UZ: заголовок «Talabalar natijalari»",
  w.document.getElementById("sectionHeading").textContent === "Talabalar natijalari");
w.document.querySelector('.lang-btn[data-lang="ru"]').click();
T("RU: заголовок обратно «Результаты студентов»",
  w.document.getElementById("sectionHeading").textContent === "Результаты студентов");

/* ============================================================
   [5] ПРОМТ №15: после удаления теста результаты уходят в заглушку
   ============================================================ */
console.log("\n[5] Удалили тест → заглушка в результатах");
w.navigate("myTests");
w.document.querySelector(".tt-delete").click();
T("тест удалён (6 в памяти)", w.eval("mockTests.length") === 6);
w.navigate("results");
T("фильтр снова пуст (только «Все тесты»)",
  w.document.querySelectorAll("#trTestFilter option").length === 1);
T("заглушка после удаления теста",
  w.document.getElementById("trResultsBox").textContent.includes("Пока никто не прошел ваши тесты"));

/* ============================================================
   [6] ПРОМТ №16: расписание преподавателя
   ============================================================ */
console.log("\n[6] Расписание: только свои пары, в карточке — группа");
w.navigate("schedule");
T("заголовок раздела «Расписание»",
  w.document.getElementById("sectionHeading").textContent === "Расписание",
  w.document.getElementById("sectionHeading").textContent);
T("лог «Всего пар в расписании: 11»", hasLog(w, "Всего пар в расписании: 11"));
T("лог «Пар у преподавателя Sardor Rahimov : 3»",
  hasLog(w, "Пар у преподавателя Sardor Rahimov"),
  w.__logs.log.filter(l => l.includes("Пар у преподавателя")).join(" | "));

const schedBox = w.document.getElementById("sectionContent");
const dayCols = schedBox.querySelectorAll(".schedule-day");
T("6 колонок дней недели (mon..sat — как у студента)", dayCols.length === 6, dayCols.length);
const tCards = schedBox.querySelectorAll(".schedule-card");
T("ровно 3 карточки (только свои пары)", tCards.length === 3, tCards.length);
const schedText = schedBox.textContent;
T("чужие преподаватели отфильтрованы (нет Smirnov/Karimova/Rustamov)",
  !["Smirnov", "Karimova", "Rustamov"].some(n => schedText.includes(n)));
T("в карточках есть группы 201-PR и 101-PR",
  schedText.includes("201-PR") && schedText.includes("101-PR"));
T("в карточках есть аудитории (204, 310, 206)",
  ["204", "310", "206"].every(r => schedText.includes(r)));
T("в карточках есть предметы (Математика, Программирование)",
  schedText.includes("Математика") && schedText.includes("Программирование"));
T("иконка группы в карточке (fa-people-group)",
  [...schedBox.querySelectorAll(".schedule-meta i")].some(i => i.className.includes("fa-people-group")));
T("имя преподавателя НЕ выводится в его же карточках",
  !schedText.includes("Sardor Rahimov"));

// заглушка: если у преподавателя нет пар
w.eval("mockSchedule.forEach(i => { if (i.teacher === 'Sardor Rahimov') i.teacher = 'X'; })");
w.navigate("dashboard"); w.navigate("schedule");
T("пустое состояние: «У вас нет занятий на эту неделю»",
  schedBox.textContent.includes("У вас нет занятий на эту неделю"),
  schedBox.textContent.replace(/\s+/g, " ").slice(0, 120));
w.eval("mockSchedule.forEach(i => { if (i.teacher === 'X') i.teacher = 'Sardor Rahimov'; })");
w.navigate("dashboard"); w.navigate("schedule");
T("после восстановления — снова 3 карточки",
  schedBox.querySelectorAll(".schedule-card").length === 3);

// локализация расписания
w.document.querySelector('.lang-btn[data-lang="en"]').click();
const enEmpty = w.eval("translations.en.noTeacherLessons");
T("noTeacherLessons есть во всех языках",
  ["ru", "uz", "en"].every(l => typeof w.eval(`translations.${l}.noTeacherLessons`) === "string"
    && w.eval(`translations.${l}.noTeacherLessons`).length > 0), enEmpty);
w.document.querySelector('.lang-btn[data-lang="ru"]').click();

/* ============================================================
   [7] Регресс: студенческое расписание не сломано
   ============================================================ */
console.log("\n[7] Регресс: расписание студента");
w.logout();
w.selectRole("student");
w.navigate("schedule");
const stCards = schedBox.querySelectorAll(".schedule-card");
// группа 101-PR: демо-пары 1–6 + новая пара id 10 (Sardor Rahimov, 101-PR)
T("студент видит 7 пар своей группы", stCards.length === 7, stCards.length);
T("студенту видно имя преподавателя", schedBox.textContent.includes("Sardor Rahimov"));

/* ============================================================
   [8] Проверка перевода всех новых ключей
   ============================================================ */
console.log("\n[8] Переводы ru/uz/en");
const keys = ["resultsStudents", "chooseTest", "allTests", "exportExcel", "noResultsYet",
  "thStudent", "thGroup", "thTest", "thPoints", "noTeacherLessons"];
const missing = [];
for (const lang of ["ru", "uz", "en"]) {
  for (const k of keys) {
    const v = w.eval(`translations.${lang}.${k}`);
    if (typeof v !== "string" || !v.trim()) missing.push(`${lang}.${k}`);
  }
}
T("все новые ключи есть во всех языках", missing.length === 0, safeJson(missing));
T("ru: resultsStudents = «Результаты студентов»",
  w.eval("translations.ru.resultsStudents") === "Результаты студентов");
T("uz: resultsStudents = «Talabalar natijalari»",
  w.eval("translations.uz.resultsStudents") === "Talabalar natijalari");
T("en: noResultsYet начинается с «No one has passed»",
  w.eval("translations.en.noResultsYet").startsWith("No one has passed"));

/* ============================================================
   ИТОГ
   ============================================================ */
console.log(`\n=== ИТОГ: пройдено ${pass}, провалено ${fail} ===`);
process.exit(fail ? 1 : 0);
