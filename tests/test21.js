/* Тест схем к вопросам (SVG-генератор + модалка + сохранение в вопросе).
   Запуск: node test21.js */
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
const w = dom.window;
const D = w.document;
if (D.readyState === "loading") w.initApp();

/* [1] SVG-генератор */
console.log("\n[1] SVG-генератор");
const v = w.buildDiagram("vector", { x1: 1, y1: 2, x2: 4, y2: 6 });
T("вектор: SVG + подпись", v.svg && v.svg.includes("<svg") && v.svg.includes("dg-shape")
  && v.caption.includes("A(1; 2)"), safeJson(v).slice(0, 160));
const c = w.buildDiagram("circle", { cx: 0, cy: 0, r: 3 });
T("круг: SVG, r = 3, площадь", c.svg && c.svg.includes("<circle") && c.caption.includes("r = 3")
  && c.caption.includes("S = πr²"), c.caption);
const tr = w.buildDiagram("triangle", { base: 6, height: 4 });
T("треугольник: площадь 12", tr.svg && tr.caption.includes("S = ½·b·h = 12.00"), tr.caption);
const rc = w.buildDiagram("rectangle", { w: 5, h: 3 });
T("прямоугольник: площадь 15", rc.svg && rc.caption.includes("S = a·b = 15.00"), rc.caption);
const pl = w.buildDiagram("plane", { min: -5, max: 5 });
T("координатная плоскость: сетка + оси", pl.svg && pl.svg.includes("dg-grid") && pl.svg.includes("dg-axis"));
const fn = w.buildDiagram("function", { expr: "x^2", xmin: -2, xmax: 2 });
T("график функции x²: path", fn.svg && fn.svg.includes("<path") && fn.caption.includes("x^2"), safeJson(fn).slice(0, 120));
const bad = w.buildDiagram("function", { expr: "sin(", xmin: -2, xmax: 2 });
T("битое выражение → error", !!bad.error, safeJson(bad));
const fig = w.renderQuestionDiagram({ diagram: { type: "svg", svg: v.svg, caption: "Вектор" } });
T("renderQuestionDiagram → figure.q-diagram", fig.includes("class=\"q-diagram\"") && fig.includes("Вектор"));
const vh = w.buildVectorDiagram({ x1: 0, y1: 0, x2: 3, y2: 4, interactive: true });
T("у вектора есть drag-хэндлы A/B",
  vh.svg.includes('data-dg-handle="a"') && vh.svg.includes('data-dg-handle="b"'));

/* [2] Модалка + сохранение в вопросе */
console.log("\n[2] Модалка и сохранение");
w.selectRole("teacher");
w.navigate("createTest");
D.getElementById("ctName").value = "Схемы";
D.getElementById("ctForm").value = "both";
D.querySelector('#ctGroups input[name="ctGroup"]').checked = true;
D.getElementById("ctQuestions").value = "2";
D.getElementById("ctTime").value = "10";
D.getElementById("createTestForm").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));

T("в конструкторе есть кнопка 📐", !!D.getElementById("diagramFab"));
D.getElementById("diagramFab").click();
T("модалка схем открылась", !!D.getElementById("diagramOverlay")
  && !D.getElementById("diagramOverlay").classList.contains("hidden"));
T("preview по умолчанию — вектор", D.getElementById("dgPreview").innerHTML.includes("<svg"));
const type = D.getElementById("dgType");
type.value = "circle";
type.dispatchEvent(new w.Event("change", { bubbles: true }));
T("переключение на круг обновило preview", D.getElementById("dgPreview").innerHTML.includes("<circle"));
D.getElementById("dgCaption").value = "r = 3";
D.getElementById("dgCaption").dispatchEvent(new w.Event("input", { bubbles: true }));
D.getElementById("dgInsert").click();
T("схема вставлена в форму", !!D.querySelector("#qDiagramPreview .q-diagram")
  && D.getElementById("qDiagramPreview").innerHTML.includes("r = 3"));

D.getElementById("qText").value = "Найдите площадь круга радиусом 3";
["v0", "v1", "v2", "v3"].forEach((v, i) => { D.getElementById("qOpt" + i).value = v; });
D.getElementById("qCorr0").checked = true;
D.getElementById("qbAdd").click();
T("вопрос добавлен со схемой", w.eval("currentTestDraft.questions.length") === 1);
T("diagram сохранён в объекте вопроса",
  !!w.eval("currentTestDraft.questions[0].diagram")
  && w.eval("currentTestDraft.questions[0].diagram.type") === "svg"
  && w.eval("currentTestDraft.questions[0].diagram.caption") === "r = 3");
T("схема видна в списке добавленных вопросов", !!D.querySelector("#qList .q-diagram"));
T("после добавления форма схемы очищена",
  D.getElementById("qDiagramPreview").classList.contains("hidden"));
const reviewHtml = w.eval("activeTest = { questions: currentTestDraft.questions }; userAnswers = [0]; renderReview()");
T("схема рендерится в разборе результатов", reviewHtml.includes("q-diagram") && reviewHtml.includes("r = 3"));

// Редактирование/замена схемы у уже добавленного вопроса
D.querySelector('.q-diagram-edit').click();
T("модалка редактирования открылась", D.getElementById('dgTitle').textContent.includes("Редактировать"));
D.getElementById('dgR').value = '4';
D.getElementById('dgR').dispatchEvent(new w.Event('input', { bubbles: true }));
D.getElementById('dgCaption').value = 'r = 4';
D.getElementById('dgCaption').dispatchEvent(new w.Event('input', { bubbles: true }));
D.getElementById('dgInsert').click();
T("схема заменена: r = 4", w.eval("currentTestDraft.questions[0].diagram.caption") === "r = 4");
T("после замены схема осталась в списке", !!D.querySelector("#qList .q-diagram"));

// Удаление схемы
D.querySelector('.q-diagram-edit').click();
D.getElementById('dgDelete').click();
T("схема удалена из вопроса", w.eval("currentTestDraft.questions[0].diagram") === null);
T("из списка схема исчезла", !D.querySelector("#qList .q-diagram"));

// Локализация модалки
w.changeLanguage('en');
w.openDiagramModal();
T("EN: модалка схем переведена", D.getElementById('dgTitle').textContent.includes("Diagram"));
D.getElementById('dgCancel').click();
w.changeLanguage('ru');

console.log("\n[3] Консоль");
T("console.error пуст", logs.error.length === 0, safeJson(logs.error));

console.log(`\n=== ИТОГ: пройдено ${pass}, провалено ${fail} ===`);
process.exit(fail ? 1 : 0);
