/* Тест Промта №14 — Сохранение теста и раздел «Мои тесты» (+ доработки 14.1)
   Запуск: node test15.js   (jsdom установлен в этой же папке) */
const fs = require("fs");
const { JSDOM } = require("jsdom");

const HTML_PATH = require("path").join(__dirname, "..", "index.html");
const html = fs.readFileSync(HTML_PATH, "utf8");

let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log("  ok | " + name); }
  else { fail++; console.log("  FAIL | " + name + (extra !== undefined ? "  -> " + extra : "")); }
}

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
  // и не выполнится loadTestsFromStorage). Повторный реальный DCL не наступает:
  // весь тест выполняется без yield, затем process.exit().
  if (dom.window.document.readyState === "loading") dom.window.initApp();
  return dom.window;
}
function safeJson(x) { try { return JSON.stringify(x); } catch (e) { return String(x); } }
const hasLog = (w, s) => w.__logs.log.some(l => l.includes(s));

// ===== 1. ПРЕПОДАВАТЕЛЬ: шаг 1 → конструктор вопросов =====
console.log("\n[1] Преподаватель: форма шага 1 и конструктор");
const w = makeWindow(null);
T("initApp выполнился (лог инициализации)", hasLog(w, "Приложение инициализировано"));

// ===== LaTeX: подключение KaTeX и функция renderMath =====
T("KaTeX CSS подключён в <head>", html.includes("katex@0.16.8/dist/katex.min.css"));
T("KaTeX-скрипты подключены (katex.js + auto-render.js)",
  html.includes("katex@0.16.8/dist/katex.min.js") && html.includes("katex@0.16.8/dist/contrib/auto-render.min.js"));
T("функция renderMath определена", typeof w.eval("renderMath") === "function");
// Шпион: в jsdom внешние скрипты не грузим, подставляем свой renderMathInElement
const mathCalls = [];
w.renderMathInElement = (el, opts) => {
  mathCalls.push({ id: el.id || el.className, left: opts.delimiters[0].left, count: opts.delimiters.length });
};

w.selectRole("teacher");
T("sidebar преподавателя отрендерен", !!w.document.querySelector("#sidebarMenu .menu-item"));

w.navigate("createTest");
const form = w.document.getElementById("createTestForm");
T("форма создания теста открыта", !!form);
T("лог «Форма создания теста открыта»", hasLog(w, "Форма создания теста открыта"));

const ctHint = w.document.querySelector("#ctName").closest(".field").querySelector(".field-hint");
T("подсказка о формулах под названием теста", !!ctHint && ctHint.textContent.includes("$x^2$"),
  ctHint ? ctHint.textContent : "нет");

const courseOpts = [...w.document.querySelectorAll("#ctCourse option")].map(o => o.value);
T("доступны только свои курсы (1 и 2)", JSON.stringify(courseOpts) === JSON.stringify(["1", "2"]), courseOpts);

const groupVals = [...w.document.querySelectorAll('#ctGroups input[name="ctGroup"]')].map(c => c.value);
T("группы курса 1 — только свои (101-PR, без чужой 102-DZ)",
  JSON.stringify(groupVals) === JSON.stringify(["101-PR"]), groupVals);

// Заполняем шаг 1 (в названии — спецсимволы для проверки экранирования)
w.document.getElementById("ctName").value = "<b>Тест по алгебре</b>";
w.document.getElementById("ctForm").value = "both";
w.document.querySelector('#ctGroups input[name="ctGroup"]').checked = true;
w.document.getElementById("ctQuestions").value = "2";
w.document.getElementById("ctTime").value = "25";
form.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));

T("переход в конструктор вопросов (#qbAdd)", !!w.document.getElementById("qbAdd"));
T("черновик создан (2 вопроса по плану)", w.eval("currentTestDraft.questionsCount") === 2);
T("группы черновика = ['101-PR']", safeJson(w.eval("currentTestDraft.groups")) === '["101-PR"]');
T("лог «Черновик теста сохранён»", hasLog(w, "Черновик теста сохранён"));
T("счётчик «Добавлено: 0 из 2»",
  w.document.getElementById("sectionContent").textContent.includes("0 из 2"));

const qHint = w.document.querySelector("#qText").closest(".field").querySelector(".field-hint");
T("подсказка о формулах под текстом вопроса (Промт 13)",
  !!qHint && qHint.textContent === w.eval("translations.ru.formulaHint"),
  qHint ? qHint.textContent : "нет");

// ===== 2. Валидации Промта №13 =====
console.log("\n[2] Валидации добавления вопроса");
const add = w.document.getElementById("qbAdd");
add.click();
T("пустой текст → «Введите текст вопроса»", w.__alerts[0] === "Введите текст вопроса", w.__alerts[0]);

w.document.getElementById("qText").value = "Сколько будет 2+2?";
add.click();
T("незаполненные варианты → «Заполните все 4 варианта ответов»",
  w.__alerts[1] === "Заполните все 4 варианта ответов", w.__alerts[1]);

[0, 1, 2, 3].forEach(i => { w.document.getElementById("qOpt" + i).value = String(i + 1); });
add.click();
T("нет правильного → «Отметьте правильный вариант ответа»",
  w.__alerts[2] === "Отметьте правильный вариант ответа", w.__alerts[2]);
T("вопросов пока нет", w.eval("currentTestDraft.questions.length") === 0);

// ===== 3. Добавление / удаление вопросов =====
console.log("\n[3] Добавление и удаление вопросов");
w.document.getElementById("qCorr2").checked = true;
add.click();
T("вопрос 1 добавлен", w.eval("currentTestDraft.questions.length") === 1);
T("лог «Вопрос добавлен. Всего вопросов: 1»", hasLog(w, "Вопрос добавлен. Всего вопросов: 1"));
T("лог «Текущий черновик:»", hasLog(w, "Текущий черновик:"));
T("счётчик «1 из 2»", w.document.getElementById("sectionContent").textContent.includes("1 из 2"));
T("в списке 1 элемент", w.document.querySelectorAll("#qList .q-item").length === 1);
T("renderMath → предпросмотр вопроса #qList (Промт 13)", mathCalls.some(c => c.id === "qList"));
T("renderMath: разделители $$ (display) и $ (inline)",
  mathCalls.length > 0 && mathCalls[0].left === "$$" && mathCalls[0].count === 2,
  safeJson(mathCalls[0]));

// второй вопрос (достигаем лимита)
w.document.getElementById("qText").value = "Столица Узбекистана?";
[0, 1, 2, 3].forEach(i => { w.document.getElementById("qOpt" + i).value = "v" + i; });
w.document.getElementById("qCorr1").checked = true;
add.click();
T("счётчик «2 из 2»", w.document.getElementById("sectionContent").textContent.includes("2 из 2"));
T("зелёное уведомление видно", w.document.getElementById("qbDone").classList.contains("is-visible"));
T("кнопка добавления заблокирована", w.document.getElementById("qbAdd").disabled === true);

// удаляем первый вопрос
w.document.querySelector("#qList .q-delete").click();
T("после удаления 1 вопрос", w.eval("currentTestDraft.questions.length") === 1);
T("счётчик пересчитан → «1 из 2»", w.document.getElementById("sectionContent").textContent.includes("1 из 2"));
T("кнопка добавления снова активна", w.document.getElementById("qbAdd").disabled === false);
T("уведомление скрыто", !w.document.getElementById("qbDone").classList.contains("is-visible"));

// третий вопрос (вернуть лимит)
w.document.getElementById("qText").value = "Правильная столица — Ташкент?";
[0, 1, 2, 3].forEach(i => { w.document.getElementById("qOpt" + i).value = "o" + i; });
w.document.getElementById("qCorr0").checked = true;
add.click();
T("снова «2 из 2»", w.document.getElementById("sectionContent").textContent.includes("2 из 2"));

// ===== 4. Сохранение теста (Промт №14) =====
console.log("\n[4] saveTestToDB() → localStorage → раздел «Мои тесты»");
T("mockTests не тронут до сохранения", w.eval("mockTests.length") === 6);
w.document.getElementById("qbFinish").click();

T("лог «Сохранение теста»", hasLog(w, "Сохранение теста:"));
T("лог «Всего тестов в базе после сохранения: 7»", hasLog(w, "Всего тестов в базе после сохранения: 7"));
T("в памяти 7 тестов", w.eval("mockTests.length") === 7);
T("черновик очищен", w.eval("currentTestDraft") === null);

const raw = w.localStorage.getItem("unitestalltests");
T("localStorage unitestalltests записан", !!raw && JSON.parse(raw).length === 7);

const saved = JSON.parse(raw)[6];
T("id вида test_...", String(saved.id).startsWith("test_"), saved.id);
T("author = Sardor Rahimov", saved.author === "Sardor Rahimov", saved.author);
T("teacher = Sardor Rahimov", saved.teacher === "Sardor Rahimov");
T("status = active", saved.status === "active");
T("title сохранён как есть", saved.title === "<b>Тест по алгебре</b>", saved.title);

// маппинг target* под фильтр студента (самопроверка №4)
T("targetCourse = 1", saved.targetCourse === 1, saved.targetCourse);
T("targetDirection = programming", saved.targetDirection === "programming", saved.targetDirection);
T("targetGroup = ['101-PR']", safeJson(saved.targetGroup) === '["101-PR"]', safeJson(saved.targetGroup));
T("targetForm 'both' → ['full','part']", safeJson(saved.targetForm) === '["full","part"]', safeJson(saved.targetForm));
T("questions сохранены (2 шт.)", Array.isArray(saved.questions) && saved.questions.length === 2);
T("questionsCount = 2, timeLimit = 25", saved.questionsCount === 2 && saved.timeLimit === 25);
T("deadline в формате DD.MM.YYYY", /^\d{2}\.\d{2}\.\d{4}$/.test(saved.deadline), saved.deadline);

// раздел «Мои тесты»
T("заголовок раздела «Мои тесты»",
  w.document.getElementById("sectionHeading").textContent.includes("Мои тесты"),
  w.document.getElementById("sectionHeading").textContent);
T("лог «Мои тесты. Найдено: 1»", hasLog(w, "Мои тесты. Найдено: 1"));
const cards = w.document.querySelectorAll(".test-card");
T("одна карточка теста", cards.length === 1, cards.length);
T("карточка: название отображается", cards[0].textContent.includes("Тест по алгебре"));
T("карточка: HTML экранирован (нет сырого <b>)",
  cards[0].innerHTML.includes("&lt;b&gt;") && !cards[0].innerHTML.includes("<b>Тест"));
T("карточка: бейдж «Активен»", cards[0].querySelector(".test-status-badge").textContent.includes("Активен"));
T("карточка: группы/курс/вопросы/время", ["101-PR", "1 курс", "2 вопросов", "25 мин"]
  .every(s => cards[0].textContent.includes(s)), cards[0].textContent.replace(/\s+/g, " "));
T("renderMath → раздел «Мои тесты» #sectionContent (Промт 14)",
  mathCalls.some(c => c.id === "sectionContent"));

// дашборд: счётчик активных тестов 2 + 1 = 3
w.navigate("dashboard");
const stats = [...w.document.querySelectorAll(".stat-value")].map(e => e.textContent);
T("дашборд: активные тесты = 3", stats.includes("3"), safeJson(stats));

// локализация раздела
w.navigate("myTests");
w.document.querySelector('.lang-btn[data-lang="en"]').click();
T("EN: бейдж Active",
  w.document.querySelector(".test-status-badge").textContent.includes("Active"),
  w.document.querySelector(".test-status-badge").textContent);
w.document.querySelector('.lang-btn[data-lang="uz"]').click();
T("UZ: бейдж Faol",
  w.document.querySelector(".test-status-badge").textContent.includes("Faol"));
w.document.querySelector('.lang-btn[data-lang="ru"]').click();
T("RU: бейдж Активен",
  w.document.querySelector(".test-status-badge").textContent.includes("Активен"));

// ===== 5. СТУДЕНТ: видит тест и проходит ЕГО вопросы =====
console.log("\n[5] Студент: фильтр, запуск, свои вопросы, результат");
w.logout();
w.selectRole("student");
w.navigate("availableTests");

T("лог «Всего тестов в базе: 7»", hasLog(w, "Всего тестов в базе: 7"));
T("лог «после фильтрации для студента: 5»", hasLog(w, "Тестов после фильтрации для студента: 5"));
const sCards = [...w.document.querySelectorAll(".test-card")];
T("студент видит 5 тестов (4 демо + новый)", sCards.length === 5, sCards.length);

const newCard = sCards.find(c => c.textContent.includes("Тест по алгебре"));
T("новый тест найден в списке студента", !!newCard);
newCard.querySelector(".btn-start").click();

T("экран теста открыт", !w.document.getElementById("testScreen").classList.contains("hidden"));
T("renderMath → экран прохождения #testScreen (Промт 5)", mathCalls.some(c => c.id === "testScreen"));
T("вопросов в тесте ровно 2 (свои, не мок)", w.eval("activeQuestions().length") === 2);
T("первый вопрос — из созданного теста",
  w.document.getElementById("testScreen").textContent.includes("Столица Узбекистана?"));

// отвечаем на оба вопроса правильно
w.document.querySelector('#testOptions .test-option[data-index="1"]').click();
w.document.getElementById("testNextBtn").click();
w.document.querySelector('#testOptions .test-option[data-index="0"]').click();
w.document.getElementById("testFinishBtn").click();

T("экран результата открыт", !w.document.getElementById("resultScreen").classList.contains("hidden"));
T("результат 100% (2 из 2 по СВОИМ вопросам)",
  w.document.getElementById("resultScreen").textContent.includes("100%"));
T("renderMath → экран результата #resultScreen (Промт 7)", mathCalls.some(c => c.id === "resultScreen"));
T("лог подсчёта «Правильных: 2 из 2»", hasLog(w, "Правильных: 2 из 2"));
w.backToTests();
T("вернулись к списку", w.document.getElementById("testScreen").classList.contains("hidden"));

// ===== 6. ПЕРЕЗАГРУЗКА: тесты восстанавливаются =====
console.log("\n[6] Перезагрузка страницы (восстановление из localStorage)");
const snap = {};
for (let i = 0; i < w.localStorage.length; i++) {
  const k = w.localStorage.key(i);
  snap[k] = w.localStorage.getItem(k);
}
const w2 = makeWindow(snap);
w2.selectRole("teacher");
w2.navigate("myTests");
T("лог «Тесты восстановлены из localStorage: 7»", hasLog(w2, "Тесты восстановлены из localStorage: 7"));
T("после перезагрузки 1 карточка", w2.document.querySelectorAll(".test-card").length === 1,
  w2.document.querySelectorAll(".test-card").length);

// демо-тест студента по-прежнему берёт мок-вопросы (берём непройданный — у пройденных нет кнопки)
w2.logout();
w2.selectRole("student");
w2.navigate("availableTests");
const demoCard = [...w2.document.querySelectorAll(".test-card")]
  .find(c => { const b = c.querySelector(".btn-start"); return b && b.dataset.testId === "2"; });
T("демо-карточка теста №2 (с кнопкой «Начать») найдена", !!demoCard);
if (demoCard) {
demoCard.querySelector(".btn-start").click();
T("демо-тест №2: 5 мок-вопросов (регресс не сломан)", w2.eval("activeQuestions().length") === 5,
  w2.eval("activeQuestions().length"));
w2.eval("closeTestScreen()");
}

// ===== 7. УДАЛЕНИЕ ТЕСТА =====
console.log("\n[7] Удаление теста и заглушка");
w.logout();
w.selectRole("teacher");
w.navigate("myTests");
T("перед удалением 1 карточка", w.document.querySelectorAll(".test-card").length === 1);
w.document.querySelector(".tt-delete").click();

T("лог «Тест удалён»", hasLog(w, "Тест удалён:"));
T("после удаления — заглушка с кнопкой", !!w.document.getElementById("ttCreateFirst"));
T("заглушка: текст «Вы еще не создали…»",
  w.document.getElementById("sectionContent").textContent.includes("Вы еще не создали ни одного теста"));
T("в памяти снова 6 тестов", w.eval("mockTests.length") === 6);
T("localStorage обновлён (6)", JSON.parse(w.localStorage.getItem("unitestalltests")).length === 6);

w.document.getElementById("ttCreateFirst").click();
T("«Создать первый тест» ведёт на шаг 1", !!w.document.getElementById("createTestForm"));

// ===== 8. Статический паритет переводов =====
console.log("\n[8] Переводы ru/uz/en");
const keys = ["myTestsEmpty", "createFirstTest", "statusActive", "btnDelete", "myTests", "formulaHint"];
const langs = ["ru", "uz", "en"];
const missing = [];
langs.forEach(l => keys.forEach(k => {
  if (!w.eval(`translations.${l}.${k}`)) missing.push(l + "." + k);
}));
T("все новые ключи есть во всех языках", missing.length === 0, missing.join(", "));
T("ru: myTestsEmpty по ТЗ",
  w.eval("translations.ru.myTestsEmpty") === "Вы еще не создали ни одного теста");
T("en: statusActive = Active", w.eval("translations.en.statusActive") === "Active");
T("formulaHint во всех языках содержит пример $x^2$",
  ["ru", "uz", "en"].every(l => w.eval(`translations.${l}.formulaHint`).includes("$x^2$")));

// ===== Итог =====
console.log(`\n=== ИТОГ: пройдено ${pass}, провалено ${fail} ===`);
process.exit(fail ? 1 : 0);
