/* Тест улучшения ввода формул: панель-конструктор, mhchem (химия), таблица Менделеева
   Запуск: node test17.js   (jsdom установлен в этой же папке) */
const fs = require("fs");
const { JSDOM } = require("jsdom");

const HTML_PATH = require("path").join(__dirname, "..", "index.html");
const html = fs.readFileSync(HTML_PATH, "utf8");

let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log("  ok | " + name); }
  else { fail++; console.log("  FAIL | " + name + (extra !== undefined ? "  -> " + extra : "")); }
}
function safeJson(x) { try { return JSON.stringify(x); } catch (e) { return String(x); } }
const hasLog = (w, s) => w.__logs.log.some(l => l.includes(s));

function makeWindow(storage) {
  const logs = { log: [], error: [] };
  const alerts = [];
  const dom = new JSDOM(html, {
    url: "https://unitest.local/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.console.log = (...a) => logs.log.push(a.map(x => typeof x === "string" ? x : safeJson(x)).join(" "));
      window.console.error = (...a) => logs.error.push(a.map(x => typeof x === "string" ? x : safeJson(x)).join(" "));
      window.alert = m => alerts.push(String(m));
      window.confirm = () => true;
      window.setInterval = () => 1;
      window.clearInterval = () => {};
      if (storage) for (const [k, v] of Object.entries(storage)) window.localStorage.setItem(k, v);
    }
  });
  dom.window.__logs = logs;
  dom.window.__alerts = alerts;
  if (dom.window.document.readyState === "loading") dom.window.initApp();
  return dom.window;
}

const w = makeWindow(null);

/* ============================================================
   [1] Подключение mhchem и данные таблицы Менделеева
   ============================================================ */
console.log("\n[1] Подключение и данные");
T("mhchem подключён после katex", html.includes("katex@0.16.8/dist/contrib/mhchem.min.js"));
T("порядок скриптов: katex → mhchem → auto-render",
  html.indexOf("katex.min.js") < html.indexOf("mhchem.min.js")
  && html.indexOf("mhchem.min.js") < html.indexOf("contrib/auto-render.min.js"));
T("PT_SYMBOLS: 118 элементов", w.eval("PT_SYMBOLS.length") === 118, w.eval("PT_SYMBOLS.length"));
T("PT_RU: 118 названий", w.eval("PT_RU.length") === 118, w.eval("PT_RU.length"));
T("PT_EN: 118 названий", w.eval("PT_EN.length") === 118, w.eval("PT_EN.length"));
T("Fe = железо (Z=26)", w.eval("PT_SYMBOLS[25]") === "Fe" && w.eval("PT_RU[25]") === "Железо",
  w.eval("PT_SYMBOLS[25]") + "/" + w.eval("PT_RU[25]"));
T("Og = оганессон (Z=118)", w.eval("PT_SYMBOLS[117]") === "Og" && w.eval("PT_RU[117]") === "Оганессон",
  w.eval("PT_SYMBOLS[117]") + "/" + w.eval("PT_RU[117]"));
T("K = калий (Z=19), No = нобелий (Z=102)",
  w.eval("PT_SYMBOLS[18]") === "K" && w.eval("PT_RU[18]") === "Калий"
  && w.eval("PT_SYMBOLS[101]") === "No" && w.eval("PT_RU[101]") === "Нобелий"
  && w.eval("PT_EN[18]") === "Potassium" && w.eval("PT_EN[101]") === "Nobelium",
  w.eval("PT_SYMBOLS[101]") + "/" + w.eval("PT_RU[101]"));
T("позиции: H (1,1), He (18,1), Fe (8,4), La (4,9), Og (18,7)",
  safeJson([w.eval("ptPos(1)"), w.eval("ptPos(2)"), w.eval("ptPos(26)"), w.eval("ptPos(57)"), w.eval("ptPos(118)")])
    === '[{"c":1,"r":1},{"c":18,"r":1},{"c":8,"r":4},{"c":4,"r":9},{"c":18,"r":7}]',
  safeJson([w.eval("ptPos(1)"), w.eval("ptPos(2)"), w.eval("ptPos(26)"), w.eval("ptPos(57)"), w.eval("ptPos(118)")]));

/* ============================================================
   [2] Шаг 1: панель под названием теста + вставка + таблица
   ============================================================ */
console.log("\n[2] Шаг 1: панель формул у #ctName");
w.selectRole("teacher");
w.navigate("createTest");

const ctName = w.document.getElementById("ctName");
const bar1 = w.document.querySelector('.formula-bar[data-target="ctName"]');
T("панель формул есть под названием теста", !!bar1);
T("на панели ≥ 31 кнопки (+ 🧪)", bar1.querySelectorAll(".fb-btn").length >= 31,
  bar1.querySelectorAll(".fb-btn").length);

// вставка в позицию курсора: «Тест» + ГОТОВАЯ формула $x^2$
ctName.value = "Тест";
ctName.setSelectionRange(4, 4);
[...bar1.querySelectorAll("[data-snippet]")].find(b => b.dataset.snippet === "$x^2$").click();
T("кнопка x² вставила $x^2$ (в $...$) в позицию курсора", ctName.value === "Тест$x^2$", ctName.value);

[...bar1.querySelectorAll("[data-snippet]")].find(b => b.dataset.snippet === "$\\frac{}{}$").click();
T("кнопка a/b вставила $\\frac{}{}$", ctName.value.includes("$\\frac{}{}$"), ctName.value);
T("курсор встал внутрь первой пары {}",
  ctName.selectionStart === ctName.value.indexOf("{}") + 1,
  ctName.selectionStart + " vs " + (ctName.value.indexOf("{}") + 1));

// химия: H₂O → $\ce{}$
[...bar1.querySelectorAll("[data-snippet]")].find(b => b.dataset.snippet === "$\\ce{}$").click();
T("кнопка H₂O вставила $\\ce{}$ (mhchem)", ctName.value.includes("$\\ce{}$"), ctName.value);

// КАЖДЫЙ шаблон обязан быть целиком в $...$ — иначе KaTeX не распознает математику
// и на экранах остаётся сырой \infty / \sum / \leq (жалоба пользователя)
T("все 31 шаблон обёрнуты в $...$",
  w.eval("FORMULA_SNIPPETS.length") === 31
  && w.eval("FORMULA_SNIPPETS.every(s => s.s.startsWith('$') && s.s.endsWith('$') && s.s.length > 2)"),
  w.eval("FORMULA_SNIPPETS.filter(s => !(s.s.startsWith('$') && s.s.endsWith('$'))).map(s => s.l).join(',')"));

// подряд идущие вставки склеиваются в корректную строку для KaTeX
ctName.value = "";
ctName.setSelectionRange(0, 0);
const infBtn = [...bar1.querySelectorAll("[data-snippet]")].find(b => b.dataset.snippet === "$\\infty$");
infBtn.click();
infBtn.click();
T("две подряд вставки ∞ дают $\\infty$$\\infty$ (без разрывов)",
  ctName.value === "$\\infty$$\\infty$", ctName.value);

/* ============================================================
   [3] Таблица Менделеева: открытие, поиск, вставка, закрытие
   ============================================================ */
console.log("\n[3] Таблица Менделеева");
bar1.querySelector(".fb-pt").click();
const overlay = w.document.getElementById("ptOverlay");
T("модалка открыта", overlay && !overlay.classList.contains("hidden"));
const cells = overlay.querySelectorAll(".pt-el");
T("118 ячеек", cells.length === 118, cells.length);
const feCell = overlay.querySelector('.pt-el[data-sym="Fe"]');
T("ячейка Fe: позиция (колонка 8, ряд 4) и номер 26",
  feCell.style.gridColumn === "8" && feCell.style.gridRow === "4"
  && feCell.querySelector(".pt-num").textContent === "26",
  feCell.style.gridColumn + "/" + feCell.style.gridRow + "/" + feCell.querySelector(".pt-num").textContent);
T("заголовок окна — «Периодическая таблица элементов»",
  overlay.querySelector(".pt-title").textContent.includes("Периодическая таблица элементов"));

// поиск
const search = w.document.getElementById("ptSearch");
search.value = "Fe";
search.dispatchEvent(new w.Event("input", { bubbles: true }));
T("поиск «Fe»: Fe видим, H скрыт",
  feCell.style.visibility === "visible" && overlay.querySelector('.pt-el[data-sym="H"]').style.visibility === "hidden");
search.value = "железо";
search.dispatchEvent(new w.Event("input", { bubbles: true }));
T("поиск «железо» находит Fe", feCell.style.visibility === "visible");
search.value = "26";
search.dispatchEvent(new w.Event("input", { bubbles: true }));
T("поиск по номеру «26» находит Fe", feCell.style.visibility === "visible");
search.value = "";
search.dispatchEvent(new w.Event("input", { bubbles: true }));
T("сброс поиска: все ячейки видимы",
  [...cells].every(c => c.style.visibility === "visible"));

// клик по элементу → символ в поле
feCell.click();
T("клик по Fe вставил «Fe» в поле (на место курсора)", ctName.value.includes("Fe"), ctName.value);
T("модалка осталась открытой для следующих элементов",
  !overlay.classList.contains("hidden"));

// Esc закрывает
w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
T("Esc закрывает модалку", overlay.classList.contains("hidden"));
bar1.querySelector(".fb-pt").click();
T("снова открывается", !overlay.classList.contains("hidden"));
w.document.getElementById("ptClose").click();
T("крестик закрывает", overlay.classList.contains("hidden"));

/* ============================================================
   [4] Конструктор вопросов: панели у #qText и у вариантов
   ============================================================ */
console.log("\n[4] Конструктор: панели qText/варианты");
ctName.value = "Тест с формулами";
w.document.getElementById("ctForm").value = "both";
w.document.querySelector('#ctGroups input[name="ctGroup"]').checked = true;
w.document.getElementById("ctQuestions").value = "2";
w.document.getElementById("ctTime").value = "10";
w.document.getElementById("createTestForm")
  .dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));

const qText = w.document.getElementById("qText");
const barQ = w.document.querySelector('.formula-bar[data-target="qText"]');
const barO = w.document.querySelector('.formula-bar[data-target="options"]');
T("панель под текстом вопроса", !!barQ && barQ.querySelectorAll(".fb-btn").length >= 31);
T("панель под вариантами ответов", !!barO && barO.querySelectorAll(".fb-btn").length >= 31);

// текст вопроса с формулой: ∫
qText.focus();
[...barQ.querySelectorAll("[data-snippet]")].find(b => b.dataset.snippet.startsWith("$\\int")).click();
T("кнопка ∫ вставила $\\int...$ в qText", qText.value.startsWith("$\\int"), qText.value);

// варианты: фокус на qOpt2 → вставка идёт в него
const qOpt2 = w.document.getElementById("qOpt2");
qOpt2.focus();
[...barO.querySelectorAll("[data-snippet]")].find(b => b.dataset.snippet === "$x_{}$").click();
T("кнопка xₙ вставила $x_{}$ в активный вариант (qOpt2), курсор внутри {}",
  qOpt2.value === "$x_{}$" && qOpt2.selectionStart === qOpt2.value.indexOf("{}") + 1,
  qOpt2.value + " caret=" + qOpt2.selectionStart);
T("другие варианты не тронуты",
  w.document.getElementById("qOpt0").value === "" && w.document.getElementById("qOpt1").value === "");

// 🧪 в конструкторе → вставка элемента в активный вариант
barO.querySelector(".fb-pt").click();
w.document.querySelector('#ptOverlay .pt-el[data-sym="H"]').click();
T("из таблицы символ H вставлен в активный вариант (в позицию курсора — внутрь {})",
  qOpt2.value === "$x_{H}$", qOpt2.value);
w.document.getElementById("ptClose").click();

// регресс: вопрос с формулой добавляется как обычно
qText.value = "Чему равен $\\int_0^1 x dx$?";
[0, 1, 2, 3].forEach(i => { w.document.getElementById("qOpt" + i).value = "v" + i; });
w.document.getElementById("qCorr0").checked = true;
w.document.getElementById("qbAdd").click();
T("вопрос с формулой добавлен (регресс конструктора)",
  w.eval("currentTestDraft.questions.length") === 1);
T("в предпросмотре остался текст формулы (KaTeX в jsdom не грузится)",
  w.document.getElementById("qList").textContent.includes("\\int_0^1"));

/* ============================================================
   [5] Переводы новых ключей
   ============================================================ */
console.log("\n[5] Переводы ru/uz/en");
const keys = ["fbChem", "fbBar", "ptTitle", "ptSearch", "ptHint"];
const missing = [];
for (const lang of ["ru", "uz", "en"]) {
  for (const k of keys) {
    const v = w.eval(`translations.${lang}.${k}`);
    if (typeof v !== "string" || !v.trim()) missing.push(`${lang}.${k}`);
  }
}
T("все новые ключи есть во всех языках", missing.length === 0, safeJson(missing));
T("formulaHint: упоминает панель и химию $\ce{H2O}$ (ru/uz/en)",
  ["ru", "uz", "en"].every(l => w.eval(`translations.${l}.formulaHint`).includes("\\ce{H2O}")),
  w.eval("translations.ru.formulaHint"));
T("ru: ptTitle = «Периодическая таблица элементов»",
  w.eval("translations.ru.ptTitle") === "Периодическая таблица элементов");

/* ============================================================
   [6] Смена языка: окно таблицы перерисовывается
   ============================================================ */
console.log("\n[6] Локализация модалки");
w.document.querySelector('.lang-btn[data-lang="en"]').click();
// открыть форму заново (после смены языка) и проверить заголовок EN
w.navigate("dashboard");
w.navigate("createTest");
w.document.querySelector('.formula-bar[data-target="ctName"] .fb-pt').click();
T("EN: заголовок модалки «Periodic table of elements»",
  w.document.querySelector("#ptOverlay .pt-title").textContent.includes("Periodic table of elements"),
  w.document.querySelector("#ptOverlay .pt-title").textContent);
T("EN: ячейки — английские названия (H → Hydrogen)",
  w.document.querySelector('#ptOverlay .pt-el[data-sym="H"]').title.includes("Hydrogen"));
T("EN: H2 поиску соответствует Hydrogen",
  (() => {
    const s = w.document.getElementById("ptSearch");
    s.value = "hydrogen";
    s.dispatchEvent(new w.Event("input", { bubbles: true }));
    return w.document.querySelector('#ptOverlay .pt-el[data-sym="H"]').style.visibility === "visible";
  })());
w.document.getElementById("ptClose").click();
w.document.querySelector('.lang-btn[data-lang="ru"]').click();

/* ============================================================
   [7] Формулы в разделе «Результаты студентов»
   ============================================================ */
console.log("\n[7] renderMath в результатах");
let mathCalls = 0;
w.renderMathInElement = () => { mathCalls++; return true; };   // шпион вместо KaTeX
w.navigate("results");
T("renderMath вызван при открытии «Результатов студентов»", mathCalls >= 1, mathCalls);
const trFilter = w.document.getElementById("trTestFilter");
T("фильтр по тестам есть", !!trFilter, !!trFilter);
if (trFilter) {
  // change ВСЕГДА перерисовывает #trResultsBox → renderMath должен вызваться повторно
  trFilter.dispatchEvent(new w.Event("change", { bubbles: true }));
}
T("renderMath вызван и после фильтрации (перерисовка таблицы)", mathCalls >= 2, mathCalls);
w.renderMathInElement = undefined;   // вернуть guard «CDN не загружен → no-op»

/* ============================================================
   ИТОГ
   ============================================================ */
console.log(`\n=== ИТОГ: пройдено ${pass}, провалено ${fail} ===`);
process.exit(fail ? 1 : 0);
