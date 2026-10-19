/* Тест живого предпросмотра формул (Live Preview) в конструкторе тестов
   + проверка рендера вопроса/вариантов на экране студента (спека ЗАДАЧА-ФИКС).
   Запуск: node test18.js   (jsdom установлен в этой же папке) */
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

function makeWindow() {
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
    }
  });
  dom.window.__logs = logs;
  dom.window.__alerts = alerts;
  if (dom.window.document.readyState === "loading") dom.window.initApp();
  return dom.window;
}

const w = makeWindow();
const D = w.document;
const input = (el, v) => { el.value = v; el.dispatchEvent(new w.Event("input", { bubbles: true })); };

/* ============================================================
   [1] Статика: CSS, функции, наличие блоков предпросмотра
   ============================================================ */
console.log("\n[1] Статика");
T("CSS .math-preview: min-height 40px", html.includes(".math-preview") && html.includes("min-height: 40px"));
T("CSS: padding 10px + border-radius 8px + font-size 1.1rem + color var(--text)",
  html.includes("padding: 10px") && html.includes("border-radius: 8px")
  && html.includes("font-size: 1.1rem") && html.includes("color: var(--text)"));
T("CSS: скрытие пустого предпросмотра (.math-preview--empty)", html.includes(".math-preview--empty { display: none; }"));
T("CSS: тёмная тема для предпросмотра", html.includes('[data-theme="dark"] .math-preview'));
T("функции updateMathPreview/syncMathPreview/bindMathPreviews объявлены",
  ["updateMathPreview", "syncMathPreview", "bindMathPreviews"].every(fn => typeof w[fn] === "function"));

w.selectRole("teacher");
w.navigate("createTest");
const pvCt = D.getElementById("preview-ctName");
T("блок preview-ctName есть в форме шага 1 и изначально скрыт",
  !!pvCt && pvCt.classList.contains("math-preview--empty"));

// шаг 2: конструктор
D.getElementById("ctName").value = "Проверка предпросмотра";
D.getElementById("ctForm").value = "both";
D.querySelector('#ctGroups input[name="ctGroup"]').checked = true;
D.getElementById("ctQuestions").value = "2";
D.getElementById("ctTime").value = "10";
D.getElementById("createTestForm").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
const pvQt = D.getElementById("preview-qText");
const pvQo = D.getElementById("preview-qOptions");
T("блок preview-qText есть в конструкторе и скрыт", !!pvQt && pvQt.classList.contains("math-preview--empty"));
T("блок preview-qOptions есть под вариантами и скрыт", !!pvQo && pvQo.classList.contains("math-preview--empty"));
T("панели формул на месте (регресс)",
  !!D.querySelector('.formula-bar[data-target="qText"]') && !!D.querySelector('.formula-bar[data-target="options"]'));

/* ============================================================
   [2] Конструктор: живой предпросмотр при вводе (шпионы KaTeX)
   ============================================================ */
console.log("\n[2] Конструктор: input-события и принудительное обновление");
let katexCalls = [];        // [{src, opts}] — что просил katex.render
let mathCalls = [];         // [{id, delimiters}] — что просил renderMath
w.katex = {
  render: (src, el, opts) => { katexCalls.push({ src, opts }); el.innerHTML = '<span class="fake-math">RENDERED</span>'; }
};
w.renderMathInElement = (el, opts) => { mathCalls.push({ id: el.id || ("." + el.className), delimiters: opts && opts.delimiters, throwOnError: opts && opts.throwOnError }); };

const qText = D.getElementById("qText");
const qOpt1 = D.getElementById("qOpt1");

// 1) значение с $$...$$ → общий путь renderMath с делimiters $$ и $
input(qText, "$$\\int_0^1 x dx$$");
const qCalls1 = mathCalls.filter(c => c.id === "preview-qText");
T("$$...$$ в тексте вопроса → renderMath(preview-qText)", qCalls1.length === 1, qCalls1.length);
const dl = qCalls1[0] && qCalls1[0].delimiters;
T("делimiters включают $$ (display) и $ (inline)",
  safeJson(dl || []).includes('"$$"') && safeJson(dl || []).includes('"$"'), safeJson(dl));
T("renderMath передаёт throwOnError:false (битая формула не валит рендер остальных)",
  qCalls1[0] && qCalls1[0].throwOnError === false, safeJson(qCalls1[0]));
T("блок предпросмотра виден и содержит исходник", !pvQt.classList.contains("math-preview--empty")
  && pvQt.textContent.includes("\\int_0^1"), pvQt.textContent);

// 2) голый LaTeX без $ → katex.render, displayMode, throwOnError:false (п. 1.3 спеки)
input(qText, "\\frac{a}{b}");
const k1 = katexCalls[katexCalls.length - 1];
T("голый \\frac{a}{b} → katex.render(..., displayMode:true, throwOnError:false)",
  k1 && k1.src === "\\frac{a}{b}" && k1.opts.displayMode === true && k1.opts.throwOnError === false,
  safeJson(k1));

// 3) обычный текст → просто текст, без обращений к KaTeX
const kBefore = katexCalls.length, mBefore = mathCalls.length;
input(qText, "Обычный текст без формул");
T("обычный текст → textContent, KaTeX не вызывался",
  pvQt.textContent === "Обычный текст без формул"
  && katexCalls.length === kBefore && mathCalls.length === mBefore,
  pvQt.textContent);

// 4) пустое поле → блок очищен и скрыт
input(qText, "");
T("пустое поле → предпросмотр очищен и скрыт",
  pvQt.innerHTML === "" && pvQt.classList.contains("math-preview--empty"));

// 5) кнопка панели принудительно обновляет предпросмотр (п. 2 спеки)
const mBefore2 = mathCalls.length;
const intBtn = [...D.querySelectorAll('.formula-bar[data-target="qText"] [data-snippet]')]
  .find(b => b.dataset.snippet.startsWith("$\\int"));
intBtn.click();
T("вставка ∫ кнопкой БЕЗ события input обновила предпросмотр",
  qText.value.startsWith("$\\int") && mathCalls.length > mBefore2,
  qText.value + " calls=" + mathCalls.length);

// 6) варианты ответов → общий блок preview-qOptions
input(qOpt1, "\\ce{H2O}");
const k2 = katexCalls[katexCalls.length - 1];
T("\\ce{H2O} в варианте → katex.render (п. 3 спеки: H₂O)",
  k2 && k2.src === "\\ce{H2O}" && k2.opts.displayMode === true, safeJson(k2));
T("preview-qOptions показан", !pvQo.classList.contains("math-preview--empty"));
input(qOpt1, "");
T("вариант очищен → preview-qOptions скрыт", pvQo.classList.contains("math-preview--empty"));
input(D.getElementById("qOpt0"), "$$x^2$$");
T("$$x^2$$ в варианте → renderMath(preview-qOptions)",
  mathCalls.some(c => c.id === "preview-qOptions"), safeJson(mathCalls.map(c => c.id)));
input(D.getElementById("qOpt0"), "");

/* ============================================================
   [3] Шаг 1: предпросмотр под названием теста
   ============================================================ */
console.log("\n[3] Шаг 1: preview-ctName");
w.navigate("createTest");
const ctName = D.getElementById("preview-ctName") ? D.getElementById("ctName") : null;
T("поля и блока нет → дальше не проверяем", !!ctName);

input(ctName, "$$x^2$$");
T("$$x^2$$ в названии → renderMath(preview-ctName) (самопроверка спеки 2)",
  mathCalls.some(c => c.id === "preview-ctName"), safeJson(mathCalls.map(c => c.id)));
T("блок виден", !D.getElementById("preview-ctName").classList.contains("math-preview--empty"));

input(ctName, "\\ce{H2O}");
const k3 = katexCalls[katexCalls.length - 1];
T("голое \\ce{H2O} в названии → katex.render (самопроверка спеки 3)",
  k3 && k3.src === "\\ce{H2O}", safeJson(k3));

input(ctName, "");
T("очистка → блок скрыт", D.getElementById("preview-ctName").classList.contains("math-preview--empty"));

const mBefore3 = mathCalls.length;
const x2Btn = [...D.querySelectorAll('.formula-bar[data-target="ctName"] [data-snippet]')]
  .find(b => b.dataset.snippet === "$x^2$");
x2Btn.click();
T("кнопка x² обновила предпросмотра мгновенно (без input)",
  ctName.value === "$x^2$" && mathCalls.length > mBefore3, ctName.value);

// таблица Менделеева тоже обновляет предпросмотр
const mBefore4 = mathCalls.length;
D.querySelector('.formula-bar[data-target="ctName"] .fb-pt').click();
D.querySelector('#ptOverlay .pt-el[data-sym="H"]').click();
T("вставка элемента из таблицы обновила предпросмотр",
  ctName.value.includes("H") && mathCalls.length > mBefore4, ctName.value);
D.getElementById("ptClose").click();

/* ============================================================
   [4] Экран студента: вопрос и варианты внутри зоны renderMath (п. 4 спеки)
   ============================================================ */
console.log("\n[4] Экран студента");
w.selectRole("student");
w.navigate("availableTests");
const startBtn = D.querySelector(".btn-start");
T("кнопка «Начать» у демо-теста есть", !!startBtn);
if (startBtn) startBtn.click();
const testCalls = mathCalls.filter(c => c.id === "testScreen");
T("renderMath вызван для #testScreen (текст вопроса + варианты)",
  testCalls.length >= 1, safeJson(mathCalls.map(c => c.id)));
T("его делimiters содержат $$ и $",
  testCalls.length >= 1 && safeJson(testCalls[0].delimiters || []).includes('"$$"')
  && safeJson(testCalls[0].delimiters || []).includes('"$"'), safeJson(testCalls[0] && testCalls[0].delimiters));
const screen = D.getElementById("testScreen");
T("#testOptions (варианты) находится внутри #testScreen",
  !!screen && !!screen.querySelector("#testOptions .test-option"));
T("текст вопроса отрисован на экране", screen && screen.textContent.trim().length > 0);

/* ============================================================
   [5] Офлайн-guard: KaTeX не загрузился → ничего не падает
   ============================================================ */
console.log("\n[5] Офлайн-guard");
w.katex = undefined;
w.renderMathInElement = undefined;
w.selectRole("teacher");
w.navigate("createTest");
const ct2 = D.getElementById("ctName");
input(ct2, "\\ce{H2O}");
T("без katex: значение показано как текст, без ошибок",
  D.getElementById("preview-ctName").textContent === "\\ce{H2O}");
input(ct2, "$x^2$");
T("без renderMathInElement: показан исходный $x^2$, без ошибок",
  D.getElementById("preview-ctName").textContent === "$x^2$",
  D.getElementById("preview-ctName").textContent);

/* ============================================================
   [6] Вставка внутрь существующей формулы (фикс двойного клика:
   раньше получался битой исходник $\frac{$\frac{}{}$}{}$ → сырые символы)
   ============================================================ */
console.log("\n[6] Вставка внутрь математики (без вложенных $)");
const ct3 = D.getElementById("ctName");
const findBtn = snip => [...D.querySelectorAll('.formula-bar[data-target="ctName"] [data-snippet]')]
  .find(b => b.dataset.snippet === snip);
const fracBtn3 = findBtn("$\\frac{}{}$");
const x2Btn3 = findBtn("$x^2$");
T("кнопки a/b и x² на панели найдены", !!fracBtn3 && !!x2Btn3);

// а) курсор ВНЕ формулы → полный $...$ (регресс прежнего поведения)
input(ct3, "");
ct3.setSelectionRange(0, 0);
fracBtn3.click();
T("вне формулы: вставка полной обёртки $\\frac{}{}$", ct3.value === "$\\frac{}{}$", ct3.value);

// б) повторный клик (курсор уже внутри {} → внутри $...$) → чистая вложенность
fracBtn3.click();
T("двойной клик → $\\frac{\\frac{}{}}{}$: вложенный шаблон без дубля $",
  ct3.value === "$\\frac{\\frac{}{}}{}$", ct3.value);
const innerTpl = ct3.value.indexOf("\\frac{}{}");
T("курсор второго шаблона — внутри его пустых скобок",
  innerTpl !== -1 && ct3.selectionStart === innerTpl + "\\frac{".length, ct3.selectionStart);

// в) внутри $$...$$ (display-математика) — обёртка тоже не дублируется
input(ct3, "$$a$$");
ct3.setSelectionRange(3, 3);
x2Btn3.click();
T("внутри $$a|$$ → $$ax^2$$ без дубля $", ct3.value === "$$ax^2$$", ct3.value);

// г) литеральный \$ — не открытие формулы
input(ct3, "стоимость \\$5 и ");
ct3.setSelectionRange(ct3.value.length, ct3.value.length);
x2Btn3.click();
T("\\$ (литеральный знак доллара) не считается открытием $...$",
  ct3.value === "стоимость \\$5 и $x^2$", ct3.value);

T("console.error за весь прогон пуст", w.__logs.error.length === 0, safeJson(w.__logs.error));

/* ============================================================
   ИТОГ
   ============================================================ */
console.log(`\n=== ИТОГ: пройдено ${pass}, провалено ${fail} ===`);
process.exit(fail ? 1 : 0);
