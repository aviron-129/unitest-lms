/* Тест Промтов №17–20: объявления преподавателя + панель менеджера.
   Запуск: node test20.js */
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
    window.setInterval = () => 1;
    window.clearInterval = () => {};
  }
});
const w = dom.window;
const D = w.document;
if (D.readyState === "loading") w.initApp();
const hasLog = s => logs.log.some(l => l.includes(s));
const txt = el => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");

/* ============================================================
   [1] Промт №17: объявления преподавателя
   ============================================================ */
console.log("\n[1] Преподаватель: объявления");
w.selectRole("teacher");
w.navigate("announcements");

T("в меню преподавателя есть «Объявления»",
  !!D.querySelector('#sidebarMenu .menu-item[data-section="announcements"]'));
T("раздел объявлений открыт", txt(D.getElementById("sectionContent")).includes("Создать объявление"));
T("кнопка «Создать объявление» есть", !!D.getElementById("teacherAnnCreate"));
T("сначала список пуст (своих объявлений нет)",
  txt(D.getElementById("sectionContent")).includes("У вас пока нет объявлений"));

D.getElementById("teacherAnnCreate").click();
T("модалка создания открылась", !!D.getElementById("teacherAnnOverlay")
  && !D.getElementById("teacherAnnOverlay").classList.contains("hidden"));

const annSelect = D.getElementById("annGroupSelect");
T("в селекте есть «все мои группы» и группы 101-PR/201-PR",
  annSelect && annSelect.options.length === 4
  && [...annSelect.options].some(o => o.value === "all")
  && [...annSelect.options].some(o => o.value === "101-PR")
  && [...annSelect.options].some(o => o.value === "201-PR"));

D.getElementById("annPublish").click();
T("пустые поля → alert «Заполните заголовок и текст»",
  alerts.includes("Заполните заголовок и текст"), safeJson(alerts));

D.getElementById("annTitleInput").value = "Новое объявление";
D.getElementById("annTextInput").value = "Текст для группы 101-PR.";
D.getElementById("annPublish").click();
T("без группы → alert «Выберите группу»",
  alerts.includes("Выберите группу"), safeJson(alerts));

annSelect.value = "101-PR";
D.getElementById("annPublish").click();
T("после публикации модалка закрыта",
  D.getElementById("teacherAnnOverlay").classList.contains("hidden"));
T("объявление в списке преподавателя",
  txt(D.getElementById("sectionContent")).includes("Новое объявление"));
T("в карточке указана группа 101-PR",
  txt(D.getElementById("sectionContent")).includes("Для группы: 101-PR"));
T("логи создания совпадают",
  hasLog("Объявление создано: Новое объявление Для группы: 101-PR")
  && hasLog("Всего объявлений в базе: 4"), logs.log.join(" | "));
T("сохранено в localStorage unitest_announcements",
  JSON.parse(w.localStorage.getItem("unitest_announcements")).some(a => a.title === "Новое объявление"));

// Студент 101-PR видит объявление
w.selectRole("student");
w.navigate("announcements");
T("студент 101-PR видит новое объявление",
  txt(D.getElementById("sectionContent")).includes("Новое объявление"));

// Студент 201-PR не видит объявление для 101-PR
w.eval("mockStudent.group = '201-PR'");
w.navigate("announcements");
T("студент 201-PR НЕ видит объявление для 101-PR",
  !txt(D.getElementById("sectionContent")).includes("Новое объявление"));
T("но видит объявление «для всех»",
  txt(D.getElementById("sectionContent")).includes("Обновление расписания"));
w.eval("mockStudent.group = '101-PR'");

/* ============================================================
   [2] Промт №18: дашборд и группы менеджера
   ============================================================ */
console.log("\n[2] Менеджер: дашборд и группы");
w.selectRole("manager");
w.navigate("dashboard");
const dash = txt(D.getElementById("sectionContent"));
T("приветствие менеджера + направление",
  dash.includes("Добро пожаловать") && dash.includes("Программирование"));
T("статистика: 2 группы / 46 студентов / 1 преподаватель",
  [...D.querySelectorAll("#sectionContent .stat-value")].map(e => e.textContent.trim()).join(",") === "2,46,1");
T("лог дашборда менеджера", hasLog("Дашборд менеджера. Групп: 2 Студентов: 46"), logs.log.join(" | "));

w.navigate("groups");
const groupCards = [...D.querySelectorAll("#sectionContent .group-card")];
T("только 2 группы направления", groupCards.length === 2, groupCards.length);
T("есть 101-PR и 201-PR", groupCards.some(c => c.textContent.includes("101-PR"))
  && groupCards.some(c => c.textContent.includes("201-PR")));
T("групп Дизайна нет", !txt(D.getElementById("sectionContent")).includes("102-DZ")
  && !txt(D.getElementById("sectionContent")).includes("202-DZ"));
T("логи групп направления", hasLog("Всего групп в базе: 4")
  && hasLog("Групп направления programming : 2"), logs.log.join(" | "));
T("кнопка «Редактировать» у группы есть",
  D.querySelector('#sectionContent [data-manager-alert="editGroupDev"]'));
D.querySelector('#sectionContent [data-manager-alert="editGroupDev"]').click();
T("Редактировать → alert в разработке", alerts.includes("Редактирование группы в разработке"));

/* ============================================================
   [3] Промт №19: преподаватели направления
   ============================================================ */
console.log("\n[3] Менеджер: преподаватели");
w.navigate("teachers");
const teacherCards = [...D.querySelectorAll("#sectionContent .group-card")];
T("найден 1 преподаватель направления", teacherCards.length === 1, teacherCards.length);
T("это Sardor Rahimov", txt(D.getElementById("sectionContent")).includes("Sardor Rahimov"));
T("группы преподавателя 101-PR и 201-PR",
  txt(D.getElementById("sectionContent")).includes("101-PR, 201-PR"));
T("Ивановой (Дизайн) нет", !txt(D.getElementById("sectionContent")).includes("Ivanova"));
T("логи фильтра преподавателей", hasLog("Найдено преподавателей: 1")
  && hasLog('Уникальные ID преподавателей направления: ["t1"]'), logs.log.join(" | "));
T("кнопка «Добавить преподавателя» есть",
  !!D.querySelector('#sectionContent [data-manager-alert="addTeacherDev"]'));
T("кнопки «Назначить группу» и «Редактировать» есть",
  !!D.querySelector('#sectionContent [data-manager-alert="assignGroupDev"]')
  && !!D.querySelector('#sectionContent [data-manager-alert="editTeacherDev"]'));

/* ============================================================
   [4] Промт №20: студенты направления + фильтры
   ============================================================ */
console.log("\n[4] Менеджер: студенты");
w.navigate("students");
const rows = () => [...D.querySelectorAll("#managerStudentsRows tr[data-student-name]")];
T("5 студентов направления (Дизайн исключён)", rows().length === 5, rows().length);
T("Смирновой Анны (102-DZ) нет",
  !txt(D.getElementById("sectionContent")).includes("Smirnova Anna"));
T("есть поиск и фильтр групп", !!D.getElementById("managerStudentSearch")
  && !!D.getElementById("managerStudentGroup"));
T("лог студентов направления", hasLog("Всего студентов в базе: 7")
  && hasLog("Студентов направления programming : 5"), logs.log.join(" | "));

const search = D.getElementById("managerStudentSearch");
search.value = "Ivan";
search.dispatchEvent(new w.Event("input", { bubbles: true }));
T("поиск «Ivan» → 1 студент", rows().length === 1, rows().length);
T("лог фильтра", hasLog("Применены фильтры. Найдено: 1"), logs.log.join(" | "));

search.value = "";
search.dispatchEvent(new w.Event("input", { bubbles: true }));
const groupSel = D.getElementById("managerStudentGroup");
groupSel.value = "201-PR";
groupSel.dispatchEvent(new w.Event("change", { bubbles: true }));
T("фильтр 201-PR → 2 студента", rows().length === 2, rows().length);
T("в строках только 201-PR", rows().every(r => r.textContent.includes("201-PR")));

search.value = "zzz";
search.dispatchEvent(new w.Event("input", { bubbles: true }));
T("пустой результат → заглушка",
  txt(D.getElementById("sectionContent")).includes("Студенты не найдены. Попробуйте изменить фильтры"));

T("кнопка «Добавить студента» есть",
  !!D.querySelector('#sectionContent [data-manager-alert="addStudentDev"]'));
D.querySelector('#sectionContent [data-manager-alert="addStudentDev"]').click();
T("Добавить студента → alert в разработке", alerts.includes("Добавление в разработке"));

/* ============================================================
   [5] Переводы и консоль
   ============================================================ */
console.log("\n[5] Переводы и консоль");
const keys = ["createAnnouncement", "annTitle", "annText", "annForGroup", "publish",
  "managerWelcome", "direction", "groupsInDirection", "managerTeachers", "edit",
  "managerNoGroups", "addTeacher", "noGroups", "assignGroup", "managerNoTeachers",
  "searchByName", "allGroups", "fullName", "formLabel", "category", "archer", "regular",
  "addStudent", "studentsNotFound"];
T("все новые ключи есть в ru/uz/en",
  ["ru", "uz", "en"].every(lang => keys.every(k => typeof w.eval(`translations.${lang}`)[k] === "string")));
T("console.error пуст", logs.error.length === 0, safeJson(logs.error));

console.log(`\n=== ИТОГ: пройдено ${pass}, провалено ${fail} ===`);
process.exit(fail ? 1 : 0);
