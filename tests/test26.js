/* Тест Промта №25: панель администратора — управление группами.
   Проверяем: рендер групп по направлениям, создание группы через модалку,
   валидации, сохранение в unitest_groups, восстановление после «перезагрузки»,
   реальное редактирование (не alert), справочники факультетов и курсов,
   переводы ru/uz/en, пустое состояние и регресс панелей. */
const fs = require("fs");
const { JSDOM } = require("jsdom");
const HTML = require("path").join(__dirname, "..", "index.html");
const html = fs.readFileSync(HTML, "utf8");
let pass = 0, fail = 0;
function T(n, c, e) { if (c) { pass++; console.log("  ok | " + n); } else { fail++; console.log("  FAIL | " + n + (e !== undefined ? "  -> " + e : "")); } }
const safe = x => { try { return JSON.stringify(x); } catch (e) { return String(x); } };

const logs = { log: [], error: [] };
const alerts = [];
const dom = new JSDOM(html, {
  url: "https://unitest.local/", runScripts: "dangerously", pretendToBeVisual: true,
  beforeParse(w) {
    w.console.log = (...a) => logs.log.push(a.map(x => typeof x === "string" ? x : safe(x)).join(" "));
    w.console.error = (...a) => logs.error.push(a.map(x => typeof x === "string" ? x : safe(x)).join(" "));
    w.alert = (...a) => alerts.push(a.join(" "));
    w.confirm = () => true; w.setInterval = () => 1; w.clearInterval = () => {};
  }
});
const w = dom.window, D = w.document;
if (D.readyState === "loading") w.initApp();
const txt = el => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
const hasLog = s => logs.log.some(l => l.includes(s));
const sectionText = () => txt(D.getElementById("sectionContent"));
const groupCards = () => [...D.querySelectorAll(".admin-group-card")];
const directionBlocks = () => [...D.querySelectorAll(".admin-direction-block")];
const overlay = () => D.getElementById("adminGroupOverlay");
const savedGroups = () => JSON.parse(w.localStorage.getItem("unitest_groups") || "[]");
const groupCardByName = name => groupCards().find(c => txt(c.querySelector(".admin-group-name")) === name);

function submitGroupForm() {
  const form = D.getElementById("adminGroupForm");
  if (form) form.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
}
function fillGroupForm({ name, course, direction, form }) {
  if (name !== undefined) D.getElementById("adminGroupName").value = name;
  if (course !== undefined) D.getElementById("adminGroupCourse").value = String(course);
  if (direction !== undefined) D.getElementById("adminGroupDirection").value = direction;
  if (form !== undefined) D.getElementById("adminGroupForm").value = form;
}

console.log("\n[1] Раздел «Группы» и группировка по направлениям");
w.selectRole("admin");
w.navigate("groups");
T("раздел отрисован", !!D.getElementById("sectionContent"));
T("всего 4 группы", groupCards().length === 4, groupCards().length);
T("2 блока направлений (programming/design)", directionBlocks().length === 2, directionBlocks().length);
T("есть группа 101-PR", sectionText().includes("101-PR"));
T("есть группа 202-DZ", sectionText().includes("202-DZ"));
T("блок «Программирование»", sectionText().includes("Программирование"));
T("блок «Дизайн»", sectionText().includes("Дизайн"));
T("лог общего количества групп", hasLog("Всего групп в системе: 4"), logs.log.join(" | "));
T("сводка: всего групп и направлений",
  sectionText().includes("Всего групп: 4") && sectionText().includes("направлений: 2"));
T("кнопка «Создать группу»", !!D.querySelector('[data-admin-action="create-group"]'));
T("у каждой группы кнопка «Редактировать»",
  D.querySelectorAll(".admin-group-edit").length === 4, D.querySelectorAll(".admin-group-edit").length);
T("количество студентов из mockAllStudents (101-PR → 3)",
  txt(groupCardByName("101-PR")).includes("3"), txt(groupCardByName("101-PR")));

console.log("\n[2] Модалка создания и валидации");
D.querySelector('[data-admin-action="create-group"]').click();
T("модалка открыта", !!overlay());
T("заголовок «Создать группу»", txt(overlay()).includes("Создать группу"));
T("поля названия/курса/направления/формы",
  !!D.getElementById("adminGroupName") && !!D.getElementById("adminGroupCourse")
  && !!D.getElementById("adminGroupDirection") && !!D.getElementById("adminGroupForm"));
T("направления не пустые (3 варианта)",
  D.querySelectorAll("#adminGroupDirection option").length === 3,
  D.querySelectorAll("#adminGroupDirection option").length);
T("лог доступных направлений", hasLog("Доступные направления для выбора:"), logs.log.slice(-4).join(" | "));
T("курс — 1..5", D.querySelectorAll("#adminGroupCourse option").length === 5);

alerts.length = 0;
fillGroupForm({ name: "   " });
submitGroupForm();
T("пустое название → alert", alerts.length === 1 && alerts[0].includes("Введите название группы"), safe(alerts));

alerts.length = 0;
fillGroupForm({ name: "301-PR", course: 0 });
submitGroupForm();
T("некорректный курс → alert", alerts.length === 1 && alerts[0].includes("Укажите корректный курс"), safe(alerts));
T("модалка осталась открытой", !!overlay());

console.log("\n[3] Создание группы и сохранение в unitest_groups");
alerts.length = 0;
fillGroupForm({ name: "301-PR", course: 3, direction: "programming", form: "full" });
submitGroupForm();
T("модалка закрылась", !overlay());
T("групп стало 5", w.eval("mockTeacherGroups.length") === 5, w.eval("mockTeacherGroups.length"));
T("новая карточка 301-PR появилась", !!groupCardByName("301-PR"));
T("в localStorage 5 групп", savedGroups().length === 5, savedGroups().length);
const created = savedGroups().find(g => g.name === "301-PR");
T("объект группы: id g_ + Date.now()", !!created && /^g_\d+$/.test(created.id), created && created.id);
T("course/direction/form/studentsCount/teacherId",
  created && created.course === 3 && created.direction === "programming"
  && created.form === "full" && created.studentsCount === 0 && created.teacherId === null,
  safe(created));
T("лог создания группы", hasLog("Группа создана: 301-PR"), logs.log.slice(-4).join(" | "));
T("alert при создании не показывался", alerts.length === 0, safe(alerts));

console.log("\n[4] Сохранение после «перезагрузки» (F5)");
w.eval("mockTeacherGroups.length = 0; loadGroupsFromStorage()");
T("группы восстановлены из localStorage (5)", w.eval("mockTeacherGroups.length") === 5, w.eval("mockTeacherGroups.length"));
T("301-PR на месте после восстановления", !!groupCardByName("301-PR"));

// Полноценная имитация F5: новый JSDOM, localStorage заполнен до initApp().
const seed = w.localStorage.getItem("unitest_groups");
let reloadError = "";
let reloadGroups = -1;
let reloadHas = false;
try {
  const dom2 = new JSDOM(html, {
    url: "https://unitest.local/", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(w2) {
      w2.localStorage.setItem("unitest_groups", seed);
      w2.console.log = () => {}; w2.console.error = () => {};
      w2.alert = () => {}; w2.confirm = () => true;
      w2.setInterval = () => 1; w2.clearInterval = () => {};
    }
  });
  const w2 = dom2.window, D2 = w2.document;
  if (D2.readyState === "loading") w2.initApp();
  reloadGroups = w2.eval("mockTeacherGroups.length");
  reloadHas = w2.eval("mockTeacherGroups.some(g => g.name === '301-PR')");
  w2.close();
} catch (e) {
  reloadError = e.message;
}
T("F5: initApp загружает группы из unitest_groups (5)", reloadGroups === 5, `${reloadGroups} ${reloadError}`);
T("F5: созданная группа на месте", reloadHas === true, reloadHas);

console.log("\n[5] Редактирование группы (реальная форма, не alert)");
alerts.length = 0;
groupCardByName("301-PR").querySelector(".admin-group-edit").click();
T("модалка редактирования открыта", !!overlay());
T("заголовок «Редактировать»", txt(overlay()).includes("Редактировать"));
T("поля заполнены текущими значениями",
  D.getElementById("adminGroupName").value === "301-PR"
  && D.getElementById("adminGroupCourse").value === "3"
  && D.getElementById("adminGroupDirection").value === "programming"
  && D.getElementById("adminGroupForm").value === "full",
  [D.getElementById("adminGroupName").value, D.getElementById("adminGroupCourse").value,
    D.getElementById("adminGroupDirection").value, D.getElementById("adminGroupForm").value].join("|"));
T("редактирование не показывает alert", alerts.length === 0, safe(alerts));

fillGroupForm({ name: "301-PR-NEW", course: 4, direction: "design", form: "part" });
submitGroupForm();
T("модалка закрылась", !overlay());
T("карточка переименована", !!groupCardByName("301-PR-NEW"), sectionText().slice(0, 400));
T("старое имя исчезло", !groupCardByName("301-PR"));
T("изменения в localStorage",
  savedGroups().some(g => g.name === "301-PR-NEW" && g.course === 4
    && g.direction === "design" && g.form === "part"),
  safe(savedGroups().find(g => g.name === "301-PR-NEW")));
T("лог обновления группы", hasLog("Группа обновлена: 301-PR-NEW"), logs.log.slice(-4).join(" | "));
T("редактирование не создало дубль (5 групп)", w.eval("mockTeacherGroups.length") === 5, w.eval("mockTeacherGroups.length"));

console.log("\n[6] Проверка дубля названия");
D.querySelector('[data-admin-action="create-group"]').click();
alerts.length = 0;
fillGroupForm({ name: "101-PR", course: 1, direction: "programming" });
submitGroupForm();
T("дубль названия → alert", alerts.length === 1 && alerts[0].includes("уже существует"), safe(alerts));
T("модалка не закрылась", !!overlay());
D.getElementById("adminGroupCancel").click();
T("«Отмена» закрывает модалку", !overlay());
T("дубль не создан (5 групп)", w.eval("mockTeacherGroups.length") === 5, w.eval("mockTeacherGroups.length"));

console.log("\n[7] Справочники факультетов и курсов (не заглушки)");
w.navigate("faculties");
T("справочник факультетов отрисован", D.querySelectorAll("#sectionContent .admin-ref-card").length === 2,
  D.querySelectorAll("#sectionContent .admin-ref-card").length);
T("факультет ИТ", sectionText().includes("Факультет информационных технологий"));
T("экономический факультет", sectionText().includes("Экономический факультет"));
T("направления и группы", sectionText().includes("Программирование") && sectionText().includes("Группы:"));
T("нет заглушки «в разработке»", !sectionText().includes("в разработке"), sectionText().slice(0, 240));

w.navigate("courses");
T("справочник 5 курсов", D.querySelectorAll("#sectionContent .admin-ref-card").length === 5,
  D.querySelectorAll("#sectionContent .admin-ref-card").length);
T("курс 1 и 2", sectionText().includes("1 курс") && sectionText().includes("2 курс"));
T("группы/студенты/форма", sectionText().includes("Группы") && sectionText().includes("Студенты")
  && sectionText().includes("Форма обучения"));
T("нет заглушки «в разработке»", !sectionText().includes("в разработке"), sectionText().slice(0, 240));

console.log("\n[8] Переводы ru/uz/en");
const keys = ["adminCreateGroup", "adminEditGroup", "adminGroupName", "adminGroupNamePh",
  "adminGroupCourse", "adminGroupDirection", "adminGroupForm", "adminSave", "adminNoGroups",
  "adminErrGroupName", "adminErrGroupCourse", "adminErrGroupDuplicate",
  "adminFacultiesSubtitle", "adminCoursesSubtitle", "adminRefDirections",
  "adminRefGroups", "adminRefStudents", "facultyIt", "facultyEconomics"];
T("ключи есть в ru/uz/en",
  ["ru", "uz", "en"].every(l => keys.every(k => typeof w.eval(`translations.${l}`)[k] === "string")));

w.changeLanguage("en");
w.navigate("groups");
T("английский: Create group", sectionText().includes("Create group"));
T("английский: Programming/Design", sectionText().includes("Programming") && sectionText().includes("Design"));
T("английский: Edit", sectionText().includes("Edit"));
T("английский: Total groups", sectionText().includes("Total groups"));
D.querySelector('[data-admin-action="create-group"]').click();
T("английская модалка", txt(overlay()).includes("Create group") && txt(overlay()).includes("Group name")
  && txt(overlay()).includes("Save"));
D.getElementById("adminGroupCancel").click();

w.navigate("faculties");
T("английский справочник факультетов", sectionText().includes("Faculty of Information Technology"));

w.changeLanguage("uz");
w.navigate("groups");
T("узбекский: Guruh yaratish", sectionText().includes("Guruh yaratish"));
T("узбекский: Tahrirlash", sectionText().includes("Tahrirlash"));
T("узбекский: Dasturlash/Dizayn", sectionText().includes("Dasturlash") && sectionText().includes("Dizayn"));
w.changeLanguage("ru");
w.navigate("groups");

console.log("\n[9] Пустое состояние и регресс");
const saved = w.localStorage.getItem("unitest_groups");
w.eval("mockTeacherGroups.length = 0");
w.navigate("groups");
T("0 групп — раздел не падает", !!D.getElementById("sectionContent"));
T("заглушка «Групп пока нет»", sectionText().includes("Групп пока нет"), sectionText().slice(0, 200));
T("кнопка создания осталась", !!D.querySelector('[data-admin-action="create-group"]'));
T("лог 0 групп", hasLog("Всего групп в системе: 0"), logs.log.slice(-3).join(" | "));
w.navigate("faculties");
T("факультеты при 0 групп", !/undefined|\bNaN\b|\[object Object\]/.test(sectionText()));
w.navigate("courses");
T("курсы при 0 групп показывают пустое состояние", sectionText().includes("Курсы пока не заданы"), sectionText().slice(0, 200));

w.eval(`mockTeacherGroups.length = 0; JSON.parse(${JSON.stringify(saved)}).forEach(x => mockTeacherGroups.push(x))`);
w.navigate("groups");
T("группы восстановлены (5)", groupCards().length === 5, groupCards().length);

w.navigate("dashboard");
T("регресс: дашборд админа — 4 карточки", D.querySelectorAll("#sectionContent .stat-card").length === 4);
w.navigate("users");
T("регресс: пользователи - 12 строк",
  D.querySelectorAll("#adminUsersRows tr[data-admin-user]").length === 12,
  D.querySelectorAll("#adminUsersRows tr[data-admin-user]").length);

w.selectRole("manager");
w.navigate("groups");
T("регресс: группы менеджера", D.querySelectorAll("#sectionContent .group-card").length > 0);
w.selectRole("teacher");
w.navigate("myGroups");
T("регресс: группы преподавателя", D.querySelectorAll("#sectionContent .group-card").length > 0);
w.selectRole("student");
w.navigate("profile");
T("регресс: профиль студента", !!D.querySelector("#sectionContent .profile-card"));
T("console.error пуст", logs.error.length === 0, safe(logs.error));

console.log(`\n=== ИТОГ: пройдено ${pass}, провалено ${fail} ===`);
process.exit(fail ? 1 : 0);
