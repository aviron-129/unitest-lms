/* test39.js — Промт №39: обработка ошибок и пустые состояния.

   Проверяем:
   - safeParse(): валидный/битый/отсутствующий ключ, очистка битого ключа, логи;
   - renderEmptyState(): иконка/заголовок/описание, экранирование, CSS-классы;
   - пустые состояния: тесты студента, пользователи админа, группы преподавателя,
     апелляции, уведомления;
   - try/catch вокруг рендера в navigate() и у прямых вызовов renderSectionContent();
   - защиту от пустых данных студента (нет белого экрана и «undefined»);
   - QuotaExceededError при сохранении результата;
   - глобальный обработчик window 'error';
   - переводы новых ключей ru/uz/en.

   Запуск: node tests/test39.js */
const fs = require("fs");
const path = require("path");
const { createApp, HTML_PATH } = require("./harness");

const html = fs.readFileSync(HTML_PATH, "utf8");
const app = createApp();
const w = app.window, d = app.document;

let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log("  ok | " + name); }
  else { fail++; console.log("  FAIL | " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra) : "")); }
}
const ev = (expr) => w.eval(expr);
const txt = (el) => (el ? String(el.textContent || "").replace(/\s+/g, " ").trim() : "");
const hasLog = (s) => app.logs.some(l => l.includes(s));
const section = () => d.getElementById("sectionContent");

// Перехватываем warn, чтобы проверить сообщение о битом JSON (harness ловит log/error)
const warns = [];
w.console.warn = (...a) => warns.push(a.map(String).join(" "));

console.log("\n[1] safeParse: валидный, битый и отсутствующий ключ");
w.localStorage.setItem("unitest_safe_test", JSON.stringify({ a: 1, list: [2, 3] }));
const valid = ev('safeParse("unitest_safe_test", null)');
T("валидный JSON возвращает объект", valid && valid.a === 1 && valid.list.length === 2, valid);
T("лог успешного парсинга", hasLog("Безопасный парсинг ключа: unitest_safe_test Успешно: true"));

w.localStorage.setItem("unitest_safe_test", "{битый_json");
const fallback = ev('safeParse("unitest_safe_test", { ok: false })');
T("битый JSON возвращает fallback", fallback && fallback.ok === false, fallback);
T("битый ключ удалён из localStorage", w.localStorage.getItem("unitest_safe_test") === null);
T("битый JSON пишет console.warn", warns.some(x => x.includes("Ошибка чтения localStorage: unitest_safe_test")), warns);
T("лог неуспешного парсинга", hasLog("Безопасный парсинг ключа: unitest_safe_test Успешно: false"));

const missing = ev('safeParse("unitest_missing_key_39", 42)');
T("отсутствующий ключ возвращает fallback", missing === 42, missing);

w.localStorage.setItem("unitest_safe_array", JSON.stringify([{ x: 1 }]));
const parsedArray = ev('safeParse("unitest_safe_array", [])');
T("массив парсится как массив", Array.isArray(parsedArray) && parsedArray.length === 1);

console.log("\n[2] renderEmptyState");
const emptyHtml = ev('renderEmptyState("fa-inbox", "Заголовок", "Описание")');
T("возвращает HTML-блок", typeof emptyHtml === "string" && emptyHtml.includes("content-placeholder"));
T("есть модификатор empty-state", emptyHtml.includes("empty-state"));
T("иконка передана", emptyHtml.includes("fa-inbox"));
T("заголовок и описание на месте", emptyHtml.includes("Заголовок") && emptyHtml.includes("Описание"));
T("есть role=status", emptyHtml.includes('role="status"'));
const xssEmpty = ev('renderEmptyState("fa-x", "<img src=x>", "<script>alert(1)</script>")');
T("пользовательский текст экранируется", !xssEmpty.includes("<img src=x>") && !xssEmpty.includes("<script>"));
T("CSS пустого состояния добавлен", /\.content-placeholder\.empty-state\s*\{/.test(html));
T("CSS компактного варианта добавлен", /\.empty-state--compact\s*\{/.test(html));
T("CSS варианта ошибки добавлен", /\.empty-state--error\b/.test(html));

console.log("\n[3] Пустые состояния в списках");
// Тесты студента: пустая база → заглушка с описанием
const savedTests = ev("JSON.stringify(mockTests)");
ev("mockTests.length = 0");
w.selectRole("student");
w.navigate("availableTests");
T("тесты: .empty-state", !!section().querySelector(".empty-state"));
T("тесты: текст «нет доступных тестов»", txt(section()).includes(ev("translations.ru.noTests")));
T("тесты: есть пояснение", txt(section()).includes(ev("translations.ru.emptyTestsDesc")));
ev(`JSON.parse(${JSON.stringify(savedTests)}).forEach(t => mockTests.push(t));`);

// Группы преподавателя
const origGetMyGroups = w.getMyGroups;
w.getMyGroups = () => [];
w.selectRole("teacher");
w.navigate("myGroups");
T("группы: .empty-state", !!section().querySelector(".empty-state"));
T("группы: текст «нет назначенных групп»", txt(section()).includes(ev("translations.ru.noTeacherGroups")));
T("группы: есть пояснение", txt(section()).includes(ev("translations.ru.emptyGroupsDesc")));
w.getMyGroups = origGetMyGroups;

// Апелляции студента
const savedResults = w.localStorage.getItem("unitest_results");
w.localStorage.setItem("unitest_results", "[]");
w.selectRole("student");
w.navigate("appeals");
T("апелляции: .empty-state", !!section().querySelector(".empty-state"));
T("апелляции: текст заглушки", txt(section()).includes(ev("translations.ru.appealsEmpty")));
T("апелляции: есть пояснение", txt(section()).includes(ev("translations.ru.emptyAppealsDesc")));
if (savedResults != null) w.localStorage.setItem("unitest_results", savedResults);

// Уведомления (пустой список роли)
const origGetRoleNotif = w.getRoleNotifications;
w.getRoleNotifications = () => [];
w.selectRole("student");
w.renderNotifications();
const notifBox = d.getElementById("notifList");
T("уведомления: .empty-state", !!notifBox.querySelector(".empty-state"));
T("уведомления: текст «Нет новых уведомлений»", txt(notifBox).includes(ev("translations.ru.noNotifications")));
T("уведомления: компактный вариант", !!notifBox.querySelector(".empty-state--compact"));
w.getRoleNotifications = origGetRoleNotif;
w.renderNotifications();

// Пользователи админа: пустой результат поиска
w.selectRole("admin");
w.navigate("users");
const search = d.getElementById("adminUserSearch");
if (search) search.value = "zzz_no_such_user_39";
w.filterUsers();
T("пользователи: заглушка в таблице", txt(d.querySelector("#adminUsersRows")).includes(ev("translations.ru.adminUsersNotFound")));
T("пользователи: .empty-state в таблице", !!d.querySelector("#adminUsersRows .empty-state"));
T("пользователи: заглушка в карточках", txt(d.getElementById("adminUsersCards")).includes(ev("translations.ru.adminUsersNotFound")));

console.log("\n[4] Защита от ошибок рендера");
// navigate(): падение рендера раздела перехватывается и показывает заглушку
const errorsBefore = app.errors.length;
ev('window.__origInner39 = renderSectionContentInner; renderSectionContentInner = function () { throw new Error("Сбой рендера 39"); };');
let navThrew = false;
try { w.selectRole("student"); w.navigate("profile"); } catch (e) { navThrew = true; }
T("navigate: ошибка не всплывает наружу", !navThrew);
T("navigate: заглушка ошибки на экране", !!section().querySelector(".empty-state--error"));
T("navigate: текст ошибки", txt(section()).includes(ev("translations.ru.renderErrorTitle")));
T("navigate: console.error с названием раздела", app.errors.slice(errorsBefore).some(x => x.includes("Перехвачена ошибка при рендере раздела: profile")), app.errors.slice(errorsBefore));

// Прямой вызов renderSectionContent() тоже не должен ронять приложение
const errorsBefore2 = app.errors.length;
let directResult;
try { directResult = ev("renderSectionContent()"); } catch (e) { directResult = "throw"; }
T("renderSectionContent: ошибка перехвачена", directResult === false, directResult);
T("renderSectionContent: console.error «Ошибка рендера»", app.errors.slice(errorsBefore2).some(x => x.includes("Ошибка рендера:")), app.errors.slice(errorsBefore2));
T("renderSectionContent: заглушка на экране", !!section().querySelector(".empty-state--error"));
ev("renderSectionContentInner = window.__origInner39; delete window.__origInner39;");
app.errors.length = 0;

console.log("\n[5] Пустые данные студента");
const studentSnapshot = ev("JSON.stringify(mockStudent)");
ev("Object.keys(mockStudent).forEach(k => delete mockStudent[k]);");
let emptyStudentThrew = false;
try { w.navigate("profile"); } catch (e) { emptyStudentThrew = true; }
T("пустой mockStudent: без исключения", !emptyStudentThrew);
T("пустой mockStudent: заглушка «Данные не найдены»", txt(section()).includes(ev("translations.ru.dataNotFoundTitle")));
T("пустой mockStudent: нет «undefined»", !txt(section()).includes("undefined"));
ev(`Object.assign(mockStudent, ${studentSnapshot});`);
app.errors.length = 0;
w.navigate("profile");
T("данные восстановлены — профиль снова отрисован", !!section().querySelector(".profile-card"));
T("в профиле нет «undefined»", !txt(section()).includes("undefined"));

console.log("\n[5.1] Пустые данные студента: апелляции, результаты, отчёты");
// Аудит q6: normalizeResult() обращался к mockStudent.firstName[0] напрямую,
// поэтому без профиля падали сразу 3 раздела (апелляции/результаты/отчёты).
ev("Object.keys(mockStudent).forEach(k => delete mockStudent[k]);");
const fallbackNorm = ev(`normalizeResult({
  testId: 1, correct: 1, total: 2, percent: 50, grade: 3, date: "2026-10-20"
})`);
T("normalizeResult без профиля: имя «—»", fallbackNorm.studentName === "—", fallbackNorm.studentName);
T("normalizeResult без профиля: группа «—»", fallbackNorm.studentGroup === "—", fallbackNorm.studentGroup);
T("normalizeResult без testId: название «—»",
  ev('normalizeResult({ correct: 0, total: 0 }).testTitle') === "—",
  ev('normalizeResult({ correct: 0, total: 0 }).testTitle'));

w.selectRole("student");
app.errors.length = 0;
w.navigate("appeals");
T("апелляции без профиля: заглушка", !!section().querySelector(".empty-state")
  && !section().querySelector(".empty-state--error"), txt(section()).slice(0, 80));
T("апелляции без профиля: текст dataNotFound", txt(section()).includes(ev("translations.ru.dataNotFoundTitle")));
T("апелляции без профиля: без ошибки рендера", app.errors.length === 0, app.errors);

app.errors.length = 0;
w.selectRole("teacher");
app.errors.length = 0;
w.navigate("results");
T("результаты преподавателя без профиля: раздел отрисован",
  !!section().querySelector("#trTestFilter") && !section().querySelector(".empty-state--error"),
  txt(section()).slice(0, 80));
T("результаты преподавателя без профиля: без ошибки рендера", app.errors.length === 0, app.errors);

app.errors.length = 0;
w.selectRole("admin");
app.errors.length = 0;
w.navigate("reports");
T("отчёты админа без профиля: раздел отрисован",
  !!section().querySelector("#adminReportTable") && !section().querySelector(".empty-state--error"),
  txt(section()).slice(0, 80));
T("отчёты админа без профиля: без ошибки рендера", app.errors.length === 0, app.errors);

ev(`Object.assign(mockStudent, ${studentSnapshot});`);
app.errors.length = 0;
w.selectRole("student");
w.navigate("profile");
T("после проверки профиль снова отрисован", !!section().querySelector(".profile-card"));

console.log("\n[6] Битый localStorage не роняет приложение");
const beforeTestsLen = ev("mockTests.length");
w.localStorage.setItem("unitestalltests", "битый_текст");
let corruptThrew = false;
try { ev("loadTestsFromStorage()"); } catch (e) { corruptThrew = true; }
T("битый unitestalltests: без исключения", !corruptThrew);
T("битый unitestalltests: ключ очищен", w.localStorage.getItem("unitestalltests") === null);
T("битый unitestalltests: база в памяти цела", ev("mockTests.length") === beforeTestsLen, [ev("mockTests.length"), beforeTestsLen]);
T("битый unitestalltests: предупреждение в консоли", warns.some(x => x.includes("Ошибка чтения localStorage: unitestalltests")));

const resultsBackup = w.localStorage.getItem("unitest_results");
w.localStorage.setItem("unitest_results", "{сломано");
const corruptResults = JSON.parse(ev("JSON.stringify(getResults())"));
T("битый unitest_results: возвращён пустой массив", Array.isArray(corruptResults) && corruptResults.length === 0);
T("битый unitest_results: ключ очищен", w.localStorage.getItem("unitest_results") === null);
if (resultsBackup != null) w.localStorage.setItem("unitest_results", resultsBackup);

console.log("\n[7] QuotaExceededError");
const StorageProto = w.Storage && w.Storage.prototype;
let quotaChecked = false;
if (StorageProto && typeof StorageProto.setItem === "function") {
  const origSetItem = StorageProto.setItem;
  StorageProto.setItem = function () {
    const error = new Error("quota");
    error.name = "QuotaExceededError";
    throw error;
  };
  app.alerts.length = 0;
  let quotaThrew = false;
  try {
    ev('saveResult({ testId: 1, testTitle: "Тест", correct: 1, total: 1, percent: 100, grade: 5, timeSpent: 5, date: "2026-10-20" })');
  } catch (e) { quotaThrew = true; }
  quotaChecked = true;
  T("saveResult: QuotaExceededError не выбрасывается", !quotaThrew);
  T("saveResult: пользователю показан storageFull", app.alerts.includes(ev("translations.ru.storageFull")), app.alerts);
  StorageProto.setItem = origSetItem;
} else {
  T("Storage.prototype доступен для проверки квоты", false);
}
T("проверка квоты выполнена", quotaChecked);
app.errors.length = 0;

console.log("\n[7.1] Испорченные язык/тема в localStorage");
// Промт q8: невалидный unitest_lang раньше ронял applyLanguage() на dict.appTitle,
// а unitest_theme="blue" оставлял приложение в неизвестной теме.
const bootWithStorage = (storage) => {
  try { return { app: createApp({ storage }), error: null }; }
  catch (e) { return { app: null, error: String((e && e.message) || e) }; }
};

const badLang = bootWithStorage({ unitest_lang: "de", unitest_theme: "light" });
T("битый язык: initApp не падает", !!badLang.app && !badLang.error, badLang.error);
if (badLang.app) {
  const bw = badLang.app.window, bd = badLang.app.document;
  T("битый язык: откат на ru", bw.eval("currentLang") === "ru", bw.eval("currentLang"));
  T("битый язык: html lang = ru", bd.documentElement.lang === "ru", bd.documentElement.lang);
  T("битый язык: заголовок вкладки переведён", !!bd.title && !/undefined/.test(bd.title), bd.title);
  T("битый язык: испорченный ключ удалён", bw.localStorage.getItem("unitest_lang") === null);
  bw.selectRole("student");
  bw.navigate("profile");
  T("битый язык: вход и навигация работают",
    bw.eval("currentRole") === "student" &&
    String(bd.getElementById("sectionContent").textContent || "").trim().length > 0);
  T("битый язык: без console.error", badLang.app.errors.length === 0, badLang.app.errors.slice(0, 3));
  badLang.app.close();
}

const badTheme = bootWithStorage({ unitest_lang: "ru", unitest_theme: "blue" });
T("битая тема: initApp не падает", !!badTheme.app && !badTheme.error, badTheme.error);
if (badTheme.app) {
  const tw = badTheme.app.window, td = badTheme.app.document;
  T("битая тема: откат на light", tw.eval("currentTheme") === "light", tw.eval("currentTheme"));
  T("битая тема: data-theme=light", td.documentElement.getAttribute("data-theme") === "light",
    td.documentElement.getAttribute("data-theme"));
  T("битая тема: испорченный ключ удалён", tw.localStorage.getItem("unitest_theme") === null);
  badTheme.app.close();
}

// Так выглядел localStorage после старого импорта: значение закодировано дважды.
const quoted = bootWithStorage({ unitest_lang: '"ru"', unitest_theme: '"dark"' });
T("двойное кодирование из старого импорта: initApp не падает",
  !!quoted.app && !quoted.error, quoted.error);
if (quoted.app) {
  const qw = quoted.app.window;
  T("двойное кодирование: язык откатан на ru", qw.eval("currentLang") === "ru", qw.eval("currentLang"));
  T("двойное кодирование: тема откатана на light", qw.eval("currentTheme") === "light", qw.eval("currentTheme"));
  quoted.app.close();
}

const goodLocale = bootWithStorage({ unitest_lang: "en", unitest_theme: "dark" });
T("валидные язык/тема: initApp не падает", !!goodLocale.app && !goodLocale.error, goodLocale.error);
if (goodLocale.app) {
  const gw = goodLocale.app.window, gd = goodLocale.app.document;
  T("валидные язык/тема: en + dark",
    gw.eval("currentLang") === "en" && gw.eval("currentTheme") === "dark",
    `${gw.eval("currentLang")}/${gw.eval("currentTheme")}`);
  T("валидные язык/тема: не удалены из localStorage",
    gw.localStorage.getItem("unitest_lang") === "en" &&
    gw.localStorage.getItem("unitest_theme") === "dark");
  T("валидные язык/тема: html lang и data-theme",
    gd.documentElement.lang === "en" && gd.documentElement.getAttribute("data-theme") === "dark");
  goodLocale.app.close();
}

console.log("\n[8] Глобальный обработчик ошибок");
const globalBefore = app.errors.length;
w.dispatchEvent(new w.ErrorEvent("error", { message: "Тестовая глобальная ошибка 39" }));
T("window 'error' пишет console.error", app.errors.slice(globalBefore).some(x => x.includes("Глобальная ошибка: Тестовая глобальная ошибка 39")), app.errors.slice(globalBefore));
const afterMessage = app.errors.length;
w.dispatchEvent(new w.ErrorEvent("error", { message: "" }));
T("ресурсная ошибка без message не считается падением", app.errors.length === afterMessage);
app.errors.length = 0;

console.log("\n[9] Переводы и регресс");
const tr = JSON.parse(ev("JSON.stringify(translations)"));
const newKeys = [
  "emptyTestsDesc", "emptyUsersDesc", "emptyGroupsDesc", "emptyAppealsDesc",
  "emptyNotificationsDesc", "renderErrorTitle", "renderErrorDesc",
  "dataNotFoundTitle", "dataNotFoundDesc"
];
for (const key of newKeys) {
  T(`ключ ${key} во всех языках`,
    ["ru", "uz", "en"].every(l => tr[l] && typeof tr[l][key] === "string" && tr[l][key].trim()));
}
T("safeParse используется вместо прямого JSON.parse(localStorage)",
  !/JSON\.parse\(\s*localStorage\.getItem/.test(html));
T("try/catch в navigate вокруг рендера", /Перехвачена ошибка при рендере раздела:/.test(html));
T("глобальный обработчик window 'error'", /window\.addEventListener\('error'/.test(html));

// Финальный регресс: обычная навигация без ошибок
app.errors.length = 0;
w.selectRole("student");
w.navigate("profile");
w.navigate("availableTests");
w.navigate("schedule");
w.selectRole("teacher");
w.navigate("dashboard");
w.selectRole("manager");
w.navigate("dashboard");
w.selectRole("admin");
w.navigate("dashboard");
T("обычная навигация — без console.error", app.errors.length === 0, app.errors.slice(0, 3));

console.log(`\n=== TEST39: пройдено ${pass}, провалено ${fail} ===`);
app.close();
process.exit(fail === 0 ? 0 : 1);
