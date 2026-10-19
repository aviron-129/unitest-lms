/* test42.js — Промт №42: аудит логики, памяти и защита от падений (v2).
   Проверяем:
   - таймер теста очищается при navigate / logout / finishTest / closeTestScreen / pagehide;
   - «Время вышло» автоматически завершает тест ровно один раз (без дубля результата);
   - повторная инициализация не дублирует глобальные обработчики;
   - восстановление прогресса: id числом/строкой, просроченное сохранение, битые ответы;
   - деление на ноль и пустые массивы (renderQuestion/calcResult/formatTime);
   - после logout/finish нет живого setInterval и записи прогресса.
   Запуск: node tests/test42.js */
const { createApp } = require("./harness");

const app = createApp();
const w = app.window;
const D = w.document;
w.confirm = () => true;   // подтверждаем восстановление прогресса

let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log("  ok | " + name); }
  else { fail++; console.log("  FAIL | " + name + (extra !== undefined ? "  -> " + extra : "")); }
}

// Управляемый setInterval: запоминаем колбэки и очистку, чтобы «тикать» вручную.
let intervals = new Map();
let nextIntervalId = 100;
const clearedIds = [];
w.setInterval = (fn) => { const id = ++nextIntervalId; intervals.set(id, fn); return id; };
w.clearInterval = (id) => { clearedIds.push(id); intervals.delete(id); };
function tick() { [...intervals.values()].forEach(fn => { try { fn(); } catch (e) { app.errors.push(String(e)); } }); }

const dict = w.eval("JSON.stringify(translations[currentLang])");
const tr = JSON.parse(dict);

function resetTestState() {
  w.eval(`stopTimer(); testSessionFinished = false; activeTest = null;
    currentQuestionIndex = 0; userAnswers = []; secondsLeft = 0; clearProgress();
    document.getElementById('testScreen').classList.add('hidden');
    document.getElementById('resultScreen').classList.add('hidden');
    document.body.style.overflow = '';`);
  intervals.clear();
  clearedIds.length = 0;
}

console.log("\n[1] formatTime: защита от NaN / Infinity / минуса");
T("65 → 01:05", w.formatTime(65) === "01:05", w.formatTime(65));
T("NaN → 00:00", w.formatTime(NaN) === "00:00", w.formatTime(NaN));
T("Infinity → 00:00", w.formatTime(Infinity) === "00:00", w.formatTime(Infinity));
T("−5 → 00:00", w.formatTime(-5) === "00:00", w.formatTime(-5));

console.log("\n[2] Таймер: navigate");
resetTestState();
w.selectRole("student");
w.startTest(1);
const timer1 = w.eval("timerId");
T("таймер запущен", timer1 !== null, timer1);
T("setInterval один", intervals.size === 1, intervals.size);
T("секунды конечны", Number.isFinite(w.eval("secondsLeft")), w.eval("secondsLeft"));
const beforeTick = w.eval("secondsLeft");
tick();
T("тик уменьшает время", w.eval("secondsLeft") === beforeTick - 1, w.eval("secondsLeft"));
// Аудит q2: в фоновой вкладке браузер режет setInterval до 1 раза в минуту.
// Таймер обязан списать всё реально прошедшее время, а не один тик.
const beforeStall = w.eval("secondsLeft");
w.eval("timerLastTick -= 30000;");   // имитация 30 c простоя вкладки
tick();
T("долгий простой списывает реальные 30 c", w.eval("secondsLeft") === beforeStall - 30, w.eval("secondsLeft"));
w.navigate("profile");
T("navigate → timerId = null", w.eval("timerId") === null, w.eval("timerId"));
T("navigate → clearInterval вызван", clearedIds.includes(timer1), clearedIds.join(","));
T("navigate → интервалов не осталось", intervals.size === 0, intervals.size);

console.log("\n[3] Таймер: logout");
resetTestState();
w.selectRole("student");
w.startTest(1);
const timer2 = w.eval("timerId");
w.localStorage.setItem("unitestactivetest", JSON.stringify({ testId: 1, answers: [0], index: 0, timeLeft: 60 }));
w.logout();
T("logout → timerId = null", w.eval("timerId") === null, w.eval("timerId"));
T("logout → clearInterval вызван", clearedIds.includes(timer2), clearedIds.join(","));
T("logout → активный тест сброшен", w.eval("activeTest") === null);
T("logout → прогресс очищен", w.localStorage.getItem("unitestactivetest") === null);
T("logout → прокрутка восстановлена", w.document.body.style.overflow === "", w.document.body.style.overflow);

console.log("\n[4] Таймер: finishTest / closeTestScreen, нет двойного результата");
resetTestState();
w.selectRole("student");
w.startTest(1);
tick();
const timer3 = w.eval("timerId");
const resultsBefore = w.eval("getResults().length");
w.finishTest();
T("finishTest → таймер остановлен", w.eval("timerId") === null, w.eval("timerId"));
T("finishTest → clearInterval вызван", clearedIds.includes(timer3), clearedIds.join(","));
T("finishTest → результат сохранён один раз", w.eval("getResults().length") === resultsBefore + 1, w.eval("getResults().length"));
T("finishTest → экран результата открыт", !D.getElementById("resultScreen").classList.contains("hidden"));
T("finishTest → прогресс удалён", w.localStorage.getItem("unitestactivetest") === null);
w.finishTest();   // повторный вызов (двойной клик)
T("повторный finishTest не дублирует результат", w.eval("getResults().length") === resultsBefore + 1, w.eval("getResults().length"));
w.eval("saveProgress();");
T("после finishTest прогресс не пишется", w.localStorage.getItem("unitestactivetest") === null);

resetTestState();
w.startTest(1);
const timer4 = w.eval("timerId");
w.closeTestScreen();
T("closeTestScreen → таймер остановлен", w.eval("timerId") === null, w.eval("timerId"));
T("closeTestScreen → clearInterval вызван", clearedIds.includes(timer4), clearedIds.join(","));
T("closeTestScreen → экран скрыт", D.getElementById("testScreen").classList.contains("hidden"));
T("closeTestScreen → прогресс удалён", w.localStorage.getItem("unitestactivetest") === null);

console.log("\n[5] «Время вышло»: авто-завершение один раз");
resetTestState();
w.selectRole("student");
w.startTest(1);
const timeUpCb = [...intervals.values()][0];
const alertsBefore = app.alerts.length;
const resultsBeforeTimeout = w.eval("getResults().length");
w.eval("secondsLeft = 1");
timeUpCb();
T("таймер остановлен", w.eval("timerId") === null, w.eval("timerId"));
T("alert «Время вышло» показан", app.alerts.length === alertsBefore + 1 && app.alerts[app.alerts.length - 1] === tr.timeUp, app.alerts.slice(-2).join(" | "));
T("тест завершён автоматически", w.eval("testSessionFinished") === true);
T("экран результата открыт", !D.getElementById("resultScreen").classList.contains("hidden"));
T("результат сохранён один раз", w.eval("getResults().length") === resultsBeforeTimeout + 1, w.eval("getResults().length"));
timeUpCb();   // «протухший» колбэк из старого интервала
T("повторный тик не даёт второго alert", app.alerts.length === alertsBefore + 1, app.alerts.length - alertsBefore);
T("повторный тик не дублирует результат", w.eval("getResults().length") === resultsBeforeTimeout + 1, w.eval("getResults().length"));

console.log("\n[6] Битый timeLimit → конечные секунды");
resetTestState();
w.selectRole("student");
w.eval(`mockTests.push(Object.assign({}, mockTests[0], { id: 'test_42_nolimit', timeLimit: undefined }));`);
w.startTest("test_42_nolimit");
T("secondsLeft — конечное число", Number.isFinite(w.eval("secondsLeft")), w.eval("secondsLeft"));
T("fallback = 1 минута", w.eval("secondsLeft") === 60, w.eval("secondsLeft"));
T("таймер работает", w.eval("timerId") !== null, w.eval("timerId"));
w.closeTestScreen();
w.eval(`const i = mockTests.findIndex(t => t.id === 'test_42_nolimit'); if (i >= 0) mockTests.splice(i, 1);`);

console.log("\n[7] Восстановление прогресса");
// 7.1 Нормальное сохранение
resetTestState();
w.localStorage.setItem("unitestactivetest", JSON.stringify({ testId: 1, answers: [0, 1], index: 3, timeLeft: 120 }));
w.startTest(1);
T("ответы восстановлены и выровнены", JSON.stringify(w.eval("userAnswers")) === JSON.stringify([0, 1, null, null, null]), JSON.stringify(w.eval("userAnswers")));
T("индекс восстановлен", w.eval("currentQuestionIndex") === 3, w.eval("currentQuestionIndex"));
T("время восстановлено", w.eval("secondsLeft") === 120, w.eval("secondsLeft"));
w.closeTestScreen();

// 7.2 id числом/строкой — сравниваем как строки
resetTestState();
w.localStorage.setItem("unitestactivetest", JSON.stringify({ testId: "1", answers: [], index: 0, timeLeft: 90 }));
w.startTest(1);
T("строковый testId сопоставляется с числовым", w.eval("secondsLeft") === 90, w.eval("secondsLeft"));
w.closeTestScreen();

// 7.3 Просроченное сохранение (00:00) не восстанавливаем
resetTestState();
w.localStorage.setItem("unitestactivetest", JSON.stringify({ testId: 1, answers: [], index: 0, timeLeft: 0 }));
w.startTest(1);
T("просроченное сохранение → полный лимит", w.eval("secondsLeft") === 2700, w.eval("secondsLeft"));
T("просроченное сохранение удалено", w.localStorage.getItem("unitestactivetest") === null);
w.closeTestScreen();

// 7.4 Битые ответы
resetTestState();
w.localStorage.setItem("unitestactivetest", JSON.stringify({ testId: 1, answers: "oops", index: "x", timeLeft: 60 }));
w.startTest(1);
T("битые ответы → массив нужной длины", JSON.stringify(w.eval("userAnswers")) === JSON.stringify([null, null, null, null, null]), JSON.stringify(w.eval("userAnswers")));
T("битый индекс → 0", w.eval("currentQuestionIndex") === 0, w.eval("currentQuestionIndex"));
T("время из сохранения принято", w.eval("secondsLeft") === 60, w.eval("secondsLeft"));
w.closeTestScreen();

// 7.5 Чужой тест не восстанавливаем
resetTestState();
w.localStorage.setItem("unitestactivetest", JSON.stringify({ testId: 2, answers: [], index: 0, timeLeft: 100 }));
w.startTest(1);
T("сохранение другого теста игнорируется", w.eval("secondsLeft") === 2700, w.eval("secondsLeft"));
w.closeTestScreen();
w.eval("clearProgress();");

console.log("\n[8] Пустые массивы и деление на ноль");
resetTestState();
const savedQuestions = w.eval("mockQuestions.slice()");
const alertsQ = app.alerts.length;
w.eval("mockQuestions.length = 0;");
w.eval("activeTest = null; currentQuestionIndex = 0; userAnswers = []; renderQuestion();");
T("renderQuestion(0 вопросов) не бросает ошибку", app.errors.length === 0, app.errors.slice(0, 2).join(" | "));
T("показан alert «нет вопросов»", app.alerts.length === alertsQ + 1 && app.alerts[app.alerts.length - 1] === tr.testNoQuestions, app.alerts.slice(-2).join(" | "));
T("экран теста скрыт", D.getElementById("testScreen").classList.contains("hidden"));
const width = D.getElementById("testProgressFill").style.width;
T("прогресс-бар без NaN", !/NaN/.test(width), width);

const emptyResult = JSON.parse(w.eval("JSON.stringify(calcResult())"));
T("calcResult: total = 0", emptyResult.total === 0, emptyResult.total);
T("calcResult: percent = 0 (без деления на 0)", emptyResult.percent === 0, emptyResult.percent);
T("calcResult: timeSpent — конечное число", Number.isFinite(emptyResult.timeSpent), emptyResult.timeSpent);

w.eval("mockQuestions.push(..." + JSON.stringify(savedQuestions) + ");");
T("вопросы восстановлены", w.eval("mockQuestions.length") === 5, w.eval("mockQuestions.length"));

// Битый индекс не выходит за границы
resetTestState();
w.selectRole("student");
w.startTest(1);
w.eval("currentQuestionIndex = 999; renderQuestion();");
T("индекс 999 прижат к последнему вопросу", w.eval("currentQuestionIndex") === 4, w.eval("currentQuestionIndex"));
T("счётчик «Вопрос 5 из 5»", D.getElementById("testQCount").textContent.includes("5"), D.getElementById("testQCount").textContent);
T("прогресс 100%", D.getElementById("testProgressFill").style.width === "100%", D.getElementById("testProgressFill").style.width);
w.closeTestScreen();

console.log("\n[9] Повторная инициализация не дублирует обработчики");
T("appInitialized = true", w.eval("appInitialized") === true);
const alertsBeforeInit = app.alerts.length;
w.eval("currentTheme = 'light'; applyTheme();");
w.initApp();   // повторный вызов (как повторный DOMContentLoaded)
T("повторный initApp не дублирует обработчики темы", (() => {
  D.getElementById("themeToggle").click();
  return w.eval("currentTheme") === "dark";
})(), w.eval("currentTheme"));
T("повторный initApp не плодит alert", app.alerts.length === alertsBeforeInit, app.alerts.length - alertsBeforeInit);
w.eval("currentTheme = 'light'; applyTheme();");

console.log("\n[9.1] Модалка схем: Esc-обработчик не дублируется при пересоздании");
w.eval("currentLang = 'ru'; applyLanguage(); openDiagramModal();");
const escHandler1 = w.eval("diagramEscHandler");
w.eval("currentLang = 'en'; applyLanguage(); openDiagramModal();");
const escHandler2 = w.eval("diagramEscHandler");
T("diagramEscHandler навешен один раз", typeof escHandler1 === "function" && escHandler1 === escHandler2);
w.eval("closeDiagramModal(); currentLang = 'ru'; applyLanguage();");

console.log("\n[10] Консоль");
T("console.error пуст", app.errors.length === 0, app.errors.slice(0, 3).join(" | "));

console.log(`\n=== TEST42: пройдено ${pass}, провалено ${fail} ===`);
app.close();
process.exit(fail === 0 ? 0 : 1);
