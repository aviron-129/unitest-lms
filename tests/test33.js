/* test33.js — Промт №33: апелляции (подача студентом).
   Проверяем: кнопку на экране результата, модалку «Оспорить результат»,
   обязательную причину, сохранение в unitest_appeals с привязкой к resultId,
   бейдж статуса вместо кнопки, повторную подачу, раздел «Апелляции»,
   экранирование причины, пустое состояние и переводы ru/uz/en.
   Запуск: node tests/test33.js */
const { createApp } = require("./harness");

const app = createApp();
const w = app.window, d = app.document;
let pass = 0, fail = 0;

function T(name, cond, extra) {
  if (cond) { pass++; console.log("  ok | " + name); }
  else { fail++; console.log("  FAIL | " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra) : "")); }
}
const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
const hasLog = (s) => app.logs.some(l => l.includes(s));
const appeals = () => JSON.parse(w.localStorage.getItem("unitest_appeals") || "[]");
const cards = () => [...d.querySelectorAll("#sectionContent .appeal-card")];
const modal = () => d.getElementById("appealOverlay");

const demoResult = {
  id: "res_test1",
  testId: 1,
  testTitle: "Математика. Контрольная №3",
  percent: 80,
  grade: 4,
  correct: 4,
  total: 5,
  timeSpent: 120,
  date: "2026-10-20"
};

function openResult(res) {
  w.hideResult();
  w.renderResult(res);
}

function submitFromModal(reason) {
  const input = d.getElementById("appealReasonInput");
  if (input) input.value = reason;
  const btn = d.getElementById("appealSend");
  if (btn) btn.click();
}

console.log("\n[1] Кнопка на экране результата");
w.selectRole("student");
openResult(demoResult);
T("экран результата открыт", !d.getElementById("resultScreen").classList.contains("hidden"));
T("кнопка #resultAppealBtn есть", !!d.getElementById("resultAppealBtn"));
T("текст кнопки «Подать апелляцию»", txt(d.getElementById("resultAppealBtn")).includes("Подать апелляцию"),
  txt(d.getElementById("resultAppealBtn")));
T("кнопка стоит после кнопок навигации", (() => {
  const back = d.getElementById("resultBack");
  const btn = d.getElementById("resultAppealBtn");
  return !!back && !!btn && (back.compareDocumentPosition(btn) & w.Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
})());

console.log("\n[2] Модальное окно");
d.getElementById("resultAppealBtn").click();
T("модалка открылась", !!modal() && !modal().classList.contains("hidden"));
T("заголовок «Оспорить результат»", txt(modal().querySelector(".pt-title")).includes("Оспорить результат"),
  txt(modal().querySelector(".pt-title")));
T("пояснение «Опишите, почему вы не согласны»",
  txt(modal().querySelector(".appeal-intro")).includes("Опишите, почему вы не согласны"),
  txt(modal().querySelector(".appeal-intro")));
T("есть textarea причины", !!d.getElementById("appealReasonInput"));
T("есть кнопки «Отмена» и «Отправить»",
  !!d.getElementById("appealCancel") && !!d.getElementById("appealSend")
  && txt(d.getElementById("appealSend")).includes("Отправить"));
T("лог «Открыто окно апелляции для теста: 1»", hasLog("Открыто окно апелляции для теста: 1"));

console.log("\n[3] Валидация причины");
submitFromModal("   ");
T("пустая причина — alert", app.alerts[app.alerts.length - 1] === "Опишите причину апелляции",
  app.alerts[app.alerts.length - 1]);
T("апелляция не сохранена", appeals().length === 0, appeals().length);
T("модалка осталась открытой", !modal().classList.contains("hidden"));

console.log("\n[4] Успешная отправка");
submitFromModal("Не согласен с оценкой за задачу 5");
T("апелляция сохранена в unitest_appeals", appeals().length === 1, appeals().length);
const first = appeals()[0] || {};
T("id начинается с app_", String(first.id).startsWith("app_"), first.id);
T("привязка к resultId", first.resultId === "res_test1", first.resultId);
T("testId = 1", String(first.testId) === "1", first.testId);
T("статус pending", first.status === "pending", first.status);
T("ФИО студента", first.studentName === "Tosheva Malika Alisherovna", first.studentName);
T("группа 101-PR", first.studentGroup === "101-PR", first.studentGroup);
T("причина сохранена", first.reason === "Не согласен с оценкой за задачу 5", first.reason);
T("дата ISO", /^\d{4}-\d{2}-\d{2}$/.test(String(first.date)), first.date);
T("лог «Апелляция сохранена:»", hasLog("Апелляция сохранена:"));
T("лог «Всего апелляций в базе: 1»", hasLog("Всего апелляций в базе: 1"));
T("модалка закрылась", modal().classList.contains("hidden"));

console.log("\n[5] Бейдж вместо кнопки");
T("кнопки подачи больше нет", !d.getElementById("resultAppealBtn"));
T("бейдж «Апелляция на рассмотрении»", txt(d.getElementById("resultAppealBox")).includes("Апелляция на рассмотрении"),
  txt(d.getElementById("resultAppealBox")));
T("класс appeal-badge--pending", !!d.querySelector("#resultAppealBox .appeal-badge--pending"));

console.log("\n[6] Повторный заход (другой результат того же теста)");
openResult({ ...demoResult, id: "res_test2", percent: 60, grade: 3 });
T("бейдж по testId сохраняется", txt(d.getElementById("resultAppealBox")).includes("Апелляция на рассмотрении"));
T("повторной кнопки нет", !d.getElementById("resultAppealBtn"));
const beforeDup = app.alerts.length;
w.openAppealModal({ ...demoResult, id: "res_test2" });
T("повторная подача — alert", app.alerts[app.alerts.length - 1] === "Вы уже подали апелляцию на этот тест",
  app.alerts[app.alerts.length - 1]);
T("новых алертов ровно один", app.alerts.length === beforeDup + 1);
T("вторая апелляция не создана", appeals().length === 1, appeals().length);

console.log("\n[7] Раздел «Апелляции»");
w.hideResult();
w.navigate("appeals");
T("раздел отрисован", !!d.querySelector("#sectionContent .appeals-grid"));
T("2 карточки результатов", cards().length === 2, cards().length);
T("у карточки с апелляцией — бейдж", !!d.querySelector("#sectionContent .appeal-badge--pending"));
T("у второй карточки — кнопка подачи", d.querySelectorAll("#sectionContent .appeal-btn").length === 1,
  d.querySelectorAll("#sectionContent .appeal-btn").length);
T("лог «Апелляций в базе: 1»", hasLog("Апелляций в базе: 1"));
T("лог «Результатов студента: 2»", hasLog("Результатов студента: 2"));

const sectionBtn = d.querySelector("#sectionContent .appeal-btn");
sectionBtn.click();
T("модалка из раздела открылась", !modal().classList.contains("hidden"));
const xss = '<img src=x onerror=alert(1)>';
submitFromModal(xss);
T("второй результат сохранён", appeals().length === 2, appeals().length);
T("resultId второго результата — составной ключ",
  appeals().some(a => String(a.resultId).startsWith("3|")), appeals().map(a => a.resultId));
T("причина экранирована (нет img)", !d.querySelector("#sectionContent .appeal-reason img"));
T("текст причины виден как текст", txt(d.querySelector("#sectionContent .appeal-reason")).includes(xss),
  txt(d.querySelector("#sectionContent .appeal-reason")));

console.log("\n[8] Восстановление из localStorage (F5)");
w.eval("mockAppeals.length = 0; loadAppealsFromStorage();");
T("mockAppeals восстановлен", app.eval("mockAppeals.length") === 2, app.eval("mockAppeals.length"));
T("лог восстановления", hasLog("Апелляции восстановлены из localStorage: 2"));

console.log("\n[9] Пустой список результатов");
w.localStorage.setItem("unitest_results", JSON.stringify([]));
w.navigate("appeals");
T("заглушка пустого состояния", !!d.querySelector("#sectionContent .content-placeholder"));
T("текст заглушки", txt(d.querySelector("#sectionContent .content-placeholder")).includes("Вы ещё не проходили тесты"),
  txt(d.querySelector("#sectionContent .content-placeholder")));

console.log("\n[10] Переводы ru/uz/en");
const translations = JSON.parse(app.eval("JSON.stringify(translations)"));
const keys = ["appeals", "appealsIntro", "appealsEmpty", "appealSubmit", "appealTitle", "appealIntro",
  "appealReason", "appealReasonPlaceholder", "appealSend", "appealPending", "appealApproved",
  "appealRejected", "appealErrReason", "appealErrExists", "appealReasonLabel"];
T("все ключи апелляций есть в 3 языках",
  Object.keys(translations).every(l => keys.every(k => typeof translations[l][k] === "string" && translations[l][k].trim())));
w.changeLanguage("en");
w.navigate("appeals");
T("en: заголовок «Appeals»", txt(d.getElementById("sectionHeading")) === "Appeals",
  txt(d.getElementById("sectionHeading")));
w.changeLanguage("uz");
w.navigate("appeals");
T("uz: заголовок «Apellyatsiyalar»", txt(d.getElementById("sectionHeading")) === "Apellyatsiyalar",
  txt(d.getElementById("sectionHeading")));
T("нет console.error", app.errors.length === 0, app.errors.slice(0, 2));

console.log(`\n=== TEST33: пройдено ${pass}, провалено ${fail} ===`);
app.close();
process.exit(fail === 0 ? 0 : 1);
