/* Тест математической клавиатуры (Math Pad) в конструкторе тестов.
   Запуск: node test19.js   (jsdom установлен в этой же папке) */
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
const focusEvt = el => el.dispatchEvent(new w.Event("focus"));

/* ============================================================
   [1] Статика: CSS, функции, переводы, наличие клавиатуры
   ============================================================ */
console.log("\n[1] Статика");
T("CSS .math-pad существует", html.includes(".math-pad {"));
T("CSS: сетка repeat(12, 1fr) + gap 4px", html.includes("grid-template-columns: repeat(12, 1fr)") && html.includes("gap: 4px"));
T("CSS: hover — акцентное подчёркивание #6366f1", html.includes("inset 0 -2px 0 var(--accent)"));
T("CSS: матсимволы курсивом (.mp-btn--fn)", html.includes(".mp-btn--fn { font-style: italic; }"));
T("CSS: режим abc сворачивает панель", html.includes(".mp-collapsed .mp-body { display: none; }"));
T("CSS: тёмная тема кнопок", html.includes('[data-theme="dark"] .mp-btn'));
T("функции объявлены", ["insertMathSymbol", "mpCommand", "mathPadHTML", "bindMathPad", "mpSetActiveField"]
  .every(fn => typeof w[fn] === "function"));

const uz = w.eval("translations.uz"), en = w.eval("translations.en"), ru = w.eval("translations.ru");
T("переводы mp* во всех трёх языках",
  [ru, uz, en].every(d => ["mpTitle", "mpVars", "mpFuncs", "mpPowers", "mpAbc"]
    .every(k => typeof d[k] === "string" && d[k].length > 0)));

w.selectRole("teacher");
w.navigate("createTest");
D.getElementById("ctName").value = "Мат-клавиатура";
D.getElementById("ctForm").value = "both";
D.querySelector('#ctGroups input[name="ctGroup"]').checked = true;
D.getElementById("ctQuestions").value = "2";
D.getElementById("ctTime").value = "10";
D.getElementById("createTestForm").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));

const pad = D.getElementById("mathPad");
T("блок #mathPad есть в конструкторе", !!pad);
T("3 таба: y / f(x) / x²", D.querySelectorAll(".mp-tab").length === 3
  && !!D.querySelector('[data-mp-tab="vars"]') && !!D.querySelector('[data-mp-tab="funcs"]') && !!D.querySelector('[data-mp-tab="powers"]'));
T("3 группы кнопок + управляющий ряд", D.querySelectorAll(".mp-keys[data-mp-group]").length === 3
  && !!D.querySelector(".mp-ctrl"));
T("клавиши: >50 кнопок, все <button type=button>", pad.querySelectorAll(".mp-btn").length > 50
  && [...pad.querySelectorAll(".mp-btn")].every(b => b.getAttribute("type") === "button"));
T("управляющие кнопки abc ← → ⌫ ↵", ["abc", "left", "right", "backspace", "enter"]
  .every(c => !!pad.querySelector(`[data-mp-cmd="${c}"]`)));
const mpPv = D.getElementById("mathPreview");
T("#mathPreview внутри клавиатуры, изначально скрыт", !!mpPv && mpPv.classList.contains("math-preview--empty"));
T("изначально активна вкладка «Числа и переменные»",
  D.querySelector(".mp-tab--active").dataset.mpTab === "vars"
  && D.querySelector('[data-mp-group="vars"]').style.display === "grid");

/* ============================================================
   [2] Вставка: цифры, операции, дробь с #@/#? (самопроверка 3)
   ============================================================ */
console.log("\n[2] Вставка цифр и дроби");
let mathCalls = [];   // {id} — куда звался renderMath
w.renderMathInElement = (el, opts) => { mathCalls.push({ id: el.id || ("." + el.className), throwOnError: opts && opts.throwOnError }); };
let katexCalls = [];
w.katex = { render: (src, el, opts) => { katexCalls.push({ src }); el.innerHTML = '<span class="fake-math">OK</span>'; } };

const qText = D.getElementById("qText");
const mpBtn = code => [...pad.querySelectorAll(".mp-btn")].find(b => b.dataset.mp === code);
mpBtn("1").click(); mpBtn("+").click(); mpBtn("x").click();
T("цифры/операции вставляются как текст", qText.value === "1+x", qText.value);

mpBtn("$\\frac{#@}{#?}$").click();
T("дробь: значение 1+x$\\frac{}{}$, курсор в числителе",
  qText.value === "1+x$\\frac{}{}$" && qText.selectionStart === 10, qText.value + " caret=" + qText.selectionStart);
mpBtn("3").click();
T("«3» попала в числитель", qText.value === "1+x$\\frac{3}{}$", qText.value);
w.mpCommand("right"); w.mpCommand("right");
mpBtn("4").click();
T("после двух → «4» попала в знаменатель → $\\frac{3}{4}$",
  qText.value === "1+x$\\frac{3}{4}$", qText.value);
T("предпросмотры обновились (клавиатуры и поля)",
  mathCalls.some(c => c.id === "mathPreview") && mathCalls.some(c => c.id === "preview-qText"),
  safeJson(mathCalls.map(c => c.id)));
T("throwOnError:false дошёл до KaTeX", mathCalls.some(c => c.throwOnError === false));

/* ============================================================
   [3] Сложные коды: матрица с маркерами и \\
   ============================================================ */
console.log("\n[3] Матрица");
input(qText, "");
mpBtn([...pad.querySelectorAll(".mp-btn")].find(b => b.dataset.mp.indexOf("begin{pmatrix}") !== -1).dataset.mp).click();
T("матрица вставлена без маркеров #",
  qText.value === "$\\begin{pmatrix}  &  \\\\  &  \\end{pmatrix}$", qText.value);
T("курсор — в первом «кармане» матрицы",
  qText.selectionStart === qText.value.indexOf("$\\begin{pmatrix} ") + "$\\begin{pmatrix} ".length, qText.selectionStart);

/* ============================================================
   [4] Степень внутри существующей формулы (без двойной обёртки)
   ============================================================ */
console.log("\n[4] Вставка внутрь формулы");
input(qText, "$\\frac{}{}$");
qText.setSelectionRange(7, 7);   // внутрь первых пустых скобок
mpBtn("x²").click();
T("x² внутри скобок дроби → $\\frac{x²}{}$ (без $-наслаивания)",
  qText.value === "$\\frac{x²}{}$", qText.value);

/* ============================================================
   [5] Команды: ← → ⌫ ↵ abc ƒx
   ============================================================ */
console.log("\n[5] Управляющие команды");
input(qText, "abc");
qText.setSelectionRange(3, 3);
w.mpCommand("backspace");
T("⌫ удаляет символ слева", qText.value === "ab", qText.value);
w.mpCommand("left");
T("← возвращает курсор", qText.selectionStart === 1, qText.selectionStart);
w.mpCommand("right");
T("→ двигает курсор вправо", qText.selectionStart === 2, qText.selectionStart);
w.mpCommand("enter");
T("↵ в textarea вставляет перевод строки", qText.value === "ab\n", JSON.stringify(qText.value));
w.mpCommand("abc");
T("abc сворачивает клавиатуру", pad.classList.contains("mp-collapsed"));
D.getElementById("mpToggle").click();
T("ƒx разворачивает обратно", !pad.classList.contains("mp-collapsed"));

/* ============================================================
   [6] Наведение: клавиатура следует за фокусом на варианты ответов
   ============================================================ */
console.log("\n[6] Варианты ответов");
input(qText, "");
const qOpt2 = D.getElementById("qOpt2");
focusEvt(qOpt2);
mpBtn("5").click();
T("после фокуса на вариант клавиатура пишет в него", qOpt2.value === "5" && qText.value === "",
  "opt=" + qOpt2.value + " qText=" + qText.value);
T("#mathPreview показывает активное поле", !mpPv.classList.contains("math-preview--empty"));

/* ============================================================
   [7] Табы
   ============================================================ */
console.log("\n[7] Табы");
D.querySelector('[data-mp-tab="funcs"]').click();
T("таб f(x): открыта группа funcs, остальные скрыты",
  D.querySelector('[data-mp-group="funcs"]').style.display === "grid"
  && D.querySelector('[data-mp-group="vars"]').style.display === "none"
  && D.querySelector('[data-mp-group="powers"]').style.display === "none");
T("активный таб переключился", D.querySelector(".mp-tab--active").dataset.mpTab === "funcs");
T("кнопки funcs на месте (∫, ∑, ∞, π — Unicode, без $-обёрток)",
  ["∫", "∑", "∞", "π"].every(c => !!mpBtn(c)));

/* ============================================================
   [8] Смешение русского текста и формулы (самопроверка 4)
   ============================================================ */
console.log("\n[8] Текст + формула");
D.querySelector('[data-mp-tab="vars"]').click();
focusEvt(qText);   // в браузере input всегда идёт после focus — возвращаем цель клавиатуры
input(qText, "Найдите значение ");
mpBtn("$\\frac{#@}{#?}$").click();
mpBtn("2").click();
T("текст и формула смешиваются: «Найдите значение $\\frac{2}{}$»",
  qText.value.indexOf("Найдите значение $\\frac{2}{}$") === 0, qText.value);
T("нет битой двойной обёртки $$", qText.value.indexOf("$$") === -1, qText.value);

/* ============================================================
   [9] Ошибки: «mathfield is not defined» невозможна
   ============================================================ */
console.log("\n[9] Чистота консоли");
const allLogs = w.__logs.log.concat(w.__logs.error).join("\n");
T("нет упоминаний «mathfield is not defined»", allLogs.indexOf("mathfield is not defined") === -1);
T("console.error за весь прогон пуст", w.__logs.error.length === 0, safeJson(w.__logs.error));

/* ============================================================
   ИТОГ
   ============================================================ */
console.log(`\n=== ИТОГ: пройдено ${pass}, провалено ${fail} ===`);
process.exit(fail ? 1 : 0);
