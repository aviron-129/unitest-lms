/* Тест Промта №26: панель администратора — добавление пользователя.
   Проверяем: модалку вместо alert, динамические поля по роли, сброс значений,
   валидацию, создание студента/преподавателя, сохранение в uniteststudents /
   unitestteachers, перерисовку таблицы, восстановление после «F5»,
   переводы ru/uz/en и регресс других панелей. */
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
const sectionText = () => txt(D.getElementById("sectionContent"));
const overlay = () => D.getElementById("adminAddUserOverlay");
const savedStudents = () => JSON.parse(w.localStorage.getItem("uniteststudents") || "[]");
const savedTeachers = () => JSON.parse(w.localStorage.getItem("unitestteachers") || "[]");

function openModal() {
  const btn = D.querySelector('[data-admin-action="add-user"]');
  if (btn) btn.click();
}
function setRole(role) {
  const el = D.getElementById("adminNewUserRole");
  el.value = role;
  el.dispatchEvent(new w.Event("change", { bubbles: true }));
}
function submitForm() {
  const form = D.getElementById("adminAddUserForm");
  if (form) form.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
}
function fillStudent({ name, group, course, form, category }) {
  if (name !== undefined) D.getElementById("adminNewUserName").value = name;
  if (group !== undefined) D.getElementById("adminNewUserGroup").value = group;
  if (course !== undefined) D.getElementById("adminNewUserCourse").value = String(course);
  if (form !== undefined) D.getElementById("adminNewUserForm").value = form;
  if (category !== undefined) D.getElementById("adminNewUserCategory").value = category;
}
function fillTeacher({ name, subject }) {
  if (name !== undefined) D.getElementById("adminNewUserName").value = name;
  if (subject !== undefined) D.getElementById("adminNewUserSubject").value = subject;
}

console.log("\n[1] Исходный раздел «Пользователи»");
w.selectRole("admin");
w.navigate("users");
T("allUsers = 11", w.eval("allUsers.length") === 11, w.eval("allUsers.length"));
T("в таблице 11 строк", rows().length === 11, rows().length);
T("кнопка добавления есть", !!D.querySelector('[data-admin-action="add-user"]'));

console.log("\n[2] Модалка и динамические поля по роли");
alerts.length = 0;
openModal();
T("модалка открылась", !!overlay());
T("alert при открытии не показывается", alerts.length === 0, safe(alerts));
T("заголовок «Добавить пользователя»", txt(overlay()).includes("Добавить пользователя"));
T("поля: роль/ФИО/группа/курс/форма/категория",
  !!D.getElementById("adminNewUserRole") && !!D.getElementById("adminNewUserName")
  && !!D.getElementById("adminNewUserGroup") && !!D.getElementById("adminNewUserCourse")
  && !!D.getElementById("adminNewUserForm") && !!D.getElementById("adminNewUserCategory"));
T("роль по умолчанию — студент", D.getElementById("adminNewUserRole").value === "student");
T("поля студента видны", D.getElementById("adminStudentFields").hidden === false);
T("поле предмета скрыто", D.getElementById("adminTeacherFields").hidden === true);
T("группы из mockTeacherGroups (4 + placeholder)",
  D.querySelectorAll("#adminNewUserGroup option").length === 5,
  D.querySelectorAll("#adminNewUserGroup option").length);
T("курс 1..5", D.getElementById("adminNewUserCourse").min === "1"
  && D.getElementById("adminNewUserCourse").max === "5");
T("категории: Лучник/Обычный",
  [...D.querySelectorAll("#adminNewUserCategory option")].map(o => txt(o)).join("|") === "Лучник|Обычный",
  [...D.querySelectorAll("#adminNewUserCategory option")].map(o => txt(o)).join("|"));

setRole("teacher");
T("лог выбранной роли", hasLog("Выбрана роль: teacher"), logs.log.slice(-3).join(" | "));
T("поля студента скрыты", D.getElementById("adminStudentFields").hidden === true);
T("поле предмета видно", D.getElementById("adminTeacherFields").hidden === false);
T("значения студента сброшены",
  D.getElementById("adminNewUserGroup").value === ""
  && D.getElementById("adminNewUserCourse").value === "1"
  && D.getElementById("adminNewUserForm").value === "full"
  && D.getElementById("adminNewUserCategory").value === "archer");
setRole("student");
T("возврат к студенту: поля снова видны", D.getElementById("adminStudentFields").hidden === false);
T("поле предмета снова скрыто и очищено",
  D.getElementById("adminTeacherFields").hidden === true
  && D.getElementById("adminNewUserSubject").value === "");

console.log("\n[3] Валидация");
alerts.length = 0;
fillStudent({ name: "   ", group: "", course: 1 });
submitForm();
T("пустое ФИО → alert", alerts.length === 1 && alerts[0].includes("Введите ФИО"), safe(alerts));
T("модалка осталась открытой", !!overlay());

alerts.length = 0;
fillStudent({ name: "Новый Студент", group: "", course: 1 });
submitForm();
T("без группы → alert", alerts.length === 1 && alerts[0].includes("Выберите группу"), safe(alerts));

alerts.length = 0;
setRole("teacher");
fillTeacher({ name: "Новый Преподаватель", subject: "" });
submitForm();
T("без предмета → alert", alerts.length === 1 && alerts[0].includes("Введите предмет"), safe(alerts));
T("студент/преподаватель не созданы",
  w.eval("mockAllStudents.length") === 7 && w.eval("mockAllTeachers.length") === 3,
  `${w.eval("mockAllStudents.length")}/${w.eval("mockAllTeachers.length")}`);

console.log("\n[4] Создание студента и сохранение");
setRole("student");
alerts.length = 0;
const studentName = "Тестов Студент";
fillStudent({ name: studentName, group: "101-PR", course: 2, form: "part", category: "regular" });
submitForm();
T("модалка закрылась", !overlay());
T("alert при сохранении не показывался", alerts.length === 0, safe(alerts));
T("студентов стало 8", w.eval("mockAllStudents.length") === 8, w.eval("mockAllStudents.length"));
T("новая строка в таблице", rows().length === 12 && sectionText().includes(studentName), rows().length);
const createdStudent = savedStudents().find(s => s.name === studentName);
T("студент сохранён в uniteststudents (8)", savedStudents().length === 8, savedStudents().length);
T("объект студента: id s_ + Date.now()", !!createdStudent && /^s_\d+$/.test(createdStudent.id),
  createdStudent && createdStudent.id);
T("поля студента: group/course/form/category",
  createdStudent && createdStudent.group === "101-PR" && createdStudent.course === 2
  && createdStudent.form === "part" && createdStudent.category === "regular",
  safe(createdStudent));
T("лог создания пользователя", hasLog("Пользователь создан:"), logs.log.slice(-5).join(" | "));
T("лог количества студентов", hasLog("Всего студентов теперь: 8"), logs.log.slice(-5).join(" | "));

console.log("\n[5] Создание преподавателя");
openModal();
setRole("teacher");
alerts.length = 0;
const teacherName = "Тестов Преподаватель";
fillTeacher({ name: teacherName, subject: "Информатика" });
submitForm();
T("модалка закрылась", !overlay());
T("преподавателей стало 4", w.eval("mockAllTeachers.length") === 4, w.eval("mockAllTeachers.length"));
T("преподаватель в таблице", rows().length === 13 && sectionText().includes(teacherName), rows().length);
T("предмет показан в доп. информации", sectionText().includes("Информатика"));
const createdTeacher = savedTeachers().find(t => t.name === teacherName);
T("преподаватель сохранён в unitestteachers (4)", savedTeachers().length === 4, savedTeachers().length);
T("объект преподавателя: id t_ + Date.now()", !!createdTeacher && /^t_\d+$/.test(createdTeacher.id),
  createdTeacher && createdTeacher.id);
T("поле subject", createdTeacher && createdTeacher.subject === "Информатика", safe(createdTeacher));
T("лог количества преподавателей", hasLog("Всего преподавателей теперь: 4"), logs.log.slice(-5).join(" | "));

console.log("\n[6] Сохранение после «перезагрузки» (F5)");
const seedStudents = w.localStorage.getItem("uniteststudents");
const seedTeachers = w.localStorage.getItem("unitestteachers");
let reloadError = "";
let reloadStudents = -1, reloadTeachers = -1;
let reloadHasStudent = false, reloadHasTeacher = false;
let reloadRows = -1;
try {
  const dom2 = new JSDOM(html, {
    url: "https://unitest.local/", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(w2) {
      w2.localStorage.setItem("uniteststudents", seedStudents);
      w2.localStorage.setItem("unitestteachers", seedTeachers);
      w2.console.log = () => {}; w2.console.error = () => {};
      w2.alert = () => {}; w2.confirm = () => true;
      w2.setInterval = () => 1; w2.clearInterval = () => {};
    }
  });
  const w2 = dom2.window, D2 = w2.document;
  if (D2.readyState === "loading") w2.initApp();
  reloadStudents = w2.eval("mockAllStudents.length");
  reloadTeachers = w2.eval("mockAllTeachers.length");
  reloadHasStudent = w2.eval(`mockAllStudents.some(s => s.name === ${JSON.stringify(studentName)})`);
  reloadHasTeacher = w2.eval(`mockAllTeachers.some(t => t.name === ${JSON.stringify(teacherName)})`);
  w2.selectRole("admin");
  w2.navigate("users");
  reloadRows = D2.querySelectorAll("#adminUsersRows tr[data-admin-user]").length;
  w2.close();
} catch (e) {
  reloadError = e.message;
}
T("F5: 8 студентов из uniteststudents", reloadStudents === 8, `${reloadStudents} ${reloadError}`);
T("F5: 4 преподавателя из unitestteachers", reloadTeachers === 4, reloadTeachers);
T("F5: созданный студент на месте", reloadHasStudent === true, reloadHasStudent);
T("F5: созданный преподаватель на месте", reloadHasTeacher === true, reloadHasTeacher);
T("F5: в таблице 13 строк", reloadRows === 13, reloadRows);

console.log("\n[7] Переводы ru/uz/en");
const keys = ["adminUserNamePh", "adminUserGroup", "adminUserGroupPh", "adminUserCategory",
  "adminUserSubject", "adminUserSubjectPh", "adminErrUserName", "adminErrUserGroup",
  "adminErrUserSubject", "adminUserCreated", "adminUserStudentsNow", "adminUserTeachersNow"];
T("ключи есть в ru/uz/en",
  ["ru", "uz", "en"].every(l => keys.every(k => typeof w.eval(`translations.${l}`)[k] === "string")));

w.changeLanguage("en");
w.navigate("users");
openModal();
T("английская модалка", txt(overlay()).includes("Add user") && txt(overlay()).includes("Full name")
  && txt(overlay()).includes("Group") && txt(overlay()).includes("Category"));
setRole("teacher");
T("английский предмет/ошибка", txt(overlay()).includes("Subject"));
alerts.length = 0;
fillTeacher({ name: "", subject: "" });
submitForm();
T("английская валидация ФИО", alerts.length === 1 && alerts[0] === "Enter the full name", safe(alerts));
D.getElementById("adminNewUserCancel").click();

w.changeLanguage("uz");
w.navigate("users");
openModal();
T("узбекская модалка", txt(overlay()).includes("Foydalanuvchi qo'shish")
  && txt(overlay()).includes("Guruh") && txt(overlay()).includes("Toifa"));
setRole("teacher");
T("узбекский предмет", txt(overlay()).includes("Fan"));
D.getElementById("adminNewUserCancel").click();
w.changeLanguage("ru");
w.navigate("users");

console.log("\n[8] Регресс");
T("дашборд админа — 4 карточки", (() => {
  w.navigate("dashboard");
  return D.querySelectorAll("#sectionContent .stat-card").length === 4;
})());
T("группы админа", (() => {
  w.navigate("groups");
  return D.querySelectorAll("#sectionContent .admin-group-card").length === 4;
})());
w.selectRole("manager");
w.navigate("schedule");
T("менеджер: расписание", D.querySelectorAll("#sectionContent .schedule-card").length === 10,
  D.querySelectorAll("#sectionContent .schedule-card").length);
w.selectRole("teacher");
w.navigate("myGroups");
T("преподаватель: группы", D.querySelectorAll("#sectionContent .group-card").length > 0);
w.selectRole("student");
w.navigate("profile");
T("студент: профиль", !!D.querySelector("#sectionContent .profile-card"));
T("console.error пуст", logs.error.length === 0, safe(logs.error));

console.log(`\n=== ИТОГ: пройдено ${pass}, провалено ${fail} ===`);
process.exit(fail ? 1 : 0);
