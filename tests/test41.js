/* test41.js — Промт №41: аудит безопасности (XSS, роли, localStorage, SVG/картинки).
   Запуск: node tests/test41.js */
const fs = require("fs");
const path = require("path");
const { createApp, HTML_PATH } = require("./harness");

const html = fs.readFileSync(HTML_PATH, "utf8");
let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log("  ok | " + name); }
  else { fail++; console.log("  FAIL | " + name + (extra !== undefined ? "  -> " + extra : "")); }
}

const app = createApp();
const w = app.window;
const D = app.document;

console.log("\n[1] Статический аудит: escapeHtml, KaTeX, отсутствие eval");
T("escapeHtml экранирует < > & \" '", (() => {
  const out = w.escapeHtml(`<&>"'`);
  return out === "&lt;&amp;&gt;&quot;&#39;";
})(), w.escapeHtml(`<&>"'`));
T("escapeHtml(null) → пустая строка", w.escapeHtml(null) === "");
T("escapeHtml(undefined) → пустая строка", w.escapeHtml(undefined) === "");
T("renderMath передан trust:false", (() => {
  let opts = null;
  w.renderMathInElement = (el, o) => { opts = o; };
  w.renderMath(D.getElementById("sectionContent"));
  return !!(opts && opts.trust === false && opts.throwOnError === false);
})());
T("в index.html нет eval(", !/\beval\s*\(/.test(html));
T("в index.html нет new Function", !/new\s+Function\s*\(/.test(html));
T("нет javascript:-URL в атрибутах", !/(?:href|src|action)\s*=\s*["']\s*javascript:/i.test(html));

console.log("\n[2] XSS в уведомлениях и карточках");
const evil = `<img src=x onerror="window.__xss=1">`;
const notifHtml = w.notifDetailHTML({
  id: "evil", date: "2026-10-20", title: evil,
  text: evil,
  details: { author: evil, role: "student", when: evil, place: evil, source: evil, body: [evil, "ok"] }
});
T("notifDetailHTML не содержит живого <img>", !/<img/i.test(notifHtml), notifHtml.slice(0, 160));
T("notifDetailHTML экранировал title/body/source", notifHtml.includes("&lt;img") && (notifHtml.match(/&lt;img/g) || []).length >= 4);

const testCard = w.renderTestCard({
  id: `x" onmouseover="window.__xss=1`, title: "T", teacher: evil,
  questionsCount: 1, timeLimit: 1, deadline: evil
}, []);
T("renderTestCard не содержит живого <img>", !/<img/i.test(testCard));
T("renderTestCard экранировал id и teacher", testCard.includes("&lt;img") && testCard.includes("&quot;"));

const groupCard = w.renderGroupCard({ id: `g" onclick="x`, name: evil, course: 1, direction: "programming", form: "full", studentsCount: 1 });
T("renderGroupCard не содержит живого <img>", !/<img/i.test(groupCard));
T("renderGroupCard экранировал name и id", groupCard.includes("&lt;img") && groupCard.includes("&quot;"));

console.log("\n[3] XSS в вопросах: экран теста, разбор, конструктор");
w.eval(`activeTest = { id: 'sec_q', title: 'Q', questions: [
  { text: ${JSON.stringify(evil)}, options: [${JSON.stringify(evil)}, 'b', 'c', 'd'], correct: 0 }
] }; currentQuestionIndex = 0; userAnswers = [null]; renderQuestion();`);
T("renderQuestion: варианты экранированы", !D.querySelector("#testOptions img") && D.getElementById("testOptions").textContent.includes("<img"));
w.eval(`userAnswers = [0];`);
const review = w.renderReview();
T("renderReview: текст и варианты экранированы", !/<img/i.test(review) && review.includes("&lt;img"), review.slice(0, 160));

const qList = D.createElement("div");
qList.id = "qList";
D.body.appendChild(qList);
w.eval(`currentTestDraft = { questions: [{ text: ${JSON.stringify(evil)}, options: [${JSON.stringify(evil)}, 'b', 'c', 'd'], correct: 0 }], questionsCount: 1 }; renderQuestionList();`);
T("renderQuestionList: текст и варианты экранированы", !D.querySelector("#qList img") && D.getElementById("qList").textContent.includes("<img"));
w.eval(`currentTestDraft = null;`);
qList.remove();

console.log("\n[4] XSS через подмену localStorage");
w.localStorage.setItem("unitestalltests", JSON.stringify([{
  id: "evil_test", title: `T ${evil}`, teacher: evil, author: evil,
  targetCourse: 1, targetDirection: "programming", targetGroup: ["101-PR"], targetForm: ["full"],
  questionsCount: 1, timeLimit: 5,
  questions: [{ text: "Q", options: [evil, "b", "c", "d"], correct: 0 }]
}]));
w.eval(`loadTestsFromStorage(); selectRole('student'); navigate('availableTests');`);
T("подменённый тест из localStorage не выполнил img", !w.__xss && !D.querySelector("#sectionContent img"));
T("подменённый тест показан как текст", D.getElementById("sectionContent").textContent.includes("<img"));

w.localStorage.setItem("unitest_groups", JSON.stringify([{ id: "gx", name: evil, course: 1, direction: "programming", form: "full", studentsCount: 1, teacherId: "t1" }]));
w.eval(`loadGroupsFromStorage(); selectRole('teacher'); navigate('myGroups');`);
T("подменённая группа из localStorage не выполнила img", !w.__xss && !D.querySelector("#sectionContent img"));
T("подменённая группа показана как текст", D.getElementById("sectionContent").textContent.includes("<img"));

console.log("\n[5] SVG и загрузка картинок");
T("safeImageDataUrl принимает PNG", w.safeImageDataUrl("data:image/png;base64,iVBORw0KGgo=") !== "");
T("safeImageDataUrl отклоняет SVG", w.safeImageDataUrl("data:image/svg+xml;base64,PHN2Zz4=") === "");
T("safeImageDataUrl отклоняет javascript:", w.safeImageDataUrl("javascript:alert(1)") === "");
const dirtySvg = `<svg xmlns="http://www.w3.org/2000/svg" onload="window.__xss=1"><script>window.__xss=2</script><circle cx="1" cy="1" r="1"/></svg>`;
const cleanSvg = w.sanitizeSvgMarkup(dirtySvg);
T("sanitizeSvgMarkup убрал script и onload", !/script|onload/i.test(cleanSvg), cleanSvg);
const diagramHtml = w.renderQuestionDiagram({ diagram: { type: "svg", svg: dirtySvg, caption: evil } });
T("renderQuestionDiagram не пропускает script/onload", !/script|onload/i.test(diagramHtml));
T("renderQuestionDiagram экранировал caption", diagramHtml.includes("&lt;img"));

// Промт q11: javascript:-схема, замаскированная переводом строки/табом,
// обходила проверку value.indexOf('javascript:'). Браузер такие символы вырезает.
const maskedSvg = `<svg xmlns="http://www.w3.org/2000/svg"><a href="java&#10;script:window.__xss=1"><circle cx="1" cy="1" r="1"/></a><animate attributeName="href" values="java&#9;script:window.__xss=1"/><text>safe</text></svg>`;
const cleanedMasked = w.sanitizeSvgMarkup(maskedSvg);
T("sanitizeSvgMarkup убирает замаскированный javascript:-href", !/javascript:|href=|animate/i.test(cleanedMasked), cleanedMasked);
T("sanitizeSvgMarkup сохраняет содержимое безопасной схемы", /<circle/.test(cleanedMasked) && /safe/.test(cleanedMasked), cleanedMasked);
const safeRefSvg = w.sanitizeSvgMarkup(`<svg xmlns="http://www.w3.org/2000/svg"><use href="#icon"/></svg>`);
T("sanitizeSvgMarkup оставляет внутренние #-ссылки", /href="#icon"/.test(safeRefSvg), safeRefSvg);
T("renderQuestionDiagram не пропускает замаскированный javascript:", !/javascript:/i.test(w.renderQuestionDiagram({ diagram: { type: "svg", svg: maskedSvg, caption: "x" } })));
const imgDiagram = w.renderQuestionDiagram({ diagram: { type: "image", dataUrl: "data:image/svg+xml;base64,PHN2Zz4=", caption: "x" } });
T("SVG-картинка не рендерится как img", !/<img/i.test(imgDiagram));
w.eval(`currentTestDraft = { questions: [{ text: "Q", options: ["a","b","c","d"], correct: 0, diagram: { type: "svg", svg: ${JSON.stringify(dirtySvg)}, caption: "" } }], questionsCount: 1 }; diagramEditingIndex = 0; openDiagramModal(0);`);
const dgPreview = D.getElementById("dgPreview");
T("openDiagramModal санитизирует старую SVG-схему", !!dgPreview && !/script|onload/i.test(dgPreview.innerHTML), dgPreview && dgPreview.innerHTML);
T("openDiagramModal не сохраняет опасный SVG в черновик", !!w.eval("currentDiagramDraft") && !/script|onload/i.test(w.eval("currentDiagramDraft.svg")));
w.eval(`currentTestDraft = null; diagramEditingIndex = null; closeDiagramModal();`);

console.log("\n[6] Проверка ролей в действиях");
w.eval(`selectRole('teacher'); activeTest = null; document.getElementById('testScreen').classList.add('hidden'); startTest(1);`);
T("startTest заблокирован для преподавателя", D.getElementById("testScreen").classList.contains("hidden") && w.eval("activeTest") === null);

// Аудит q21: студент не должен запускать тесты, не назначенные его курсу/направлению.
T("startTest проверяет isTestMatch(test)", /function startTest\(testId\)[\s\S]{0,900}isTestMatch\(test\)/.test(html));
w.eval(`mockTests.push(
  { id: 'sec_hidden', title: 'Чужой тест', subject: 'math', teacher: 'T', questionsCount: 1, timeLimit: 5,
    targetCourse: 3, targetDirection: 'programming', targetGroup: ['301-PR'], targetForm: ['full'],
    questions: [{ text: 'Q', options: ['a','b','c','d'], correct: 0 }] },
  { id: 'sec_ok', title: 'Свой тест', subject: 'math', teacher: 'T', questionsCount: 1, timeLimit: 5,
    targetCourse: 1, targetDirection: 'programming', targetGroup: ['101-PR'], targetForm: ['full'],
    questions: [{ text: 'Q', options: ['a','b','c','d'], correct: 0 }] }
);`);
w.eval(`selectRole('student'); activeTest = null; document.getElementById('testScreen').classList.add('hidden'); startTest('sec_hidden');`);
T("startTest не запускает тест чужого курса", D.getElementById("testScreen").classList.contains("hidden") && w.eval("activeTest") === null);
w.eval(`activeTest = null; document.getElementById('testScreen').classList.add('hidden'); startTest('sec_ok');`);
T("startTest запускает назначенный студенту тест", !D.getElementById("testScreen").classList.contains("hidden") && w.eval("activeTest && activeTest.id") === "sec_ok");
w.eval(`closeTestScreen(); ['sec_hidden','sec_ok'].forEach(id => { const i = mockTests.findIndex(t => t.id === id); if (i >= 0) mockTests.splice(i, 1); });`);

w.eval(`selectRole('student'); window.__mtBefore = mockTests.length; currentTestDraft = { title: 'x', subject: 'math', course: 1, groups: ['101-PR'], questionsCount: 1, timeLimit: 5, questions: [], access: 'all', form: 'full' }; saveTestToDB();`);
T("saveTestToDB заблокирован для студента", w.eval("mockTests.length") === w.eval("window.__mtBefore") && w.eval("currentTestDraft") !== null);
w.eval(`currentTestDraft = null;`);

w.eval(`selectRole('teacher');`);
const beforeDelete = w.eval("mockTests.length");
w.eval(`deleteTeacherTest(mockTests[0].id);`);
T("deleteTeacherTest не удаляет чужой/демо-тест", w.eval("mockTests.length") === beforeDelete);

w.localStorage.setItem("unitest_appeals", JSON.stringify([{
  id: "app_sec", resultId: "1|2026-10-01|90|18", testId: 1, testTitle: "t",
  studentName: "Tosheva Malika Alisherovna", studentGroup: "101-PR",
  reason: "x", date: "2026-10-20", status: "pending"
}]));
w.eval(`resolveAppeal('app_sec', 'approve', 'ok');`);
T("resolveAppeal не одобряет апелляцию по чужому тесту", w.eval("getAppeals()[0].status") === "pending");

w.eval(`selectRole('student'); currentChatGroup = '201-PR'; document.getElementById('chatInput') && (document.getElementById('chatInput').value = 'x');`);
const msgCount = w.eval("mockMessages.length");
T("sendMessage не пишет в чужую группу", w.sendMessage() === false && w.eval("mockMessages.length") === msgCount);

console.log("\n[7] Ролевой рендер");
w.eval(`selectRole('student'); navigate('users');`);
T("студент не видит таблицу пользователей админа", !D.querySelector(".admin-users-table") && !D.querySelector(".admin-user-card"));

console.log("\n[8] Канонические данные и консоль");
T("группа 101-PR латиницей в mockStudent", w.eval("mockStudent.group") === "101-PR");
T("нет неожиданных console.error в сценариях", app.errors.filter(e => !/Неизвестный раздел/.test(e)).length === 0, app.errors.slice(0, 3).join(" | "));

app.close();
console.log("\n=== ИТОГ: TEST41 пройдено " + pass + ", провалено " + fail + " ===");
process.exit(fail ? 1 : 0);
