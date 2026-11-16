/* test48 — направления и удаление групп/менеджеров/пользователей. */
const { createApp } = require("./harness");

let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log("  ok | " + name); }
  else { fail++; console.log("  FAIL | " + name + (extra !== undefined ? "  -> " + extra : "")); }
}

const app = createApp();
const w = app.window, d = app.document;
if (d.readyState === "loading") w.initApp();
const txt = el => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
const savedDirections = () => JSON.parse(w.localStorage.getItem("unitest_directions") || "[]");
const submitDirection = () => d.getElementById("adminDirectionForm")
  .dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));

console.log("\n[1] Направления: добавление, редактирование, удаление");
w.selectRole("admin");
T("пункт меню «Направления»", !!d.querySelector('#sidebarMenu [data-section="directions"]'));
w.navigate("directions");
T("раздел направлений", !!d.querySelector('[data-admin-action="add-direction"]'));
T("3 базовых направления", w.eval("mockDirections.length") === 3, w.eval("mockDirections.length"));

d.querySelector('[data-admin-action="add-direction"]').click();
T("модалка направления открыта", !!d.getElementById("adminDirectionOverlay"));
d.getElementById("adminDirectionName").value = "Медицина";
submitDirection();
T("направление добавлено", w.eval("mockDirections.length") === 4, w.eval("mockDirections.length"));
const custom = savedDirections().find(x => x.name === "Медицина");
T("сохранено в unitest_directions", !!custom);
T("в таблице 4 строки", d.querySelectorAll("[data-admin-direction-row]").length === 4);

d.querySelector(`[data-admin-edit-direction="${custom.id}"]`).click();
d.getElementById("adminDirectionName").value = "Медицина и здоровье";
submitDirection();
T("направление переименовано", savedDirections().some(x => x.id === custom.id && x.name === "Медицина и здоровье"));

w.confirm = () => false;
const beforeCancel = w.eval("mockDirections.length");
d.querySelector(`[data-admin-delete-direction="${custom.id}"]`).click();
T("отмена удаления направления", w.eval("mockDirections.length") === beforeCancel);
w.confirm = () => true;

d.querySelector(`[data-admin-delete-direction="${custom.id}"]`).click();
T("направление удалено", w.eval("mockDirections.length") === 3, w.eval("mockDirections.length"));

console.log("\n[2] Удаление группы");
w.navigate("groups");
T("в группе 101-PR есть студенты", w.eval("mockAllStudents.filter(s => s.group === '101-PR').length") > 0);
const groupsBefore = w.eval("mockTeacherGroups.length");
d.querySelector('[data-admin-delete-group]').click();
T("после удаления групп меньше", w.eval("mockTeacherGroups.length") === groupsBefore - 1,
  w.eval("mockTeacherGroups.length"));
T("студенты не удалены, но без группы",
  w.eval("mockAllStudents.filter(s => s.group === '101-PR').length") === 0 &&
  w.eval("mockAllStudents.length") === 7);
T("лог удаления группы", w.eval("systemLogs.some(x => x.actionKey === 'adminLogGroupDeleted')"));

console.log("\n[3] Удаление менеджера");
w.navigate("managers");
const managersBefore = w.eval("mockAllManagers.length");
T("у менеджера есть кнопка удаления", !!d.querySelector('[data-admin-delete-manager="m1"]'));
d.querySelector('[data-admin-delete-manager="m1"]').click();
T("менеджер удалён", w.eval("mockAllManagers.length") === managersBefore - 1);
T("направление освободилось", w.eval("mockAllManagers.every(m => m.direction !== 'programming')"));

console.log("\n[4] Удаление пользователей");
w.navigate("users");
T("у админа нет кнопки удаления", !d.querySelector('[data-admin-delete-user="a1"]'));
const studentsBefore = w.eval("mockAllStudents.length");
d.querySelector('[data-admin-delete-user="s1"]').click();
T("студент удалён", w.eval("mockAllStudents.length") === studentsBefore - 1);
T("студента нет в таблице", !txt(d.getElementById("adminUsersRows")).includes("Ivanov Ivan"));
const teachersBefore = w.eval("mockAllTeachers.length");
d.querySelector('[data-admin-delete-user="t3"]').click();
T("преподаватель удалён", w.eval("mockAllTeachers.length") === teachersBefore - 1);
T("лог удаления пользователя", w.eval("systemLogs.some(x => x.actionKey === 'adminLogUserDeleted')"));

console.log("\n[5] Защита направления с зависимостями");
w.navigate("directions");
app.alerts.length = 0;
d.querySelector('[data-admin-delete-direction="programming"]').click();
T("направление с группой не удалено", w.eval("mockDirections.some(x => x.id === 'programming')"));
T("показана ошибка", app.alerts.some(x => x.includes("Нельзя удалить")), JSON.stringify(app.alerts));

console.log("\n[6] Переводы");
const keys = ["directions", "adminAddDirection", "adminEditDirection", "adminDeleteDirectionConfirm",
  "adminDeleteGroupConfirm", "adminDeleteManagerConfirm", "adminDeleteUserConfirm"];
T("ключи есть в ru/uz/en",
  ["ru", "uz", "en"].every(l => keys.every(k => typeof w.eval(`translations.${l}`)[k] === "string")));
T("console.error пуст", app.errors.length === 0, JSON.stringify(app.errors));

console.log(`\n=== TEST48: пройдено ${pass}, провалено ${fail} ===`);
process.exit(fail ? 1 : 0);
