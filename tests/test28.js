/* test28.js — Промт №27: панель администратора, назначение менеджеров.
   Проверяем: направления из mockTeacherGroups, таблица + карточки, модалку,
   назначение/освобождение, правило «один менеджер — одно направление»,
   сохранение в unitest_managers, загрузку после F5 и переводы ru/uz/en.
   Запуск: node tests/test28.js */
const { createApp } = require("./harness");

const app = createApp();
const w = app.window, d = app.document;
let pass = 0, fail = 0;

function T(name, cond, extra) {
  if (cond) { pass++; console.log("  ok | " + name); }
  else { fail++; console.log("  FAIL | " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra) : "")); }
}
const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
const sectionText = () => txt(d.getElementById("sectionContent"));
const tableRows = () => [...d.querySelectorAll(".admin-managers-table tbody tr")];
const btnFor = (direction) =>
  d.querySelector(`[data-admin-manager-direction="${direction}"] [data-admin-manager-assign]`);
const submitModal = () => {
  d.getElementById("adminManagerForm").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
};

console.log("\n[1] Раздел «Менеджеры»");
w.selectRole("admin");
w.navigate("managers");
T("таблица отрисована", !!d.querySelector("#sectionContent table.admin-managers-table"));
T("2 направления (programming/design)", tableRows().length === 2, tableRows().length);
T("мобильные карточки — 2", d.querySelectorAll(".admin-manager-cards .admin-manager-card").length === 2);
T("programming: Dilnoza Yusupova", txt(tableRows()[0]).includes("Dilnoza Yusupova"));
T("design: не назначен", txt(tableRows()[1]).includes("Не назначен"));
T("лог направлений", app.logs.some(l => l.startsWith("Направления для управления:")
  && l.includes("programming") && l.includes("design")));
T("нет заглушки «в разработке»", !sectionText().includes("в разработке"));

console.log("\n[2] Модалка назначения");
btnFor("design").click();
T("модалка открыта", !!d.getElementById("adminManagerOverlay"));
T("заголовок содержит направление", txt(d.getElementById("adminManagerModalTitle")).includes("Дизайн"));
T("лог открытия", app.logs.some(l => l === "Открыто окно назначения для: Дизайн"));
T("select: placeholder + 2 менеджера + освободить",
  d.querySelectorAll("#adminManagerSelect option").length === 4,
  d.querySelectorAll("#adminManagerSelect option").length);
T("есть опция «Освободить должность»", txt(d.getElementById("adminManagerSelect")).includes("Освободить должность"));
T("кнопки Отмена/Сохранить", !!d.getElementById("adminManagerCancel") && !!d.getElementById("adminManagerSave"));
T("«Отмена» закрывает модалку", (d.getElementById("adminManagerCancel").click(), !d.getElementById("adminManagerOverlay")));

console.log("\n[3] Назначение и сохранение");
btnFor("design").click();
d.getElementById("adminManagerSelect").value = "m2";
submitModal();
T("модалка закрылась", !d.getElementById("adminManagerOverlay"));
T("m2 → design", w.eval("mockAllManagers.find(m => m.id === 'm2').direction") === "design");
T("таблица: design = Sidorova", txt(tableRows()[1]).includes("Sidorova A.A."));
T("unitest_managers сохранён", JSON.parse(w.localStorage.getItem("unitest_managers")).length === 2);
T("лог назначения", app.logs.some(l => l.includes("Менеджер Sidorova A.A. назначен на Дизайн")));
T("лог обновлённого списка", app.logs.some(l => l.startsWith("Обновленный список менеджеров:")));

console.log("\n[4] Один менеджер — одно направление");
btnFor("programming").click();
d.getElementById("adminManagerSelect").value = "m2";
submitModal();
T("m2 → programming", w.eval("mockAllManagers.find(m => m.id === 'm2').direction") === "programming");
T("прежний менеджер m1 освобождён", w.eval("mockAllManagers.find(m => m.id === 'm1').direction") === null);
T("design снова не назначен", txt(tableRows()[1]).includes("Не назначен"));
T("на programming ровно один менеджер",
  w.eval("mockAllManagers.filter(m => m.direction === 'programming').length") === 1);

console.log("\n[5] Освобождение должности");
btnFor("programming").click();
d.getElementById("adminManagerSelect").value = "__free__";
submitModal();
T("m2 освобождён", w.eval("mockAllManagers.find(m => m.id === 'm2').direction") === null);
T("programming не назначен", txt(tableRows()[0]).includes("Не назначен"));
T("лог освобождения", app.logs.some(l => l.includes("Должность освобождена: Программирование")));

console.log("\n[6] Загрузка из unitest_managers (F5)");
w.localStorage.setItem("unitest_managers", JSON.stringify([
  { id: "m1", name: "Dilnoza Yusupova", direction: "design" },
  { id: "m2", name: "Sidorova A.A.", direction: null }
]));
w.loadManagersFromStorage();
T("загружено 2 менеджера", w.eval("mockAllManagers.length") === 2);
T("mockManager синхронизирован (design)", w.eval("mockManager.direction") === "design");
w.navigate("managers");
T("после F5 design = Dilnoza", txt(tableRows()[1]).includes("Dilnoza Yusupova"));

console.log("\n[7] Переводы ru/uz/en");
const keys = ["adminManagersSubtitle", "adminManagerCurrent", "adminManagerNotAssigned",
  "adminManagerAssign", "adminManagerFree", "adminManagerSelect", "adminManagerActions",
  "adminManagerModalTitle", "adminErrManager"];
T("ключи есть в ru/uz/en",
  ["ru", "uz", "en"].every(l => keys.every(k => typeof w.eval(`translations.${l}`)[k] === "string")));
w.changeLanguage("en");
T("английский заголовок", sectionText().includes("Current manager"));
T("английский «Not assigned»/Assign", sectionText().includes("Not assigned") && sectionText().includes("Assign / Change"));
w.changeLanguage("uz");
T("узбекский заголовок", sectionText().includes("Joriy menejer"));
T("узбекский «Tayinlanmagan»/Tayinlash", sectionText().includes("Tayinlanmagan") && sectionText().includes("Tayinlash / O'zgartirish"));
w.changeLanguage("ru");

console.log("\n[8] Регресс");
T("дашборд админа цел", (w.navigate("dashboard"), d.querySelectorAll("#sectionContent .stat-card").length === 4));
T("пользователи целы", (w.navigate("users"), d.querySelectorAll("#adminUsersRows tr[data-admin-user]").length === 12));
T("console.error пуст", app.errors.length === 0, app.errors);

console.log(`\n=== ИТОГ: пройдено ${pass}, провалено ${fail} ===`);
app.close();
process.exit(fail === 0 ? 0 : 1);
