/* test46 — чистый режим: только администратор, без демо-данных. */
const { createApp } = require("./harness");

let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log("  ok | " + name); }
  else { fail++; console.log("  FAIL | " + name + (extra !== undefined ? "  -> " + extra : "")); }
}

const app = createApp({ url: "https://clean.local/?clean=1" });
const w = app.window, d = app.document;
if (d.readyState === "loading") w.initApp();
const txt = el => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");

console.log("\n[1] Чистый старт");
T("DEMO_MODE выключен", w.eval("DEMO_MODE") === false);
T("студенты пустые", w.eval("mockAllStudents.length") === 0);
T("преподаватели пустые", w.eval("mockAllTeachers.length") === 0);
T("менеджеры пустые", w.eval("mockAllManagers.length") === 0);
T("группы пустые", w.eval("mockTeacherGroups.length") === 0);
T("тесты пустые", w.eval("mockTests.length") === 0);
T("сообщения пустые", w.eval("mockMessages.length") === 0);
T("результаты пустые", w.eval("getResults().length") === 0);
T("объявления пустые", w.eval("getAnnouncements().length") === 0);
T("уведомления пустые", w.eval("getRoleNotifications('admin').length") === 0);
T("динамические уведомления пустые", w.eval("getDynamicNotifications().length") === 0);

console.log("\n[2] Вход только администратора");
T("на экране один демо-логин", d.querySelectorAll("[data-demo-login]").length === 1,
  d.querySelectorAll("[data-demo-login]").length);
T("это admin", !!d.querySelector('[data-demo-login="admin"]'));

d.getElementById("loginUsername").value = "teacher";
d.getElementById("loginPassword").value = "teacher";
d.getElementById("loginForm").requestSubmit();
T("teacher отклонён", !d.getElementById("loginError").classList.contains("hidden")
  && d.getElementById("panelScreen").classList.contains("hidden"));

d.getElementById("loginUsername").value = "admin";
d.getElementById("loginPassword").value = "admin";
d.getElementById("loginForm").requestSubmit();
T("admin вошёл", w.eval("currentRole") === "admin"
  && !d.getElementById("panelScreen").classList.contains("hidden"));

console.log("\n[3] Пустой админ-дашборд");
w.navigate("dashboard");
const values = [...d.querySelectorAll("#sectionContent .stat-value")].map(txt);
T("4 карточки по нулям", values.join(",") === "0,0,0,0", values.join(","));
T("лента событий пустая", txt(d.querySelector("#sectionContent")).includes("Пока нет событий")
  || txt(d.querySelector("#sectionContent")).includes("нет событий"));

console.log("\n[4] Разделы пустые");
w.navigate("users");
T("allUsers = 1", w.eval("allUsers.length") === 1, w.eval("allUsers.length"));
T("в списке только админ", w.eval("allUsers[0].role") === "admin"
  && w.eval("allUsers[0].name") === "Aziz Karimov");
T("в таблице 1 строка", d.querySelectorAll("#adminUsersRows tr[data-admin-user]").length === 1);

w.navigate("groups");
T("группы пустые", w.eval("mockTeacherGroups.length") === 0);
const groupsText = txt(d.getElementById("sectionContent"));
T("заглушка групп", groupsText.includes("Пока нет групп") || groupsText.includes("групп"));

w.navigate("courses");
T("курсы пустые", txt(d.getElementById("sectionContent")).includes("Курсы пока не заданы"));

w.navigate("faculties");
T("факультеты пустые", txt(d.getElementById("sectionContent")).includes("Факультеты пока не добавлены"));

w.navigate("directions");
T("3 базовых направления", w.eval("mockDirections.length") === 3, w.eval("mockDirections.length"));
T("есть кнопка добавления направления", !!d.querySelector('[data-admin-action="add-direction"]'));

T("console.error пуст", app.errors.length === 0, JSON.stringify(app.errors));

console.log(`\n=== TEST46: пройдено ${pass}, провалено ${fail} ===`);
process.exit(fail ? 1 : 0);
