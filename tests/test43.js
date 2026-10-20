/* test43.js — Промт №43: UI/UX стресс-тест вёрстки (v2).
   Проверяем:
     - защиту от длинного текста (карточки, таблицы, пузыри чата);
     - обрезку однострочных заголовков;
     - мобильные таблицы (.table-responsive) и модалки (85vh + прокрутка);
     - видимый фокус, Tab-ловушку, Esc и aria у модалок;
     - доступное имя и возврат фокуса в модалке уведомления;
     - 150-символьное название теста, 100 вопросов, 0 вопросов;
     - большую таблицу пользователей, длинное сообщение в чате;
     - переводы ru/uz/en и чистую консоль.
   Запуск: node tests/test43.js */
const fs = require("fs");
const { createApp, HTML_PATH } = require("./harness");

const html = fs.readFileSync(HTML_PATH, "utf8");
const css = (html.match(/<style>([\s\S]*?)<\/style>/) || ["", ""])[1];
const taskCss = css.slice(css.indexOf("ПРОМТ №43"));
const app = createApp();
const w = app.window, d = app.document;
const translations = JSON.parse(app.eval("JSON.stringify(translations)"));

let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log("  ok | " + name); }
  else { fail++; console.log("  FAIL | " + name + (extra !== undefined ? "  -> " + extra : "")); }
}
const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
const cssHas = (re) => re.test(taskCss);
const evalJson = (expr) => app.eval(`JSON.stringify(${expr})`);
const pushTest = (test) => app.eval(`mockTests.push(${JSON.stringify(test)})`);

console.log("\n[1] CSS: фокус, длинный текст, обрезка");
T("есть глобальное правило *:focus-visible", cssHas(/\*:focus-visible\s*\{[^}]*outline\s*:\s*2px solid var\(--accent\)/));
T("контур фокуса с отступом 2px", cssHas(/\*:focus-visible\s*\{[^}]*outline-offset\s*:\s*2px/));
T("у кнопок/полей скругление контура 4px",
  cssHas(/button:focus-visible[\s\S]{0,400}border-radius\s*:\s*4px/));
T("word-wrap: break-word", cssHas(/word-wrap\s*:\s*break-word/));
T("overflow-wrap: anywhere/break-word", cssHas(/overflow-wrap\s*:\s*(anywhere|break-word)/));
T("word-break: break-word", cssHas(/word-break\s*:\s*break-word/));
T("hyphens: auto", cssHas(/hyphens\s*:\s*auto/));
T("карточки тестов/групп/пользователей защищены",
  cssHas(/\.test-card,\s*[\s\S]{0,400}\.admin-user-card[\s\S]{0,200}\{\s*min-width:\s*0/));
T("пузырь чата переносит длинный текст",
  /\.chat-msg-text[\s\S]{0,600}overflow-wrap\s*:\s*anywhere/.test(css));
T("заголовок группы обрезается многоточием",
  cssHas(/\.group-card \.group-name,[\s\S]{0,300}white-space:\s*nowrap;[\s\S]{0,120}overflow:\s*hidden;[\s\S]{0,120}text-overflow:\s*ellipsis/));
T("ячейки таблиц переносят длинный текст",
  cssHas(/\.transcript-table td,[\s\S]{0,200}\.results-table td\s*\{[^}]*overflow-wrap\s*:\s*anywhere/));
T("есть стиль бейджа «нет вопросов»", cssHas(/\.test-empty-badge\s*\{[^}]*border-radius/));

console.log("\n[2] Таблицы и модалки");
T(".table-responsive: width 100%", cssHas(/\.table-responsive\s*\{[^}]*width\s*:\s*100%/));
T(".table-responsive: overflow-x auto", cssHas(/\.table-responsive\s*\{[^}]*overflow-x\s*:\s*auto/));
T(".table-responsive: touch-скролл", cssHas(/\.table-responsive\s*\{[^}]*-webkit-overflow-scrolling\s*:\s*touch/));
const tableCount = (html.match(/<table\b/g) || []).length;
const wrappedCount = (html.match(/class="[^"]*table-responsive[^"]*"/g) || []).length;
T("все таблицы обёрнуты в .table-responsive", tableCount > 0 && wrappedCount >= tableCount,
  `таблиц=${tableCount}, обёрток=${wrappedCount}`);
T("модалка апелляции не выше 85vh", cssHas(/\.pt-window\.appeal-modal[\s\S]{0,200}max-height\s*:\s*85vh/));
T("модалка апелляции прокручивается", cssHas(/\.pt-window\.appeal-modal[\s\S]{0,240}overflow-y\s*:\s*auto/));
T("модалки ограничены 85vh", cssHas(/\.pt-window\.ann-modal,[\s\S]{0,260}max-height\s*:\s*85vh/));
T("админ-модалка — flex-колонка", cssHas(/\.admin-modal\s*\{[^}]*display\s*:\s*flex;[^}]*flex-direction\s*:\s*column/));
T("прокручиваются только поля формы", cssHas(/\.admin-modal-form \.form-grid\s*\{[^}]*overflow-y\s*:\s*auto/));
T("кнопки формы не прокручиваются", cssHas(/\.admin-modal \.form-actions\s*\{[^}]*flex\s*:\s*0 0 auto/));
T("на телефоне модалка не выше экрана", cssHas(/max-height\s*:\s*calc\(100dvh\s*-\s*20px\)/));

console.log("\n[3] Длинный текст: тест на 150 символов");
w.selectRole("student");
const longTitle = ("Очень длинное название контрольного теста по программированию с формулами и схемами " +
  "<b>XSS</b> ").padEnd(150, "X");
const longTeacher = ("Преподаватель с очень длинной фамилией и инициалами ").padEnd(120, "Y");
const longTest = {
  id: "test_43_long", title: longTitle, subject: "math", num: 1, teacher: longTeacher,
  questionsCount: 5, timeLimit: 30, deadline: "01.11.2026",
  targetCourse: 1, targetDirection: "programming", targetGroup: ["101-PR"],
  targetForm: ["full"], author: "Teacher Long", status: "active",
  questions: [0, 1, 2, 3, 4].map(i => ({ text: "Вопрос " + (i + 1), options: ["A", "B", "C", "D"], correct: 0 }))
};
pushTest(longTest);
w.navigate("availableTests");
const longCard = [...d.querySelectorAll("#sectionContent .test-card")]
  .find(card => txt(card.querySelector(".test-title")) === longTitle);
T("карточка с 150-символьным названием отрисована", !!longCard);
T("название не обрезано в данных", longCard && txt(longCard.querySelector(".test-title")) === longTitle,
  longCard && longCard.querySelector(".test-title").textContent.length);
T("HTML в названии экранирован (<b> как текст)", longCard && !longCard.querySelector(".test-title b") &&
  txt(longCard.querySelector(".test-title")).includes("<b>XSS</b>"));
T("длинное ФИО преподавателя в карточке", longCard &&
  txt(longCard.querySelector(".test-teacher")).includes(longTeacher));
T("карточка — колонка без горизонтального растяжения",
  longCard && w.getComputedStyle(longCard).display === "flex");
T("длинный заголовок покрыт CSS-переносом", /\.test-title,[\s\S]{0,1400}overflow-wrap\s*:\s*anywhere/.test(taskCss));

console.log("\n[4] Сто вопросов");
const questions100 = Array.from({ length: 100 }, (_, i) => ({
  text: "Стресс-вопрос №" + (i + 1), options: ["A", "B", "C", "D"], correct: i % 4
}));
pushTest({
  ...longTest,
  id: "test_43_100", teacher: "Sardor Rahimov", questionsCount: 100,
  questions: questions100, title: "Стресс-тест на 100 вопросов"
});
w.navigate("availableTests");
T("тест на 100 вопросов есть в списке",
  [...d.querySelectorAll("#sectionContent .test-title")].some(el => txt(el) === "Стресс-тест на 100 вопросов"));
w.startTest("test_43_100");
T("экран теста открыт", !d.getElementById("testScreen").classList.contains("hidden"));
T("счётчик «Вопрос 1 из 100»", txt(d.getElementById("testQCount")) === "Вопрос 1 из 100",
  txt(d.getElementById("testQCount")));
T("кнопка «Назад» неактивна на первом", d.getElementById("testPrevBtn").disabled);
w.eval("currentQuestionIndex = 99; renderQuestion();");
T("счётчик «Вопрос 100 из 100»", txt(d.getElementById("testQCount")) === "Вопрос 100 из 100",
  txt(d.getElementById("testQCount")));
T("прогресс-бар заполнен на 100%", d.getElementById("testProgressFill").style.width === "100%",
  d.getElementById("testProgressFill").style.width);
T("кнопка «Далее» неактивна на последнем", d.getElementById("testNextBtn").disabled);
T("нет ошибок при 100 вопросах", app.errors.length === 0, app.errors.slice(0, 2).join(" | "));
w.closeTestScreen();

console.log("\n[5] Ноль вопросов");
pushTest({
  ...longTest,
  id: "test_43_zero", questionsCount: 0, questions: [],
  title: "Тест без вопросов"
});
w.navigate("availableTests");
const zeroCard = [...d.querySelectorAll("#sectionContent .test-card")]
  .find(card => txt(card.querySelector(".test-title")) === "Тест без вопросов");
T("карточка пустого теста отрисована", !!zeroCard);
T("у пустого теста нет кнопки «Начать»", zeroCard && !zeroCard.querySelector(".btn-start"));
T("вместо кнопки — бейдж «нет вопросов»", zeroCard && !!zeroCard.querySelector(".test-empty-badge"));
T("бейдж переведён (ru)", zeroCard && txt(zeroCard.querySelector(".test-empty-badge")) === translations.ru.testNoQuestions,
  zeroCard && txt(zeroCard.querySelector(".test-empty-badge")));
const alertsBefore = app.alerts.length;
w.startTest("test_43_zero");
T("запуск пустого теста блокируется", d.getElementById("testScreen").classList.contains("hidden"));
T("пользователю показано объяснение", app.alerts.length > alertsBefore &&
  app.alerts[app.alerts.length - 1] === translations.ru.testNoQuestions,
  app.alerts[app.alerts.length - 1]);

console.log("\n[6] Длинное сообщение в чате");
w.navigate("chat");
const longMessage = ("Сверхдлинноесообщениебезпробелов").repeat(20).slice(0, 600);
const chatInput = d.getElementById("chatInput");
T("поле чата доступно", !!chatInput);
if (chatInput) {
  chatInput.value = longMessage;
  d.getElementById("chatSendBtn").click();
}
const ownMsgs = [...d.querySelectorAll("#sectionContent .chat-msg--own .chat-msg-text")];
T("длинное сообщение добавлено", ownMsgs.some(el => txt(el) === longMessage),
  ownMsgs.length ? ownMsgs[ownMsgs.length - 1].textContent.length : 0);
T("длинное сообщение сохранено без обрезки",
  JSON.parse(evalJson("mockMessages")).some(m => m.text === longMessage));
T("пузырь чата не содержит разметки", ownMsgs.every(el => el.querySelector("img,script,b") === null));

console.log("\n[7] Большая таблица пользователей");
app.eval(`for (let i = 0; i < 120; i++) {
  mockAllStudents.push({ id: 'stress_' + i, name: 'Студент С Very Long Фамилия ' + i, group: '101-PR', course: 1, form: 'full', category: 'regular' });
}`);
w.selectRole("admin");
w.navigate("users");
const rows = d.querySelectorAll("#adminUsersRows tr");
T("таблица выдержала 120+ пользователей", rows.length >= 120, rows.length);
T("обёртка таблицы — .table-responsive", !!d.querySelector("#sectionContent .admin-users-table-wrap.table-responsive"));
T("у таблицы 4 колонки", d.querySelectorAll("#adminUsersRows tr:first-child td").length === 4,
  d.querySelectorAll("#adminUsersRows tr:first-child td").length);
T("длинные имена не ломают строку (текст на месте)",
  [...rows].some(r => txt(r).includes("Студент С Very Long Фамилия")));
T("мобильные карточки тоже построены", d.querySelectorAll("#adminUsersCards .admin-user-card").length >= 120,
  d.querySelectorAll("#adminUsersCards .admin-user-card").length);

console.log("\n[8] Модалки: фокус, Tab, Esc, aria");
w.openAdminGroupModal(null);
let overlay = d.getElementById("adminGroupOverlay");
T("модалка группы открыта", !!overlay);
T("role=dialog + aria-modal", !!overlay && !!overlay.querySelector('[role="dialog"][aria-modal="true"]'));
T("заголовок связан через aria-labelledby",
  !!overlay && !!overlay.querySelector('[aria-labelledby="adminGroupModalTitle"]') &&
  !!d.getElementById("adminGroupModalTitle"));
T("фокус сразу в первом поле", d.activeElement && d.activeElement.id === "adminGroupName",
  d.activeElement && d.activeElement.id);
const focusables = [...overlay.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')];
T("в модалке есть фокусируемые элементы", focusables.length >= 4, focusables.length);
const first = focusables[0], last = focusables[focusables.length - 1];
last.focus();
last.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
T("Tab с последнего элемента возвращает на первый", d.activeElement === first,
  d.activeElement && (d.activeElement.id || d.activeElement.className));
first.focus();
first.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
T("Shift+Tab с первого возвращает на последний", d.activeElement === last,
  d.activeElement && (d.activeElement.id || d.activeElement.className));
d.getElementById("themeToggle").focus();
T("фокус не утекает на страницу под модалкой", overlay.contains(d.activeElement),
  d.activeElement && d.activeElement.id);
d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
T("Esc закрывает модалку", !d.getElementById("adminGroupOverlay"));

w.selectRole("teacher");
w.openTeacherAnnouncementModal();
const annOverlay = d.getElementById("teacherAnnOverlay");
const annClose = d.getElementById("annClose");
T("модалка объявления открыта", !!annOverlay && !annOverlay.classList.contains("hidden"));
T("у кнопки ✕ есть aria-label", !!annClose && annClose.getAttribute("aria-label") === translations.ru.close,
  annClose && annClose.getAttribute("aria-label"));
T("фокус в поле заголовка", d.activeElement && d.activeElement.id === "annTitleInput",
  d.activeElement && d.activeElement.id);
d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
T("Esc закрывает объявление", annOverlay.classList.contains("hidden"));

w.selectRole("student");
w.openAppealModal({ testId: 1, date: "2026-10-20", percent: 80, correct: 4, total: 5, grade: 4 });
const appealOverlay = d.getElementById("appealOverlay");
T("модалка апелляции открыта", !!appealOverlay && !appealOverlay.classList.contains("hidden"));
T("фокус в поле причины", d.activeElement && d.activeElement.id === "appealReasonInput",
  d.activeElement && d.activeElement.id);
T("у модалки апелляции role=dialog", !!appealOverlay.querySelector('[role="dialog"][aria-modal="true"]'));
d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
T("Esc закрывает апелляцию", appealOverlay.classList.contains("hidden"));

console.log("\n[8.1] Модалка уведомления: доступное имя и фокус");
w.toggleNotifications();
const notifLink = d.querySelector('#notifList [data-notif-id][role="button"]');
const openedNotifId = notifLink ? notifLink.dataset.notifId : "";
T("в панели есть уведомление с подробностями", !!notifLink);
if (notifLink) {
  notifLink.focus();
  notifLink.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  const notifModal = d.getElementById("notifModal");
  const notifArticle = d.getElementById("notifArticle");
  const notifTitle = d.getElementById("notifArticleTitle");
  T("Enter по уведомлению открывает модалку", !notifModal.classList.contains("hidden"));
  T("фокус переведён в модалку (кнопка закрытия)",
    d.activeElement && d.activeElement.id === "notifModalClose",
    d.activeElement && (d.activeElement.id || d.activeElement.className));
  T("у модалки есть доступное имя через aria-labelledby",
    notifArticle.getAttribute("aria-labelledby") === "notifArticleTitle" &&
    !!notifTitle && txt(notifTitle).length > 0,
    notifArticle.getAttribute("aria-labelledby"));
  T("у кнопки закрытия модалки есть aria-label",
    d.getElementById("notifModalClose").getAttribute("aria-label") === translations.ru.close,
    d.getElementById("notifModalClose").getAttribute("aria-label"));
  // Аудит q20: открытие статьи сразу помечает уведомление прочитанным.
  T("открытие статьи помечает уведомление прочитанным",
    app.eval(`isNotificationRead(findNotification(${JSON.stringify(openedNotifId)}))`));
  const storedRead = JSON.parse(w.localStorage.getItem("unitestreadnotifications") || "[]");
  T("прочитанный id сохранён в localStorage",
    storedRead.map(String).includes(String(openedNotifId)), JSON.stringify(storedRead));
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  T("Esc закрывает модалку уведомления", notifModal.classList.contains("hidden"));
  T("фокус возвращается на колокольчик", d.activeElement === d.getElementById("bellBtn"),
    d.activeElement && (d.activeElement.id || d.activeElement.className));
  w.toggleNotifications();
  const reopenedNotif = d.querySelector(`#notifList [data-notif-id="${openedNotifId}"]`);
  T("после прочтения у уведомления нет класса unread",
    !!reopenedNotif && !reopenedNotif.classList.contains("unread"));
  w.closeNotifications();
}

console.log("\n[8.2] Кликабельные строки/карточки доступны с клавиатуры");
w.selectRole("admin");
w.navigate("users");
const adminRow = d.querySelector("#adminUsersRows tr[data-admin-user]");
const adminOpenBtn = adminRow && adminRow.querySelector(".row-open-btn");
T("в строке пользователя есть кнопка профиля", !!adminOpenBtn);
T("кнопка профиля — нативный button (Enter/Space)",
  !!adminOpenBtn && adminOpenBtn.tagName === "BUTTON");
T("у кнопки профиля есть доступное имя",
  !!adminOpenBtn && String(adminOpenBtn.getAttribute("aria-label") || "").includes(adminRow.dataset.adminUser),
  adminOpenBtn && adminOpenBtn.getAttribute("aria-label"));
const adminCardOpenBtn = d.querySelector("#adminUsersCards .admin-user-card .row-open-btn");
T("в мобильной карточке пользователя есть кнопка профиля", !!adminCardOpenBtn);
if (adminOpenBtn) {
  app.alerts.length = 0;
  adminOpenBtn.focus();
  adminOpenBtn.click();                       // нативный Enter/Space даёт click
  T("кнопка профиля открывает демо-профиль",
    app.alerts.length === 1 && app.alerts[0].includes(adminRow.dataset.adminUser),
    app.alerts[0]);
}

w.selectRole("manager");
w.navigate("students");
const studentRow = d.querySelector("#managerStudentsRows tr[data-student-name]");
const studentOpenBtn = studentRow && studentRow.querySelector(".row-open-btn");
T("в строке студента есть кнопка профиля", !!studentOpenBtn);
T("кнопка профиля студента — нативный button",
  !!studentOpenBtn && studentOpenBtn.tagName === "BUTTON");
T("у кнопки профиля студента есть доступное имя",
  !!studentOpenBtn && String(studentOpenBtn.getAttribute("aria-label") || "").includes(studentRow.dataset.studentName),
  studentOpenBtn && studentOpenBtn.getAttribute("aria-label"));
const studentCardOpenBtn = d.querySelector("#managerStudentsCards .results-card .row-open-btn");
T("в мобильной карточке студента есть кнопка профиля", !!studentCardOpenBtn);
if (studentOpenBtn) {
  app.alerts.length = 0;
  studentOpenBtn.focus();
  studentOpenBtn.click();
  T("кнопка профиля студента открывает демо-профиль",
    app.alerts.length === 1 && app.alerts[0].includes(studentRow.dataset.studentName),
    app.alerts[0]);
}

console.log("\n[9] Переводы и консоль");
for (const lang of ["ru", "uz", "en"]) {
  T(`testNoQuestions есть (${lang})`, !!(translations[lang] && String(translations[lang].testNoQuestions || "").trim()),
    translations[lang] && translations[lang].testNoQuestions);
}
T("uz/en без кириллицы",
  !/[А-Яа-яЁё]/.test(translations.uz.testNoQuestions) && !/[А-Яа-яЁё]/.test(translations.en.testNoQuestions));
T("openProfile есть в ru/uz/en",
  ["ru", "uz", "en"].every(lang => typeof translations[lang].openProfile === "string"));
T("openProfile содержит плейсхолдер {0}",
  ["ru", "uz", "en"].every(lang => translations[lang].openProfile.includes("{0}")));
T("консоль без console.error", app.errors.length === 0, app.errors.slice(0, 3).join(" | "));

console.log(`\n=== TEST43: пройдено ${pass}, провалено ${fail} ===`);
app.close();
process.exit(fail === 0 ? 0 : 1);
