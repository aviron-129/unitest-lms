/* Тест Промта №36: аудит и полная локализация интерфейса.
   Проверяем: ключи словаря ×3, отсутствие русских строк в alert/confirm,
   title/placeholder/aria-label, кириллицу в EN-интерфейсе, заголовок вкладки,
   подстановку {0} и переключение языка при открытых модалках. */
const fs = require("fs");
const { createApp, HTML_PATH } = require("./harness");

const html = fs.readFileSync(HTML_PATH, "utf8");
const app = createApp();
const w = app.window, D = w.document;
const translations = JSON.parse(app.eval("JSON.stringify(translations)"));
const menuConfig = JSON.parse(app.eval("JSON.stringify(menuConfig)"));
const cyr = /[\u0400-\u04FF]/;

let pass = 0, fail = 0;
function T(n, c, e) { if (c) { pass++; console.log("  ok | " + n); } else { fail++; console.log("  FAIL | " + n + (e !== undefined ? "  -> " + e : "")); } }

console.log("\n[1] Словарь: новые ключи ×3");
const newKeys = [
  "appTitle", "menuAria", "timeUp", "restoreConfirm", "pdfExportDev", "resultsExportDev",
  "dgVectorCaption", "dgCircleCaption", "dgTriangleCaption", "dgRectangleCaption",
  "dgPlaneCaption", "dgFunctionCaption", "dgImageAlt", "dgErrExpected", "dgErrExtra",
  "dgErrFunction", "dgErrExpression", "dgErrNoValues", "dgErrUnknownType",
  "mlMatrix", "mlDiffEq", "mlTable", "matrixSize", "matrixRows", "matrixCols",
  "matrixHint", "matrixInsert"
];
const missing = [];
for (const key of newKeys) {
  for (const lang of ["ru", "uz", "en"]) {
    const v = translations[lang] && translations[lang][key];
    if (v == null || String(v).trim() === "") missing.push(`${lang}.${key}`);
  }
}
T(`все ${newKeys.length} новых ключей есть в ru/uz/en`, missing.length === 0, missing.join(", "));

console.log("\n[1.1] Нет битых «?» вместо кавычек/тире в переводах");
// Аудит q3: в uz/en часть типографских кавычек и тире была испорчена в «?»
// («?PDF sifatida saqlash?ni», «choose ?Save as PDF?», «demo ? results»).
// Ловим ? внутри слова и одинокий ? между словами; настоящие вопросы
// («Продолжить?», «Вы уверены? Все данные…») не подсвечиваются.
const mojibake = [];
for (const lang of ["ru", "uz", "en"]) {
  for (const [key, value] of Object.entries(translations[lang] || {})) {
    const text = String(value);
    if (/\?[A-Za-zА-Яа-яЁё0-9]/.test(text) || / \? [a-zа-яё]/.test(text)) {
      mojibake.push(`${lang}.${key}: ${text}`);
    }
  }
}
T("в переводах нет битых ?", mojibake.length === 0, mojibake.slice(0, 5).join(" | "));

console.log("\n[2] Нет русских строк в alert/confirm");
const alertMatches = [...html.matchAll(/\b(?:alert|confirm)\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)]
  .map(m => m[2]).filter(s => cyr.test(s));
T("alert/confirm только через dict", alertMatches.length === 0, alertMatches.slice(0, 5).join(" | "));

console.log("\n[3] Нет русских title/placeholder/aria-label в разметке");
const attrBad = [];
for (const m of html.matchAll(/\s(title|placeholder|aria-label)="([^"]*)"/g)) {
  if (cyr.test(m[2])) attrBad.push(`${m[1]}="${m[2]}"`);
}
T("атрибуты без кириллицы", attrBad.length === 0, attrBad.slice(0, 5).join(" | "));

console.log("\n[4] EN-интерфейс без кириллицы (все роли и разделы)");
w.changeLanguage("en");
const leftovers = [];
function scanAttrs(label) {
  D.querySelectorAll("[title],[aria-label],[placeholder]").forEach(el => {
    ["title", "aria-label", "placeholder"].forEach(attr => {
      const v = el.getAttribute(attr);
      if (v && cyr.test(v)) leftovers.push(`${label}:${attr}="${v}"`);
    });
  });
}
// Чат и объявления показывают пользовательский/mock-контент (сообщения, тексты
// объявлений) — по условию Промта №36 данные не переводим, проверяем только интерфейс.
const dataSections = new Set(["chat", "announcements"]);
for (const role of Object.keys(menuConfig)) {
  w.selectRole(role);
  for (const item of menuConfig[role]) {
    w.navigate(item.id);
    const box = D.getElementById("sectionContent");
    const text = (box && box.textContent) || "";
    if (!dataSections.has(item.id) && cyr.test(text)) leftovers.push(`${role}/${item.id}: текст`);
    scanAttrs(`${role}/${item.id}`);
  }
  w.logout();
}
T("в EN не осталось кириллицы в контенте и атрибутах", leftovers.length === 0, leftovers.slice(0, 6).join(" | "));

console.log("\n[5] Заголовок вкладки и подстановка значений");
w.changeLanguage("en");
T("EN title", D.title.includes("Testing platform"), D.title);
w.changeLanguage("ru");
T("RU title", D.title.includes("Платформа тестирования"), D.title);
w.changeLanguage("en");
const caption = w.trf("dgCircleCaption", 0, 0, 3, "28.27");
T("trf подставляет {0}…{3}", caption.includes("Circle") && caption.includes("r = 3") && caption.includes("28.27"), caption);

console.log("\n[6] Переключение языка не ломает открытые модалки");
w.selectRole("teacher");
w.navigate("announcements");
w.openTeacherAnnouncementModal();
const annOverlay = D.getElementById("teacherAnnOverlay");
T("модалка объявления открыта", !!annOverlay && !annOverlay.classList.contains("hidden"));
w.changeLanguage("en");
T("после смены языка модалка объявления жива", !!D.getElementById("teacherAnnOverlay")
  && !D.getElementById("teacherAnnOverlay").classList.contains("hidden"));
w.closeTeacherAnnouncementModal();

w.openMatrixDialog(null);
const mxOverlay = D.getElementById("matrixOverlay");
T("модалка матрицы открыта", !!mxOverlay && !mxOverlay.classList.contains("hidden"));
w.changeLanguage("uz");
const mx = D.getElementById("matrixOverlay");
T("после смены языка модалка матрицы жива", !!mx && !mx.classList.contains("hidden"));
T("подписи матрицы переведены", (D.getElementById("mxCancel") || {}).textContent === translations.uz.cancel,
  (D.getElementById("mxCancel") || {}).textContent);
w.closeMatrixDialog();
T("console.error пуст", app.errors.length === 0, app.errors.slice(0, 3).join(" | "));

console.log(`\n=== TEST36: пройдено ${pass}, провалено ${fail} ===`);
app.close();
process.exit(fail === 0 ? 0 : 1);
