/* Тест Промта №24: панель администратора — список пользователей.
   Проверяем: объединение студентов/преподавателей/менеджеров (allUsers),
   таблицу на десктопе и карточки на мобильном, цветные бейджи ролей,
   «доп. информацию» (группа/предмет/направление), совместную работу поиска
   и фильтра по роли, пустую заглушку, логи, модалку добавления (Промт №26)
   и alert клика по строке, переводы ru/uz/en и регресс других панелей. */
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
const rows = () => [...D.querySelectorAll("#adminUsersRows tr[data-admin-user]")];
const allRows = () => [...D.querySelectorAll("#adminUsersRows tr")];
const cards = () => [...D.querySelectorAll("#adminUsersCards .admin-user-card")];
const badges = () => [...D.querySelectorAll("#adminUsersRows .admin-role-badge")];
const sectionText = () => txt(D.getElementById("sectionContent"));

function setFilter(query, role) {
  const search = D.getElementById("adminUserSearch");
  const roleEl = D.getElementById("adminUserRole");
  if (search) {
    search.value = query == null ? "" : query;
    search.dispatchEvent(new w.Event("input", { bubbles: true }));
  }
  if (roleEl) {
    roleEl.value = role == null ? "" : role;
    roleEl.dispatchEvent(new w.Event("change", { bubbles: true }));
  }
}

console.log("\n[1] Раздел и объединение пользователей");
w.selectRole("admin");
w.navigate("users");
T("раздел «Пользователи» отрисован", !!D.getElementById("sectionContent"));
T("есть таблица", !!D.querySelector("#sectionContent table.admin-users-table"));
T("allUsers = 7 студентов + 3 преподавателя + 1 менеджер", w.eval("allUsers.length") === 11, w.eval("allUsers.length"));
T("в таблице 11 строк", rows().length === 11, rows().length);
T("в мобильных карточках 11 карточек", cards().length === 11, cards().length);
T("лог общего количества", hasLog("Всего пользователей в системе: 11"), logs.log.join(" | "));
T("лог фильтра", hasLog("Отфильтровано пользователей: 11"), logs.log.join(" | "));
T("студент Tosheva есть в списке", sectionText().includes("Tosheva Malika"));
T("преподаватель Sardor Rahimov есть", sectionText().includes("Sardor Rahimov"));
T("менеджер Dilnoza Yusupova есть", sectionText().includes("Dilnoza Yusupova"));
T("allUsers: роли — ключи, не русские строки",
  w.eval("JSON.stringify([...new Set(allUsers.map(u => u.role))].sort())") === JSON.stringify(["manager", "student", "teacher"]),
  w.eval("JSON.stringify([...new Set(allUsers.map(u => u.role))])"));

console.log("\n[2] Колонки, бейджи и «доп. информация»");
const headers = [...D.querySelectorAll("#sectionContent thead th")].map(txt);
T("4 колонки: ФИО/Роль/Доп. информация/Статус",
  headers.join("|") === "ФИО|Роль|Доп. информация|Статус", headers.join("|"));
T("у каждой строки бейдж роли", badges().length === 11, badges().length);
T("класс студента (оранжевый)", !!D.querySelector("#adminUsersRows .admin-role-student"));
T("класс преподавателя (зелёный)", !!D.querySelector("#adminUsersRows .admin-role-teacher"));
T("класс менеджера (синий)", !!D.querySelector("#adminUsersRows .admin-role-manager"));
T("подписи ролей переведены", sectionText().includes("Студент") && sectionText().includes("Преподаватель")
  && sectionText().includes("Менеджер"));
T("студенту показана группа 101-PR", sectionText().includes("101-PR"));
T("преподавателю показан предмет «Математика»", sectionText().includes("Математика"));
T("преподавателю показан предмет «Русский язык»", sectionText().includes("Русский язык"));
T("менеджеру показано направление «Программирование»", sectionText().includes("Программирование"));
T("статус «Активен» у всех строк",
  D.querySelectorAll("#adminUsersRows .admin-user-status").length === 11,
  D.querySelectorAll("#adminUsersRows .admin-user-status").length);
T("нет сырых ключей направлений/предметов",
  !/subj_|dirProgramming|programming|design/.test(sectionText()), sectionText().slice(0, 300));

console.log("\n[3] Поиск и фильтр по роли вместе");
setFilter("a", "teacher");
T("поиск 'a' + роль teacher → 2", rows().length === 2, rows().length);
T("найдены только преподаватели с 'a'",
  rows().every(r => r.dataset.userRole === "teacher")
  && rows().map(r => txt(r.querySelector(".admin-user-name"))).sort().join(",") === "Ivanova E.P.,Sardor Rahimov",
  rows().map(r => txt(r.querySelector(".admin-user-name"))).join(","));
T("лог совместного фильтра 2", hasLog("Отфильтровано пользователей: 2"), logs.log.slice(-3).join(" | "));

setFilter("tosheva", "student");
T("поиск 'tosheva' + роль student → 1", rows().length === 1, rows().length);
T("это Tosheva Malika", txt(rows()[0].querySelector(".admin-user-name")) === "Tosheva Malika",
  txt(rows()[0].querySelector(".admin-user-name")));

setFilter("dilnoza", "manager");
T("поиск 'dilnoza' + роль manager → 1", rows().length === 1, rows().length);
T("карточка менеджера тоже отфильтрована", cards().length === 1, cards().length);

setFilter("ivanova", "");
T("только поиск по имени → Ivanova", rows().length === 1
  && txt(rows()[0].querySelector(".admin-user-name")) === "Ivanova E.P.", rows().length);

setFilter("", "student");
T("только роль student → 7", rows().length === 7, rows().length);
T("все строки — студенты", rows().every(r => r.dataset.userRole === "student"));

setFilter("", "");
T("фильтры сброшены → 11", rows().length === 11, rows().length);

console.log("\n[4] Пустой результат");
setFilter("zzzz", "");
T("0 строк-пользователей", rows().length === 0, rows().length);
T("заглушка в таблице", txt(D.querySelector("#adminUsersRows")).includes("Пользователи не найдены"));
T("заглушка в карточках", txt(D.getElementById("adminUsersCards")).includes("Пользователи не найдены"));
T("лог 0", hasLog("Отфильтровано пользователей: 0"), logs.log.slice(-2).join(" | "));
setFilter("", "");

console.log("\n[5] Кнопка «Добавить пользователя» (модалка) и клик по строке");
const addBtn = D.querySelector('[data-admin-action="add-user"]');
T("кнопка с data-admin-action=add-user", !!addBtn);
T("текст кнопки", txt(addBtn).includes("Добавить пользователя"), txt(addBtn));
alerts.length = 0;
addBtn.click();
T("клик открывает модалку (не alert)", !!D.getElementById("adminAddUserOverlay"));
T("alert при открытии не показывается", alerts.length === 0, safe(alerts));
T("заголовок модалки", txt(D.getElementById("adminAddUserOverlay")).includes("Добавить пользователя"));
D.getElementById("adminNewUserCancel").click();
T("«Отмена» закрывает модалку", !D.getElementById("adminAddUserOverlay"));

alerts.length = 0;
const firstName = rows()[0].dataset.adminUser;
rows()[0].click();
T("клик по строке показывает alert с именем",
  alerts.length === 1 && alerts[0].includes(firstName), safe(alerts));
alerts.length = 0;
cards()[0].click();
T("клик по карточке показывает alert", alerts.length === 1 && alerts[0].includes("в разработке"), safe(alerts));

console.log("\n[6] Переводы ru/uz/en");
const keys = ["adminRole", "adminAllRoles", "adminExtraInfo", "adminStatus", "adminAddUser",
  "adminAddUserDev", "adminUserCardDev", "adminUsersNotFound", "subj_russian"];
T("ключи есть в ru/uz/en",
  ["ru", "uz", "en"].every(l => keys.every(k => typeof w.eval(`translations.${l}`)[k] === "string")));

w.changeLanguage("en");
w.navigate("users");
T("английские заголовки", [...D.querySelectorAll("#sectionContent thead th")].map(txt).join("|")
  === "Full name|Role|Additional info|Status",
  [...D.querySelectorAll("#sectionContent thead th")].map(txt).join("|"));
T("английские роли", sectionText().includes("Student") && sectionText().includes("Teacher")
  && sectionText().includes("Manager"));
T("английские предметы/направление", sectionText().includes("Mathematics") && sectionText().includes("Russian")
  && sectionText().includes("Physics") && sectionText().includes("Programming"));
T("английский placeholder", D.getElementById("adminUserSearch").placeholder === "Search by name...",
  D.getElementById("adminUserSearch").placeholder);
setFilter("zzz", "");
T("английская заглушка", txt(D.querySelector("#adminUsersRows")).includes("No users found"));
setFilter("", "");

w.changeLanguage("uz");
w.navigate("users");
T("узбекские заголовки", [...D.querySelectorAll("#sectionContent thead th")].map(txt).join("|")
  === "F.I.Sh.|Rol|Qo'shimcha ma'lumot|Holat",
  [...D.querySelectorAll("#sectionContent thead th")].map(txt).join("|"));
T("узбекские роли", sectionText().includes("Talaba") && sectionText().includes("O'qituvchi")
  && sectionText().includes("Menejer"));
T("узбекские предметы/направление", sectionText().includes("Matematika") && sectionText().includes("Rus tili")
  && sectionText().includes("Fizika") && sectionText().includes("Dasturlash"));
w.changeLanguage("ru");
w.navigate("users");

console.log("\n[7] Пустые данные и регресс");
const saved = {
  students: w.eval("JSON.stringify(mockAllStudents)"),
  teachers: w.eval("JSON.stringify(mockAllTeachers)"),
  managers: w.eval("JSON.stringify(mockAllManagers)")
};
w.eval("mockAllStudents.length = 0; mockAllTeachers.length = 0; mockAllManagers.length = 0");
w.navigate("users");
T("0 пользователей — не падает", w.eval("allUsers.length") === 0, w.eval("allUsers.length"));
T("пустая заглушка", txt(D.querySelector("#adminUsersRows")).includes("Пользователи не найдены"));
T("нет undefined/NaN", !/undefined|\bNaN\b|\[object Object\]/.test(sectionText()), sectionText().slice(0, 200));
w.eval(`mockAllStudents.length = 0; JSON.parse(${JSON.stringify(saved.students)}).forEach(x => mockAllStudents.push(x));
  mockAllTeachers.length = 0; JSON.parse(${JSON.stringify(saved.teachers)}).forEach(x => mockAllTeachers.push(x));
  mockAllManagers.length = 0; JSON.parse(${JSON.stringify(saved.managers)}).forEach(x => mockAllManagers.push(x))`);
w.navigate("users");
T("данные восстановлены (11)", rows().length === 11, rows().length);

w.selectRole("manager");
w.navigate("students");
T("менеджер: студенты направления", D.querySelectorAll("#sectionContent .results-card").length > 0);
w.selectRole("teacher");
w.navigate("dashboard");
T("преподаватель: дашборд", !!D.querySelector("#sectionContent .dash-welcome"));
w.selectRole("student");
w.navigate("profile");
T("студент: профиль", !!D.querySelector("#sectionContent .profile-card"));
T("console.error пуст", logs.error.length === 0, safe(logs.error));

console.log(`\n=== ИТОГ: пройдено ${pass}, провалено ${fail} ===`);
process.exit(fail ? 1 : 0);
