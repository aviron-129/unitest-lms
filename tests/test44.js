/* test44.js — Промт №44: экспорт/импорт JSON + печать зачётки (v2).
   Проверяем: реальный экспорт всех unitest-ключей (+ datasets/summary),
   импорт с валидацией, предпросмотром и подтверждением, print CSS и
   замену alert на window.print() в зачётке, переводы ru/uz/en, регресс.
   Запуск: node tests/test44.js */
const fs = require("fs");
const path = require("path");
const { createApp, HTML_PATH } = require("./harness");

const html = fs.readFileSync(HTML_PATH, "utf8");
let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log("  ok | " + name); }
  else { fail++; console.log("  FAIL | " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra) : "")); }
}
const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");

/* ---------- 1. Экспорт базы (админ) ---------- */
console.log("\n[1] Реальный экспорт JSON");
const app = createApp();
const w = app.window, d = app.document;
w.selectRole("admin");
w.navigate("settings");

T("кнопка экспорта на месте", !!d.getElementById("adminBackupBtn"));
T("кнопка импорта на месте", !!d.getElementById("adminImportBtn"));
const fileInput = d.getElementById("import-file");
T("скрытый input type=file #import-file", !!fileInput && fileInput.type === "file");
T("input принимает .json", !!fileInput && fileInput.accept.includes(".json"));
T("input скрыт (display:none)", !!fileInput && fileInput.style.display === "none");

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
T("ссылка на JSON (blob/data)", download && (download.href.indexOf("blob:") === 0 ||
  download.href.indexOf("data:application/json") === 0));
T("лог «Экспорт базы. Собрано ключей: N»",
  app.logs.some(l => /^Экспорт базы\. Собрано ключей: \d+$/.test(l)),
  app.logs.filter(l => l.startsWith("Экспорт базы")));

const backup = w.eval("adminBackupData()");
T("backup.app = UniTest", backup.app === "UniTest");
T("backup.storage содержит unitest-ключи", !!backup.storage && Object.keys(backup.storage).length > 0,
  backup.storage && Object.keys(backup.storage).length);
T("в backup есть тесты (datasets.tests)", Array.isArray(backup.datasets?.tests) && backup.datasets.tests.length > 0,
  backup.datasets?.tests?.length);
T("в backup есть результаты (datasets.results)", Array.isArray(backup.datasets?.results));
T("в backup есть объявления (datasets.announcements)", Array.isArray(backup.datasets?.announcements));
T("в backup есть пользователи (students/teachers/managers)",
  Array.isArray(backup.datasets?.users?.students) &&
  Array.isArray(backup.datasets?.users?.teachers) &&
  Array.isArray(backup.datasets?.users?.managers));
T("summary: ключи/тесты/результаты/объявления/пользователи",
  backup.summary && backup.summary.keys === Object.keys(backup.storage).length &&
  backup.summary.tests === backup.datasets.tests.length &&
  backup.summary.results === backup.datasets.results.length &&
  backup.summary.announcements === backup.datasets.announcements.length &&
  backup.summary.students === backup.datasets.users.students.length,
  backup.summary);

// Кнопка импорта программно кликает по input (и сбрасывает value).
let inputClicked = false;
fileInput.click = () => { inputClicked = true; };
d.getElementById("adminImportBtn").click();
T("кнопка импорта открывает выбор файла", inputClicked === true);

// Экспорт при пустом localStorage не падает
const appEmpty = createApp();
const wEmpty = appEmpty.window, dEmpty = appEmpty.document;
wEmpty.selectRole("admin");
wEmpty.navigate("settings");
try { wEmpty.localStorage.clear(); } catch (e) { /* ignore */ }
let emptyDownload = null;
const origClick2 = wEmpty.HTMLAnchorElement.prototype.click;
wEmpty.HTMLAnchorElement.prototype.click = function () { emptyDownload = this.download; };
dEmpty.getElementById("adminBackupBtn").click();
wEmpty.HTMLAnchorElement.prototype.click = origClick2;
T("пустой localStorage: файл всё равно скачивается", !!emptyDownload, emptyDownload);
T("пустой localStorage: без console.error", appEmpty.errors.length === 0, appEmpty.errors);
T("пустой localStorage: в экспорте есть mock-тесты",
  wEmpty.eval("adminBackupData().datasets.tests.length") > 0);
appEmpty.close();

/* ---------- 2. Импорт: валидация ---------- */
console.log("\n[2] Импорт: валидация и предпросмотр");
const app2 = createApp();
const w2 = app2.window, d2 = app2.document;
w2.selectRole("admin");
w2.navigate("settings");
const status = () => txt(d2.getElementById("adminBackupStatus"));

const bad = w2.handleImportText("{ это не json", "bad.json");
T("битый JSON отклонён", bad.ok === false && bad.invalid === true);
T("alert «неверный формат файла»", app2.alerts.some(a => a.includes("неверный формат файла")), app2.alerts);
T("статус-ошибка в блоке копии", d2.getElementById("adminBackupStatus").classList.contains("admin-settings-status--error"),
  status());
T("модалка не открыта", !d2.getElementById("adminImportOverlay"));

app2.alerts.length = 0;
const empty = w2.handleImportText("{}", "empty.json");
T("пустой объект отклонён", empty.ok === false && empty.empty === true);
T("alert «нет данных UniTest»", app2.alerts.some(a => a.includes("нет данных UniTest")), app2.alerts);
T("модалка не открыта (пусто)", !d2.getElementById("adminImportOverlay"));

app2.alerts.length = 0;
w2.handleImportFile(null);
T("null-файл → ошибка чтения", app2.alerts.some(a => a.includes("Не удалось прочитать файл")), app2.alerts);

const payload = {
  storage: {
    unitestalltests: [{ id: "imp_test", title: "Imported test" }],
    unitest_results: [{ testId: "imp_test", grade: 5 }],
    unitest_announcements: [{ id: "imp_ann", title: "Imported news" }],
    uniteststudents: [{ id: "s_imp", name: "Imported Student" }],
    unitestteachers: [{ id: "t_imp", name: "Imported Teacher" }],
    unitest_managers: [{ id: "m_imp", name: "Imported Manager" }],
    unitest_lang: "ru",
    evilKey: "must be skipped"
  }
};
const preview = w2.handleImportText(JSON.stringify(payload), "backup.json");
T("валидный файл принят", preview.ok === true);
T("посторонний ключ отброшен", preview.skipped.includes("evilKey"), preview.skipped);
T("сводка: 1 тест", preview.summary.tests === 1, preview.summary);
T("сводка: 1 результат", preview.summary.results === 1);
T("сводка: 1 объявление", preview.summary.announcements === 1);
T("сводка: 3 пользователя", preview.summary.users === 3, preview.summary.users);

const overlay = d2.getElementById("adminImportOverlay");
T("модалка предпросмотра открыта", !!overlay);
T("заголовок «Предпросмотр импорта»", txt(overlay).includes("Предпросмотр импорта"));
T("7 ключей в таблице", d2.querySelectorAll("#adminImportOverlay .admin-import-table tbody tr").length === 7,
  d2.querySelectorAll("#adminImportOverlay .admin-import-table tbody tr").length);
T("в таблице есть unitestalltests", txt(d2.querySelector("#adminImportOverlay .admin-import-table")).includes("unitestalltests"));
T("сводные карточки 4 шт.", d2.querySelectorAll("#adminImportOverlay .admin-import-stat").length === 4);
T("предупреждение о пропущенном ключе", txt(overlay).includes("evilKey"));
T("кнопка подтверждения", !!d2.getElementById("adminImportConfirm"));
T("кнопка отмены", !!d2.getElementById("adminImportCancel"));
T("файл показан в предпросмотре", txt(overlay).includes("backup.json"));

// Esc закрывает без записи
d2.dispatchEvent(new w2.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
T("Esc закрывает предпросмотр", !d2.getElementById("adminImportOverlay"));
T("данные не записаны до подтверждения", w2.localStorage.getItem("unitestalltests") !==
  JSON.stringify(payload.storage.unitestalltests));

/* ---------- 3. Импорт: подтверждение ---------- */
console.log("\n[3] Импорт: подтверждение и запись");
let reloaded = 0;
w2.reloadAdminPage = () => { reloaded++; };
w2.updateAppealsMenuBadge = () => {};
const preview2 = w2.handleImportText(JSON.stringify(payload), "backup.json");
T("предпросмотр повторно открыт", preview2.ok && !!d2.getElementById("adminImportOverlay"));
d2.getElementById("adminImportConfirm").click();

const stored = JSON.parse(w2.localStorage.getItem("unitestalltests") || "null");
T("unitestalltests записан", Array.isArray(stored) && stored[0].id === "imp_test", stored);
T("unitest_results записан", JSON.parse(w2.localStorage.getItem("unitest_results") || "null")[0].grade === 5);
T("uniteststudents записан", JSON.parse(w2.localStorage.getItem("uniteststudents") || "null")[0].id === "s_imp");
T("unitest_managers записан", JSON.parse(w2.localStorage.getItem("unitest_managers") || "null")[0].id === "m_imp");
T("посторонний ключ не записан", w2.localStorage.getItem("evilKey") == null);
T("лог «Импорт базы. Загружено ключей: 7»",
  app2.logs.some(l => l === "Импорт базы. Загружено ключей: 7"),
  app2.logs.filter(l => l.startsWith("Импорт базы")));
T("alert «База успешно восстановлена»",
  app2.alerts.some(a => a.includes("База успешно восстановлена")), app2.alerts);
T("страница перезагружается", reloaded === 1, reloaded);
T("модалка закрыта после импорта", !d2.getElementById("adminImportOverlay"));
T("запись об импорте в журнале",
  w2.eval("systemLogs[0].actionKey") === "adminLogImport", w2.eval("systemLogs[0]"));
T("console.error пуст (импорт)", app2.errors.length === 0, app2.errors);

// Промт q8: простые строки (язык/тема) не должны кодироваться повторно —
// иначе в localStorage попадало "\"ru\"", и после reload initApp падал.
T("unitest_lang из импорта — строка без лишних кавычек",
  w2.localStorage.getItem("unitest_lang") === "ru",
  w2.localStorage.getItem("unitest_lang"));
const themePreview = w2.handleImportText(JSON.stringify({ storage: { unitest_theme: "dark" } }), "theme.json");
T("импорт одного ключа темы открыт", themePreview.ok && !!d2.getElementById("adminImportOverlay"));
d2.getElementById("adminImportConfirm").click();
T("unitest_theme из импорта — строка без лишних кавычек",
  w2.localStorage.getItem("unitest_theme") === "dark",
  w2.localStorage.getItem("unitest_theme"));

// Отмена не пишет данные
app2.alerts.length = 0;
const before = w2.localStorage.getItem("unitestalltests");
const preview3 = w2.handleImportText(JSON.stringify({ storage: { unitestalltests: [{ id: "cancel_me" }] } }), "c.json");
d2.getElementById("adminImportCancel").click();
T("отмена закрывает предпросмотр", !d2.getElementById("adminImportOverlay"));
T("отмена не меняет localStorage", w2.localStorage.getItem("unitestalltests") === before);

/* ---------- 4. Форматы импорта ---------- */
console.log("\n[4] Поддержка форматов импорта");
const normBackup = w2.normalizeImportPayload(w2.adminBackupData());
T("наш backup читается обратно", normBackup.ok === true &&
  !!normBackup.storage.unitest_results && normBackup.summary.tests > 0);
const flat = w2.normalizeImportPayload({
  tests: [{ id: "flat_test" }],
  results: [{ testId: "flat_test", grade: 4 }],
  announcements: [],
  users: { students: [{ id: "flat_student" }], teachers: [], managers: [] }
});
T("плоский формат (tests/results/users) распознан", flat.ok === true, flat);
T("плоский: тест попал в unitestalltests", flat.storage.unitestalltests?.[0]?.id === "flat_test");
T("плоский: пользователи разложены по ключам",
  flat.storage.uniteststudents?.[0]?.id === "flat_student" &&
  Array.isArray(flat.storage.unitestteachers) &&
  Array.isArray(flat.storage.unitest_managers));
T("не-объект отклонён", w2.normalizeImportPayload([]).ok === false);
T("null отклонён", w2.normalizeImportPayload(null).ok === false);

// Промт q8: в бэкап язык/тема попадают простыми строками (а не JSON-строками),
// поэтому после импорта их не нужно кодировать второй раз.
w2.changeLanguage("en");
w2.switchTheme();
const ownBackup = w2.adminBackupData();
T("backup: unitest_lang — простая строка", ownBackup.storage.unitest_lang === "en",
  ownBackup.storage.unitest_lang);
T("backup: unitest_theme — простая строка", ownBackup.storage.unitest_theme === "dark",
  ownBackup.storage.unitest_theme);
app2.close();

/* ---------- 5. Печать зачётки ---------- */
console.log("\n[5] Печать зачётки");
const app3 = createApp();
const w3 = app3.window, d3 = app3.document;
w3.selectRole("student");
w3.navigate("gradebook");

const printBtn = d3.getElementById("exportPdfBtn");
T("кнопка печати в зачётке", !!printBtn);
T("подпись «Печать зачётки»", txt(printBtn).includes("Печать зачётки"), txt(printBtn));
T("кнопка не вызывает alert-заглушку", !txt(printBtn).toLowerCase().includes("pdf"));
const printHead = d3.getElementById("transcriptPrintHead");
T("печатная шапка есть в DOM", !!printHead);
T("в шапке заголовок «Зачётка»", txt(printHead).includes("Зачётка"), txt(printHead));
T("в шапке имя студента", txt(printHead).includes("Tosheva Malika Alisherovna"), txt(printHead));
T("в шапке группа 101-PR", txt(printHead).includes("101-PR"));
T("в шапке дата печати", !!d3.getElementById("transcriptPrintDate"));
T("таблица оценок на месте", d3.querySelectorAll(".transcript-table tbody tr").length >= 2);

let printed = 0;
w3.print = () => { printed++; };
printBtn.click();
T("window.print вызван", printed === 1, printed);
T("лог «Вызов окна печати для студента: …»",
  app3.logs.some(l => l === "Вызов окна печати для студента: Tosheva Malika Alisherovna"),
  app3.logs.filter(l => l.startsWith("Вызов окна печати")));
T("alert-заглушки нет", app3.alerts.length === 0, app3.alerts);

const printBlockMatch = html.match(/@media print\s*\{[\s\S]*?\n    \}/);
const printBlock = printBlockMatch ? printBlockMatch[0] : "";
T("в CSS есть @media print", printBlock.length > 0);
T("print CSS: .sidebar скрыт", /\.sidebar[^{]*\{[^}]*display:\s*none\s*!important/s.test(printBlock));
T("print CSS: .app-header скрыт", /\.app-header[^{]*\{[^}]*display:\s*none\s*!important/s.test(printBlock));
T("print CSS: .btn/button скрыты", /button[^{]*\{[^}]*display:\s*none\s*!important/s.test(printBlock));
T("print CSS: .no-print скрыт", /\.no-print[^{]*\{[^}]*display:\s*none\s*!important/s.test(printBlock));
T("print CSS: .main-content без отступов", /\.main-content\s*\{[^}]*margin:\s*0\s*!important[^}]*padding:\s*0\s*!important/s.test(printBlock));
T("print CSS: фон белый, текст чёрный", /background:\s*#ffffff\s*!important/s.test(printBlock) &&
  /color:\s*#000000\s*!important/s.test(printBlock));
T("print CSS: печатная шапка показывается", /\.transcript-print-head\s*\{[^}]*display:\s*block\s*!important/s.test(printBlock));
T("print CSS: таблица зачётки печатается", /\.transcript-table\s*\{[^}]*display:\s*table\s*!important/s.test(printBlock));

// Переводы кнопки/шапки
w3.changeLanguage("uz");
w3.navigate("gradebook");
T("узбекский: кнопка печати", txt(d3.getElementById("exportPdfBtn")).includes("chop etish"),
  txt(d3.getElementById("exportPdfBtn")));
T("узбекский: заголовок зачётки", txt(d3.getElementById("transcriptPrintHead")).includes("Baholar"),
  txt(d3.getElementById("transcriptPrintHead")));
w3.changeLanguage("en");
w3.navigate("gradebook");
T("английский: кнопка печати", txt(d3.getElementById("exportPdfBtn")).includes("Print transcript"));
w3.changeLanguage("ru");

/* ---------- 6. Переводы и регресс ---------- */
console.log("\n[6] Переводы ru/uz/en и регресс");
const keys = [
  "adminImportTitle", "adminImportHint", "adminImportBtn", "adminImportPreviewTitle",
  "adminImportPreviewHint", "adminImportKeys", "adminImportRecords", "adminImportSkipped",
  "adminImportEmpty", "adminImportInvalid", "adminImportReadError", "adminImportConfirm",
  "adminImportDone", "adminImportNothing", "adminImportTests", "adminImportResults",
  "adminImportAnnouncements", "adminImportUsers", "adminLogImport", "downloadPdf"
];
T("ключи импорта/печати есть в ru/uz/en",
  ["ru", "uz", "en"].every(lang => keys.every(k => typeof w3.eval(`translations.${lang}`)[k] === "string")));
T("в промте нет alert-заглушки «Экспорт в PDF в разработке»",
  !/Экспорт в PDF в разработке/.test(html));

T("админ: пользователи целы", (w3.selectRole("admin"), w3.navigate("users"),
  d3.querySelectorAll("#adminUsersRows tr[data-admin-user]").length === 12));
T("админ: настройки целы", (w3.navigate("settings"),
  !!d3.getElementById("adminBackupBtn") && !!d3.getElementById("adminImportBtn")));
T("преподаватель: результаты целы", (w3.selectRole("teacher"), w3.navigate("results"),
  !!d3.querySelector("#sectionContent")));
T("студент: профиль цел", (w3.selectRole("student"), w3.navigate("profile"),
  txt(d3.getElementById("sectionContent")).includes("Tosheva")));
T("console.error пуст (регресс)", app3.errors.length === 0, app3.errors);

console.log(`\n=== ИТОГ: пройдено ${pass}, провалено ${fail} ===`);
app.close();
app3.close();
process.exit(fail === 0 ? 0 : 1);
