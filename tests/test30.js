/* test30.js — Промт №29: панель администратора, настройки и журнал действий.
   Проверяем: рендер раздела, демо-журнал (таблица + мобильные карточки),
   системные настройки, сохранение в unitest_settings, реальное скачивание JSON,
   очистку журнала, сброс базы с сохранением unitest_lang/unitest_theme,
   переводы ru/uz/en и регресс.
   Запуск: node tests/test30.js */
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
const rows = () => [...d.querySelectorAll(".admin-logs-table tbody tr[data-admin-log]")];
const cards = () => [...d.querySelectorAll(".admin-log-cards .admin-log-card")];

console.log("\n[1] Рендер раздела «Настройки»");
w.selectRole("admin");
w.navigate("settings");
T("раздел отрисован (не заглушка)", !!d.getElementById("adminLogsPanel") && !!d.getElementById("adminSystemPanel"));
T("нет «в разработке»", !sectionText().includes("в разработке"));
T("журнал действий слева", !!d.querySelector(".admin-settings-grid #adminLogsPanel"));
T("системные настройки справа", !!d.querySelector(".admin-settings-grid #adminSystemPanel"));
T("6 демо-записей в таблице", rows().length === 6, rows().length);
T("6 демо-карточек (мобильный)", cards().length === 6, cards().length);
T("колонки Время / Пользователь / Действие",
  ["Время", "Пользователь", "Действие"].every(h => txt(d.querySelector(".admin-logs-table thead")).includes(h)));
T("первая запись: создан тест", txt(rows()[0]).includes("Создан тест") && txt(rows()[0]).includes("Математика"));
T("в журнале есть пользователь-админ", txt(d.querySelector(".admin-logs-table tbody")).includes("Aziz Karimov"));
T("лог отрисовки", app.logs.some(l => l === "Отрисовка настроек. Загружено логов: 6"),
  app.logs.filter(l => l.startsWith("Отрисовка настроек")));
T("заголовок «Журнал действий»", sectionText().includes("Журнал действий"));
T("заголовок «Системные настройки»", sectionText().includes("Системные настройки"));
T("кнопка «Очистить журнал»", !!d.getElementById("adminClearLogs"));

console.log("\n[2] Системные настройки: поля и значения");
T("поле названия вуза", d.getElementById("adminSettingsName")?.value === "UniTest University",
  d.getElementById("adminSettingsName")?.value);
T("поле учебного года", d.getElementById("adminSettingsYear")?.value === "2026/2027",
  d.getElementById("adminSettingsYear")?.value);
T("селект языка", d.getElementById("adminSettingsLang")?.value === "ru");
T("селект темы", d.getElementById("adminSettingsTheme")?.value === "light");
T("блок резервной копии", !!d.getElementById("adminBackupBtn"));
T("опасная зона", !!d.querySelector(".admin-danger") && sectionText().includes("Опасная зона"));
T("кнопка сброса", !!d.getElementById("adminResetDb"));

console.log("\n[3] Валидация настроек");
const nameEl = d.getElementById("adminSettingsName");
const yearEl = d.getElementById("adminSettingsYear");
nameEl.value = "";
d.getElementById("adminSettingsSave").click();
T("пустое название — ошибка", txt(d.getElementById("adminSettingsStatus")) === "Введите название вуза",
  txt(d.getElementById("adminSettingsStatus")));
T("статус ошибки красный", d.getElementById("adminSettingsStatus").classList.contains("admin-settings-status--error"));
T("настройки не сохранены", w.localStorage.getItem("unitest_settings") == null);
nameEl.value = "Tashkent State University";
yearEl.value = "";
d.getElementById("adminSettingsSave").click();
T("пустой учебный год — ошибка", txt(d.getElementById("adminSettingsStatus")) === "Введите учебный год",
  txt(d.getElementById("adminSettingsStatus")));

console.log("\n[4] Сохранение настроек");
yearEl.value = "2027/2028";
d.getElementById("adminSettingsLang").value = "en";
d.getElementById("adminSettingsTheme").value = "dark";
d.getElementById("adminSettingsSave").click();
const saved = JSON.parse(w.localStorage.getItem("unitest_settings") || "null");
T("unitest_settings записан", !!saved);
T("название сохранено", saved && saved.university === "Tashkent State University", saved);
T("учебный год сохранён", saved && saved.academicYear === "2027/2028", saved);
T("язык сохранён", saved && saved.language === "en", saved);
T("тема сохранена", saved && saved.theme === "dark", saved);
T("язык применён сразу", w.eval("currentLang") === "en", w.eval("currentLang"));
T("тема применена сразу", w.eval("currentTheme") === "dark" && d.documentElement.getAttribute("data-theme") === "dark",
  w.eval("currentTheme"));
T("статус «Settings saved»", txt(d.getElementById("adminSettingsStatus")) === "Settings saved",
  txt(d.getElementById("adminSettingsStatus")));
T("раздел переведён на английский", sectionText().includes("Action log") && sectionText().includes("Danger zone"));
T("запись «System settings changed» в журнале",
  w.eval("systemLogs[0].actionKey") === "adminLogSettingsChanged", w.eval("systemLogs[0]"));

console.log("\n[5] Резервная копия — реальное скачивание JSON");
const backup = w.eval("adminBackupData()");
T("backup.app = UniTest", backup.app === "UniTest");
T("backup.schemaVersion = 1", backup.schemaVersion === 1);
T("в backup есть настройки", backup.settings && backup.settings.university === "Tashkent State University");
T("в backup есть unitest_results", !!backup.storage && !!backup.storage.unitest_results);
T("в backup есть журнал", Array.isArray(backup.logs) && backup.logs.length >= 7, backup.logs && backup.logs.length);

let download = null;
const origClick = w.HTMLAnchorElement.prototype.click;
w.HTMLAnchorElement.prototype.click = function () {
  download = { name: this.download, href: String(this.href) };
};
d.getElementById("adminBackupBtn").click();
w.HTMLAnchorElement.prototype.click = origClick;
T("скачивание инициировано", !!download);
T("имя файла unitest-backup-*.json", download && /^unitest-backup-\d{4}-\d{2}-\d{2}\.json$/.test(download.name),
  download && download.name);
T("ссылка на JSON (blob или data URI)",
  download && (download.href.indexOf("blob:") === 0 || download.href.indexOf("data:application/json") === 0),
  download && download.href.slice(0, 40));
T("статус «Backup downloaded»", txt(d.getElementById("adminBackupStatus")).startsWith("Backup downloaded:"),
  txt(d.getElementById("adminBackupStatus")));
T("лог «Резервная копия сформирована»", app.logs.some(l => l.startsWith("Резервная копия сформирована: unitest-backup-")));
T("запись о копии в журнале", w.eval("systemLogs[0].actionKey") === "adminLogBackup", w.eval("systemLogs[0]"));

w.navigate("settings");
T("после возврата в раздел записей 8", rows().length === 8, rows().length);

console.log("\n[6] Очистка журнала");
d.getElementById("adminClearLogs").click();
T("журнал пуст", rows().length === 0, rows().length);
T("заглушка «Журнал пока пуст»", sectionText().includes("The log is empty"));
T("кнопки очистки больше нет", !d.getElementById("adminClearLogs"));
T("unitest_audit = []", w.localStorage.getItem("unitest_audit") === "[]", w.localStorage.getItem("unitest_audit"));
w.navigate("dashboard");
w.navigate("settings");
T("после перерисовки журнал остаётся пустым", rows().length === 0, rows().length);

console.log("\n[7] Сброс базы данных (отдельный экземпляр)");
const app2 = createApp();
const w2 = app2.window, d2 = app2.document;
w2.selectRole("admin");
w2.navigate("settings");
w2.localStorage.setItem("unitestalltests", JSON.stringify([{ id: "temp_test" }]));
w2.localStorage.setItem("uniteststudents", JSON.stringify([{ id: "temp_student" }]));
w2.localStorage.setItem("unitest_managers", JSON.stringify([{ id: "temp_manager" }]));
w2.localStorage.setItem("unitest_audit", "[]");
w2.localStorage.setItem("unitest_settings", JSON.stringify({ university: "Temp" }));
w2.localStorage.setItem("unitest_lang", "uz");
w2.localStorage.setItem("unitest_theme", "dark");
let reloaded = false;
w2.reloadAdminPage = () => { reloaded = true; };
d2.getElementById("adminResetDb").click();
T("unitest_lang сохранён", w2.localStorage.getItem("unitest_lang") === "uz", w2.localStorage.getItem("unitest_lang"));
T("unitest_theme сохранён", w2.localStorage.getItem("unitest_theme") === "dark", w2.localStorage.getItem("unitest_theme"));
T("unitestalltests удалён", w2.localStorage.getItem("unitestalltests") == null);
T("uniteststudents удалён", w2.localStorage.getItem("uniteststudents") == null);
T("unitest_managers удалён", w2.localStorage.getItem("unitest_managers") == null);
T("unitest_settings удалён", w2.localStorage.getItem("unitest_settings") == null);
T("unitest_audit удалён", w2.localStorage.getItem("unitest_audit") == null);
T("reload вызван", reloaded === true);
T("alert о сбросе показан",
  app2.alerts.some(a => a.includes("База данных очищена") || a.includes("Ma'lumotlar bazasi tozalandi")),
  app2.alerts);
T("лог запроса сброса", app2.logs.includes("Пользователь запросил сброс БД"));
T("лог очистки localStorage", app2.logs.includes("localStorage очищен"));
T("console.error пуст (reset)", app2.errors.length === 0, app2.errors);
app2.close();

console.log("\n[8] Переводы ru/uz/en");
const keys = [
  "adminLogTitle", "adminLogSubtitle", "adminLogTime", "adminLogUser", "adminLogAction",
  "adminClearLog", "adminClearLogConfirm", "adminNoLogs", "adminLogTestMath",
  "adminLogTestCreated", "adminLogUserAdded", "adminLogGroupCreated", "adminLogGroupUpdated",
  "adminLogResultAdded", "adminLogManagerAssigned", "adminLogManagerFreed",
  "adminLogSettingsChanged", "adminLogBackup", "adminLogReset", "adminLogScheduleUpdated",
  "adminSystemTitle", "adminSettingsSubtitle", "adminSettingsUniversity", "adminSettingsUniversityPh",
  "adminSettingsYear", "adminSettingsYearPh", "adminSettingsLang", "adminSettingsTheme",
  "adminThemeLight", "adminThemeDark", "adminSettingsSave", "adminSettingsSaved",
  "adminErrSettingsName", "adminErrSettingsYear", "adminBackupTitle", "adminBackupHint",
  "adminBackupBtn", "adminBackupDone", "adminBackupError", "adminDangerZone", "adminResetDb",
  "adminResetHint", "adminResetConfirm", "adminResetDone"
];
T("ключи есть в ru/uz/en",
  ["ru", "uz", "en"].every(lang => keys.every(k => typeof w.eval(`translations.${lang}`)[k] === "string")));
w.changeLanguage("ru");
w.navigate("settings");
T("русский: Журнал действий / Опасная зона",
  sectionText().includes("Журнал действий") && sectionText().includes("Опасная зона"));
w.changeLanguage("uz");
T("узбекский: Harakatlar jurnali / Xavfli zona",
  sectionText().includes("Harakatlar jurnali") && sectionText().includes("Xavfli zona"));
w.changeLanguage("en");
T("английский: Action log / System settings",
  sectionText().includes("Action log") && sectionText().includes("System settings"));
w.changeLanguage("ru");

console.log("\n[9] Регресс");
T("дашборд админа цел", (w.navigate("dashboard"), d.querySelectorAll("#sectionContent .stat-card").length === 4));
T("пользователи целы", (w.navigate("users"), d.querySelectorAll("#adminUsersRows tr[data-admin-user]").length === 12));
T("отчёты целы", (w.navigate("reports"), d.querySelectorAll(".admin-reports-table tbody tr").length === 4));
T("менеджер цел", (w.selectRole("manager"), w.navigate("dashboard"),
  d.querySelectorAll("#sectionContent .stat-card").length === 3));
T("студент цел", (w.selectRole("student"), w.navigate("profile"),
  sectionText().includes("Tosheva")));
T("console.error пуст", app.errors.length === 0, app.errors);

console.log(`\n=== ИТОГ: пройдено ${pass}, провалено ${fail} ===`);
app.close();
process.exit(fail === 0 ? 0 : 1);
