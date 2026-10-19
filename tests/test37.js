/* Тест Промта №37: мобильная адаптивность и UI-фиксы.
   Проверяем статические правила вёрстки (их не видит jsdom-layout), наличие
   мобильных карточек вместо таблиц, off-canvas sidebar, выпадающие панели,
   ограничение высоты модалок и JS-самопроверку горизонтального скролла. */
const fs = require("fs");
const { createApp, HTML_PATH } = require("./harness");

const html = fs.readFileSync(HTML_PATH, "utf8");
const css = (html.match(/<style>([\s\S]*?)<\/style>/) || ["", ""])[1];
const app = createApp();
const w = app.window, D = w.document;
const translations = JSON.parse(app.eval("JSON.stringify(translations)"));

let pass = 0, fail = 0;
function T(n, c, e) { if (c) { pass++; console.log("  ok | " + n); } else { fail++; console.log("  FAIL | " + n + (e !== undefined ? "  -> " + e : "")); } }
function cssHas(re) { return re.test(css); }

console.log("\n[1] Горизонтальный скролл и таблицы");
T("body { overflow-x: hidden }", cssHas(/body\s*\{[^}]*overflow-x\s*:\s*hidden/));
T("универсальная обёртка .table-responsive", cssHas(/\.table-responsive[^{]*\{[^}]*overflow-x\s*:\s*auto/));
T("обёртки таблиц скроллятся внутри себя",
  cssHas(/\.transcript-table-wrap[^{]*\{[^}]*overflow-x\s*:\s*auto/) &&
  cssHas(/\.results-table-wrap\s*\{[^}]*overflow-x\s*:\s*auto/));
T("у обёрток ограничена ширина", cssHas(/\.results-table-wrap\s*\{[^}]*max-width\s*:\s*100%/));
T("таблицы обёрнуты в .table-responsive", /class="results-table-wrap table-responsive/.test(html) &&
  /class="transcript-table-wrap table-responsive"/.test(html));

console.log("\n[2] Таблицы → карточки на мобильном");
T("таблицы скрываются до 768px", cssHas(/@media\s*\(max-width:\s*767\.98px\)\s*\{[\s\S]*?\.results-table-wrap\s*\{\s*display:\s*none/));
T("карточки результатов показываются сеткой", cssHas(/\.results-cards\s*\{\s*display:\s*grid/));
for (const [name, id] of [
  ["пользователи", "adminUsersCards"],
  ["студенты менеджера", "managerStudentsCards"]
]) {
  T(`контейнер карточек (${name}) — отдельный от таблицы`, new RegExp(`id="${id}"`).test(html));
}
T("карточки отчётов админа", /admin-report-cards/.test(html));
T("карточки журнала действий", /admin-log-cards/.test(html));

console.log("\n[3] Sidebar / бургер / затемнение");
T("sidebar уезжает за край", cssHas(/translateX\(-100%\)/));
T("sidebar открывается классом .open", cssHas(/\.sidebar\.open\s*\{\s*transform:\s*translateX\(0\)/));
T("overlay на 150, sidebar на 200",
  cssHas(/\.sidebar-overlay\s*\{[^}]*z-index\s*:\s*150/) && cssHas(/\.sidebar\s*\{[^}]*z-index\s*:\s*200/));
T("бургер виден только на мобильном", cssHas(/\.burger-btn\s*\{\s*display:\s*none/) && cssHas(/\.burger-btn\s*\{\s*display:\s*block/));
T("клик по фону закрывает меню", /sidebarOverlay'\)\.addEventListener\('click',\s*closeSidebar\)/.test(html));
T("при переходе на десктоп меню закрывается", /innerWidth\s*>=\s*1024[\s\S]{0,80}closeSidebar\(\)/.test(html));

console.log("\n[4] Выпадающие панели шапки на мобильном");
T("панель уведомлений фиксируется по ширине экрана",
  /@media\s*\(max-width:\s*767\.98px\)\s*\{[\s\S]*?\.notif-dropdown,\s*[\s\S]*?\.search-dropdown\s*\{[\s\S]*?position:\s*fixed/.test(css));
T("у выпадашек left/right по 10px", /\.search-dropdown\s*\{[\s\S]*?left:\s*10px;[\s\S]*?right:\s*10px/.test(css));
T("у выпадашек ограничена высота", /max-height:\s*calc\(100dvh\s*-\s*90px\)/.test(css));
T("внутренние списки не режут панель", /\.notif-dropdown \.notif-list,\s*[\s\S]*?max-height:\s*none/.test(css));

console.log("\n[5] Модалки");
T("админ-модалка не выше 90vh", cssHas(/\.admin-modal\s*\{[^}]*max-height:\s*90vh/));
T("админ-модалка прокручивается", cssHas(/\.admin-modal\s*\{[^}]*overflow-y:\s*auto/));
T("статья уведомления ограничена по высоте", cssHas(/\.notif-article\s*\{[^}]*max-height:\s*85vh/));
T("на телефоне модалки не выше экрана", /\.notif-article,\s*[\s\S]*?\.ann-modal\s*\{[\s\S]*?max-height:\s*calc\(100dvh\s*-\s*20px\)/.test(css));
T("на ≤480px админ-модалка на всю высоту", /@media\s*\(max-width:\s*479\.98px\)\s*\{[\s\S]*?\.admin-modal\s*\{\s*width:\s*100%;\s*max-height:\s*100vh/.test(css));

console.log("\n[6] Длинные ФИО и названия, узкие экраны");
T("длинные имена переносятся", cssHas(/\.group-name\s*\{[^}]*overflow-wrap:\s*anywhere/));
T("карточка группы не растягивает grid", cssHas(/\.group-card\s*\{[^}]*min-width:\s*0/));
T("заголовок раздела переносится", cssHas(/#sectionHeading[\s\S]{0,500}overflow-wrap:\s*anywhere/));
T("шапка ужимается на 320px", /@media\s*\(max-width:\s*380px\)\s*\{[\s\S]*?\.burger-btn,[\s\S]*?\.icon-btn\s*\{[\s\S]*?width:\s*36px/.test(css));
T("расписание на 1024px — 3 колонки", cssHas(/@media\s*\(max-width:\s*1199\.98px\)\s*\{[\s\S]*?\.schedule-grid\s*\{[^}]*repeat\(3,\s*minmax\(0,\s*1fr\)\)/));

console.log("\n[7] JS-самопроверка переполнения");
T("функция checkOverflow существует", typeof w.checkOverflow === "function");
T("возвращает boolean без переполнения", w.checkOverflow() === false);
T("слушатель resize добавлен", /window\.addEventListener\('resize',\s*checkOverflow\)/.test(html));
T("проверка при загрузке через setTimeout", /setTimeout\(checkOverflow,\s*1000\)/.test(html));
T("текст предупреждения есть в ru/uz/en",
  ["ru", "uz", "en"].every(l => translations[l] && String(translations[l].overflowWarning || "").trim()));

console.log("\n[8] Консоль");
T("console.error пуст", app.errors.length === 0, app.errors.slice(0, 3).join(" | "));

console.log(`\n=== TEST37: пройдено ${pass}, провалено ${fail} ===`);
app.close();
process.exit(fail === 0 ? 0 : 1);
