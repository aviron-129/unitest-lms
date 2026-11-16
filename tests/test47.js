/* test47 — добавление менеджера через админку. */
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
const savedManagers = () => JSON.parse(w.localStorage.getItem("unitest_managers") || "[]");
const setRole = role => {
  const el = d.getElementById("adminNewUserRole");
  el.value = role;
  el.dispatchEvent(new w.Event("change", { bubbles: true }));
};
const submit = () => d.getElementById("adminAddUserForm")
  .dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));

console.log("\n[1] Роль «Менеджер» в форме");
w.selectRole("admin");
w.navigate("users");
d.querySelector('[data-admin-action="add-user"]').click();
T("модалка открыта", !!d.getElementById("adminAddUserOverlay"));
T("есть роль manager", !!d.querySelector('#adminNewUserRole option[value="manager"]'));

setRole("manager");
T("поля менеджера видны", d.getElementById("adminManagerFields").hidden === false);
T("поля студента скрыты", d.getElementById("adminStudentFields").hidden === true);
T("поля преподавателя скрыты", d.getElementById("adminTeacherFields").hidden === true);
T("есть выбор направления", !!d.getElementById("adminNewManagerDirection"));
T("направления: placeholder + 3",
  d.querySelectorAll("#adminNewManagerDirection option").length === 4,
  d.querySelectorAll("#adminNewManagerDirection option").length);

console.log("\n[2] Валидация");
app.alerts.length = 0;
d.getElementById("adminNewUserName").value = "Новый Менеджер";
d.getElementById("adminNewManagerDirection").value = "";
submit();
T("без направления → alert", app.alerts.length === 1 && app.alerts[0].includes("направление"),
  JSON.stringify(app.alerts));
T("модалка осталась открытой", !!d.getElementById("adminAddUserOverlay"));

console.log("\n[3] Создание менеджера");
app.alerts.length = 0;
d.getElementById("adminNewManagerDirection").value = "economics";
submit();
T("alert не показан", app.alerts.length === 0, JSON.stringify(app.alerts));
T("модалка закрылась", !d.getElementById("adminAddUserOverlay"));
T("менеджеров стало 3", w.eval("mockAllManagers.length") === 3, w.eval("mockAllManagers.length"));
const created = savedManagers().find(m => m.name === "Новый Менеджер");
T("менеджер сохранён в unitest_managers", !!created && savedManagers().length === 3);
T("id вида m_...", !!created && /^m_\d+$/.test(created.id), created && created.id);
T("направление economics", !!created && created.direction === "economics");
T("в таблице пользователей 13 строк",
  d.querySelectorAll("#adminUsersRows tr[data-admin-user]").length === 13,
  d.querySelectorAll("#adminUsersRows tr[data-admin-user]").length);
T("менеджер виден в пользователях", txt(d.getElementById("sectionContent")).includes("Новый Менеджер"));

console.log("\n[4] Раздел «Менеджеры»");
w.navigate("managers");
const managersText = txt(d.getElementById("sectionContent"));
T("менеджер виден в менеджерах", managersText.includes("Новый Менеджер"));
T("направление «Экономика»", managersText.includes("Экономика"));
T("есть кнопка «Добавить менеджера»", !!d.querySelector('[data-admin-action="add-manager"]'));
d.querySelector('[data-admin-action="add-manager"]').click();
T("кнопка открывает форму с ролью manager",
  d.getElementById("adminNewUserRole").value === "manager" &&
  d.getElementById("adminManagerFields").hidden === false);
d.getElementById("adminNewUserCancel").click();

console.log("\n[5] Один менеджер на направление");
w.navigate("users");
d.querySelector('[data-admin-action="add-user"]').click();
setRole("manager");
d.getElementById("adminNewUserName").value = "Второй Менеджер";
d.getElementById("adminNewManagerDirection").value = "economics";
app.alerts.length = 0;
submit();
T("занятое направление → alert", app.alerts.length === 1 && app.alerts[0].includes("уже назначен"),
  JSON.stringify(app.alerts));
T("второй менеджер не создан", w.eval("mockAllManagers.length") === 3);
d.getElementById("adminNewUserCancel").click();

console.log("\n[6] Переводы");
const keys = ["adminErrManagerDirection", "adminErrManagerBusy", "adminUserDirectionPh", "adminLogManagerAdded"];
T("ключи есть в ru/uz/en",
  ["ru", "uz", "en"].every(l => keys.every(k => typeof w.eval(`translations.${l}`)[k] === "string")));
T("console.error пуст", app.errors.length === 0, JSON.stringify(app.errors));

console.log(`\n=== TEST47: пройдено ${pass}, провалено ${fail} ===`);
process.exit(fail ? 1 : 0);
