/* test34.js — Промт №34: апелляции (рассмотрение преподавателем).
   Проверяем: пункт меню и красный счётчик pending, фильтрацию «только свои тесты»,
   карточки с ФИО/группой/тестом/причиной/статусом, одобрение с комментарием
   (оценка 5, percent 100), отклонение без изменения оценки, уведомление студенту,
   отсутствие кнопок у рассмотренных апелляций, пустое состояние и переводы ru/uz/en.
   Запуск: node tests/test34.js */
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
const results = () => JSON.parse(w.localStorage.getItem("unitest_results") || "[]");
const notifs = () => JSON.parse(w.localStorage.getItem("unitest_dynamic_notifications") || "[]");
const cards = () => [...d.querySelectorAll("#sectionContent .appeal-card")];
const cardById = (id) => d.querySelector(`#sectionContent [data-appeal-card="${id}"]`);
const badge = () => d.getElementById("appealsMenuBadge");
const menuLabel = () => txt(d.querySelector('#sidebarMenu .menu-item[data-section="appeals"] span:not(.menu-badge)'));

const XSS = '<img src=x onerror=alert(1)>';

const seedAppeals = [
  {
    id: "app_own_approve", resultId: "res_my_34", testId: "test_my_34",
    testTitle: "Математика. Апелляционный тест",
    studentName: "Tosheva Malika Alisherovna", studentGroup: "101-PR",
    reason: "Не согласен с проверкой задачи 5 " + XSS,
    date: "2026-10-19", status: "pending"
  },
  {
    id: "app_own_reject", resultId: "res_my_34b", testId: "test_my_34b",
    testTitle: "Математика. Повторная работа",
    studentName: "Tosheva Malika Alisherovna", studentGroup: "101-PR",
    reason: "Прошу пересмотреть оценку за задачу 2",
    date: "2026-10-18", status: "pending"
  },
  {
    id: "app_foreign", resultId: "res_foreign_34", testId: "test_foreign_34",
    testTitle: "Чужой тест (не должен показываться)",
    studentName: "Петров П.П.", studentGroup: "201-PR",
    reason: "Апелляция к чужому преподавателю",
    date: "2026-10-18", status: "pending"
  }
];

const seedResults = [
  {
    id: "res_my_34", testId: "test_my_34", testTitle: "Математика. Апелляционный тест",
    score: 3, correct: 3, total: 5, percent: 60, grade: 3, timeSpent: 100, date: "2026-10-17"
  },
  {
    id: "res_my_34b", testId: "test_my_34b", testTitle: "Математика. Повторная работа",
    score: 4, correct: 4, total: 5, percent: 80, grade: 4, timeSpent: 90, date: "2026-10-16"
  },
  {
    id: "res_foreign_34", testId: "test_foreign_34", testTitle: "Чужой тест (не должен показываться)",
    score: 3, correct: 3, total: 5, percent: 60, grade: 3, timeSpent: 80, date: "2026-10-15"
  }
];

// Готовим данные: два своих теста преподавателя, один чужой, результаты и апелляции
w.eval(`
  mockTests.push(
    { id: "test_my_34", subject: "math", num: 34, teacher: "Sardor Rahimov", author: "Sardor Rahimov",
      title: "Математика. Апелляционный тест", questionsCount: 5, timeLimit: 20, deadline: "31.10.2026",
      targetCourse: 1, targetDirection: "programming", targetGroup: ["101-PR"], targetForm: ["full", "part"], status: "active" },
    { id: "test_my_34b", subject: "math", num: 35, teacher: "Sardor Rahimov", author: "Sardor Rahimov",
      title: "Математика. Повторная работа", questionsCount: 5, timeLimit: 20, deadline: "31.10.2026",
      targetCourse: 1, targetDirection: "programming", targetGroup: ["101-PR"], targetForm: ["full", "part"], status: "active" },
    { id: "test_foreign_34", subject: "physics", num: 36, teacher: "Другой преподаватель", author: "Другой преподаватель",
      title: "Чужой тест (не должен показываться)", questionsCount: 5, timeLimit: 20, deadline: "31.10.2026",
      targetCourse: 1, targetDirection: "programming", targetGroup: ["101-PR"], targetForm: ["full", "part"], status: "active" }
  );
`);
w.localStorage.setItem("unitest_appeals", JSON.stringify(seedAppeals));
w.localStorage.setItem("unitest_results", JSON.stringify(seedResults));
w.localStorage.removeItem("unitest_dynamic_notifications");
w.localStorage.removeItem("unitestreadnotifications");
w.eval("loadAppealsFromStorage(); loadDynamicNotificationsFromStorage();");

console.log("\n[1] Пункт меню преподавателя и счётчик pending");
w.selectRole("teacher");
const menuBtn = d.querySelector('#sidebarMenu .menu-item[data-section="appeals"]');
T("пункт «Апелляции» есть в меню преподавателя", !!menuBtn);
T("подпись пункта — «Апелляции»", menuLabel() === "Апелляции", menuLabel());
T("иконка предупреждения", !!menuBtn && !!menuBtn.querySelector(".fa-triangle-exclamation"));
T("счётчик в меню есть", !!badge());
T("счётчик = 2 (только свои pending)", txt(badge()) === "2", txt(badge()));
T("счётчик видим", !!badge() && !badge().classList.contains("hidden"));

console.log("\n[2] Раздел «Апелляции»: только свои тесты");
w.navigate("appeals");
T("раздел отрисован", !!d.querySelector("#sectionContent .appeals-grid"));
T("лог «Всего апелляций в базе: 3»", hasLog("Всего апелляций в базе: 3"));
T("лог «Апелляций для тестов преподавателя: 2»", hasLog("Апелляций для тестов преподавателя: 2"));
T("две карточки (чужая скрыта)", cards().length === 2, cards().length);
T("чужой тест не показан", !txt(d.getElementById("sectionContent")).includes("Чужой тест"),
  txt(d.getElementById("sectionContent")).slice(0, 120));
T("чужой студент не показан", !txt(d.getElementById("sectionContent")).includes("Петров"));

const apprCard = cardById("app_own_approve");
T("карточка одобряемой апелляции есть", !!apprCard);
T("ФИО студента", !!apprCard && txt(apprCard).includes("Tosheva Malika Alisherovna"));
T("группа 101-PR", !!apprCard && txt(apprCard.querySelector(".appeal-card-group")) === "101-PR");
T("название теста", !!apprCard && txt(apprCard).includes("Математика. Апелляционный тест"));
T("причина видна", !!apprCard && txt(apprCard.querySelector(".appeal-reason")).includes("Не согласен с проверкой задачи 5"));
T("причина экранирована (нет img)", !!apprCard && !apprCard.querySelector(".appeal-reason img"));
T("статус pending", !!apprCard && !!apprCard.querySelector(".appeal-badge--pending"));
T("есть поле комментария", !!apprCard && !!apprCard.querySelector("[data-appeal-comment]"));
T("есть кнопки «Одобрить» и «Отклонить»",
  !!apprCard && !!apprCard.querySelector('[data-appeal-action="approve"]')
  && !!apprCard.querySelector('[data-appeal-action="reject"]'));
T("кнопок ровно 2 на карточку", !!apprCard && apprCard.querySelectorAll("[data-appeal-action]").length === 2);

console.log("\n[3] Одобрение с комментарием");
const approveBtn = apprCard.querySelector('[data-appeal-action="approve"]');
apprCard.querySelector("[data-appeal-comment]").value = "Пересмотрел работу, ответ засчитан.";
approveBtn.click();

let saved = appeals().find(a => a.id === "app_own_approve");
T("статус апелляции approved", !!saved && saved.status === "approved", saved && saved.status);
T("комментарий сохранён", !!saved && saved.comment === "Пересмотрел работу, ответ засчитан.", saved && saved.comment);
T("рассмотрел преподаватель", !!saved && saved.reviewedBy === "Sardor Rahimov", saved && saved.reviewedBy);
T("дата решения ISO", !!saved && /^\d{4}-\d{2}-\d{2}$/.test(String(saved.reviewDate)), saved && saved.reviewDate);
T("лог «Обработка апелляции: app_own_approve Действие: approve»",
  hasLog("Обработка апелляции: app_own_approve Действие: approve"));
T("лог «Оценка студента обновлена на 5»", hasLog("Оценка студента обновлена на 5"));
T("лог «Апелляция одобрена: app_own_approve»", hasLog("Апелляция одобрена: app_own_approve"));

const r1 = results().find(r => r.id === "res_my_34");
T("оценка результата = 5", !!r1 && Number(r1.grade) === 5, r1 && r1.grade);
T("percent результата = 100", !!r1 && Number(r1.percent) === 100, r1 && r1.percent);
T("баллы пересчитаны на максимум", !!r1 && Number(r1.correct) === Number(r1.total), r1 && `${r1.correct}/${r1.total}`);

const doneCard = cardById("app_own_approve");
T("карточка перерисована со статусом approved", !!doneCard && !!doneCard.querySelector(".appeal-badge--approved"));
T("кнопки у рассмотренной апелляции исчезли", !!doneCard && !doneCard.querySelector("[data-appeal-action]"));
T("комментарий виден в карточке", !!doneCard && txt(doneCard).includes("Пересмотрел работу, ответ засчитан."));
T("счётчик уменьшился до 1", txt(badge()) === "1", txt(badge()));

console.log("\n[4] Отклонение без изменения оценки");
const rejCard = cardById("app_own_reject");
T("вторая карточка pending есть", !!rejCard && !!rejCard.querySelector(".appeal-badge--pending"));
rejCard.querySelector("[data-appeal-comment]").value = "Работа проверена верно.";
rejCard.querySelector('[data-appeal-action="reject"]').click();

saved = appeals().find(a => a.id === "app_own_reject");
T("статус апелляции rejected", !!saved && saved.status === "rejected", saved && saved.status);
T("комментарий отклонения сохранён", !!saved && saved.comment === "Работа проверена верно.");
T("лог «Апелляция отклонена: app_own_reject»", hasLog("Апелляция отклонена: app_own_reject"));
const r2 = results().find(r => r.id === "res_my_34b");
T("оценка при отклонении не изменилась (4)", !!r2 && Number(r2.grade) === 4, r2 && r2.grade);
T("percent при отклонении не изменился (80)", !!r2 && Number(r2.percent) === 80, r2 && r2.percent);
T("счётчик скрыт (0 pending)", !!badge() && badge().classList.contains("hidden"), badge() && badge().className);
T("в разделе больше нет кнопок решения", d.querySelectorAll("#sectionContent [data-appeal-action]").length === 0);

console.log("\n[5] Уведомление студенту");
const dyn = notifs();
T("два динамических уведомления", dyn.length === 2, dyn.length);
const nApproved = dyn.find(n => n.id === "notif_appeal_app_own_approve");
const nRejected = dyn.find(n => n.id === "notif_appeal_app_own_reject");
T("уведомление об одобрении есть", !!nApproved);
T("адресат — student", !!nApproved && nApproved.targetRole === "student");
T("ключ заголовка об одобрении", !!nApproved && nApproved.titleKey === "appealNotifApprovedTitle");
T("параметр test передан", !!nApproved && !!nApproved.params && nApproved.params.test === "Математика. Апелляционный тест");
T("уведомление об отклонении есть", !!nRejected && nRejected.titleKey === "appealNotifRejectedTitle");

w.selectRole("student");
const studentNotifs = w.getRoleNotifications("student");
T("студент видит динамические уведомления", studentNotifs.some(n => n.id === "notif_appeal_app_own_approve"));
const nObj = studentNotifs.find(n => n.id === "notif_appeal_app_own_approve");
T("заголовок уведомления «Апелляция одобрена»", w.notifField(nObj, "title") === "Апелляция одобрена",
  w.notifField(nObj, "title"));
T("текст уведомления содержит название теста",
  w.notifField(nObj, "text").includes("Математика. Апелляционный тест"), w.notifField(nObj, "text"));
T("панель уведомлений показывает решение",
  txt(d.getElementById("notifList")).includes("Апелляция одобрена"), txt(d.getElementById("notifList")));
w.eval("dynamicNotifications.length = 0; loadDynamicNotificationsFromStorage();");
T("уведомления восстанавливаются из localStorage (F5)", w.eval("dynamicNotifications.length") === 2,
  w.eval("dynamicNotifications.length"));

console.log("\n[6] Оценка видна студенту в зачётке");
w.navigate("gradebook");
const gradeText = txt(d.getElementById("sectionContent"));
T("в зачётке есть тест с апелляцией", gradeText.includes("Математика. Апелляционный тест"), gradeText.slice(0, 200));
const gradeCard = [...d.querySelectorAll("#sectionContent .grade-card")]
  .find(el => txt(el).includes("Математика. Апелляционный тест"));
T("оценка в зачётке = 5", !!gradeCard && txt(gradeCard.querySelector(".grade-badge")) === "5",
  gradeCard && txt(gradeCard));

console.log("\n[7] Оценка 5 видна преподавателю в «Результатах»");
w.selectRole("teacher");
w.navigate("results");
const resultRow = [...d.querySelectorAll(".results-table tbody tr")]
  .find(tr => txt(tr).includes("Математика. Апелляционный тест"));
T("строка результата есть", !!resultRow);
T("в строке оценка 5", !!resultRow && txt(resultRow.querySelector(".grade-badge")) === "5",
  resultRow && txt(resultRow));

console.log("\n[8] Пустое состояние");
w.localStorage.setItem("unitest_appeals", JSON.stringify([]));
w.eval("loadAppealsFromStorage();");
w.navigate("appeals");
T("заглушка пустого состояния", !!d.querySelector("#sectionContent .content-placeholder"));
T("текст заглушки", txt(d.querySelector("#sectionContent .content-placeholder")).includes("Пока нет апелляций"),
  txt(d.querySelector("#sectionContent .content-placeholder")));
T("счётчик скрыт", !!badge() && badge().classList.contains("hidden"));
T("лог «Всего апелляций в базе: 0»", hasLog("Всего апелляций в базе: 0"));

console.log("\n[9] Переводы ru/uz/en");
const translations = JSON.parse(app.eval("JSON.stringify(translations)"));
const keys = ["teacherAppealsIntro", "teacherAppealsEmpty", "appealCommentLabel",
  "appealCommentPlaceholder", "appealApprove", "appealReject", "appealNoComment",
  "appealNotifApprovedTitle", "appealNotifApprovedText", "appealNotifRejectedTitle", "appealNotifRejectedText"];
T("все ключи апелляций преподавателя есть в 3 языках",
  Object.keys(translations).every(l => keys.every(k => typeof translations[l][k] === "string" && translations[l][k].trim())));
w.changeLanguage("en");
T("en: пункт меню «Appeals»", menuLabel() === "Appeals", menuLabel());
T("en: пустое состояние переведено", txt(d.querySelector("#sectionContent .content-placeholder")).includes("No appeals"),
  txt(d.querySelector("#sectionContent .content-placeholder")));
w.changeLanguage("uz");
T("uz: пункт меню «Apellyatsiyalar»", menuLabel() === "Apellyatsiyalar", menuLabel());
T("нет console.error", app.errors.length === 0, app.errors.slice(0, 2));

console.log(`\n=== TEST34: пройдено ${pass}, провалено ${fail} ===`);
app.close();
process.exit(fail === 0 ? 0 : 1);
