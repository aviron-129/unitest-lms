/* verify-screens.js — проверка результата «по скринам» в реальном headless-браузере.
   Для задачи из night-tasks.json открывает нужные роли/разделы, снимает PNG
   на десктопе/мобильном, в светлой/тёмной теме и на 3 языках, затем проверяет:
     - раздел отрисован и не является заглушкой;
     - нет горизонтального переполнения;
     - нет console.error / исключений;
     - ожидаемые селекторы и тексты на месте;
     - скриншот реально создан (размер > 12 КБ).

   Запуск:
     node tests/verify-screens.js --task 22
     node tests/verify-screens.js --task 22 --keep-open
*/
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { spawn, execFileSync } = require("child_process");
const { pathToFileURL } = require("url");

const ROOT = path.join(__dirname, "..");
const HTML_PATH = path.join(ROOT, "index.html");
const QUEUE_PATH = path.join(ROOT, "night-tasks.json");
const OUT_ROOT = path.join(ROOT, "screenshots");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Users\\aliev\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Users\\aliev\\AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe"
];

function findBrowser() {
  return CANDIDATES.find((p) => fs.existsSync(p)) || null;
}

function killTree(pid) {
  try { execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" }); }
  catch (e) { try { process.kill(pid); } catch (e2) {} }
}

class CDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.seq = 0;
    this.pending = new Map();
    this.consoleErrors = [];
    this.exceptions = [];
    this.logErrors = [];
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = (e) => rej(new Error("WS error: " + (e?.message || "unknown")));
    });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data.toString());
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.error) reject(new Error(m.error.message || JSON.stringify(m.error)));
        else resolve(m.result);
        return;
      }
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
        this.consoleErrors.push(m.params.args.map((a) => a.value ?? a.description ?? a.type).join(" "));
      }
      if (m.method === "Runtime.exceptionThrown") {
        const d = m.params.exceptionDetails || {};
        this.exceptions.push(d.exception?.description || d.text || "exception");
      }
      if (m.method === "Log.entryAdded" && m.params.entry?.level === "error") {
        this.logErrors.push(m.params.entry.text || "");
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("CDP timeout: " + method));
        }
      }, 30000);
    });
  }

  async eval(expr) {
    const r = await this.send("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    if (r.exceptionDetails) {
      throw new Error((r.exceptionDetails.exception?.description || r.exceptionDetails.text || "eval error").slice(0, 800));
    }
    return r.result ? r.result.value : undefined;
  }

  async screenshot(file) {
    const r = await this.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(r.data, "base64"));
  }

  clearErrors() {
    this.consoleErrors.length = 0;
    this.exceptions.length = 0;
    this.logErrors.length = 0;
  }

  close() {
    try { this.ws.close(); } catch (e) {}
  }
}

async function launchBrowser(width = 1440, height = 900) {
  const exe = findBrowser();
  if (!exe) {
    console.log("BROWSER_NOT_FOUND");
    process.exit(2);
  }
  const port = 9400 + Math.floor(Math.random() * 500);
  const profile = path.join(os.tmpdir(), `unitest-cdp-${process.pid}-${Date.now()}`);
  const url = pathToFileURL(HTML_PATH).href + "?v=" + Date.now();

  const proc = spawn(exe, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--disable-extensions",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--window-size=${width},${height}`,
    url
  ], { stdio: "ignore" });

  let target = null;
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === "page" && t.url.startsWith("file:")) || list.find((t) => t.type === "page");
      if (target?.webSocketDebuggerUrl) break;
    } catch (e) {}
    await sleep(300);
  }
  if (!target) {
    killTree(proc.pid);
    throw new Error("CDP_NOT_READY");
  }

  const cdp = new CDP(target.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");

  // Аудит q13: Page.navigate запускает новую загрузку поверх уже открытой
  // страницы. Раньше цикл готовности мог увидеть readyState старого документа
  // и выполнить сценарий до коммита новой навигации — первый сценарий изредка
  // снимал экран входа. Ждём документ с новым performance.timeOrigin.
  let prevTimeOrigin = 0;
  try { prevTimeOrigin = await cdp.eval("performance.timeOrigin") || 0; } catch (e) {}
  await cdp.send("Page.navigate", { url });
  for (let i = 0; i < 50; i++) {
    try {
      const state = await cdp.eval(
        "({ t: performance.timeOrigin, ready: document.readyState === 'complete' && typeof selectRole === 'function' })"
      );
      if (state && state.ready && state.t !== prevTimeOrigin) break;
    } catch (e) {}
    await sleep(300);
  }

  return { proc, cdp, profile, exe, url };
}

function defaultScenarios(task) {
  const v = task.verify || {};
  const role = v.role || "student";
  const section = v.section || "profile";
  const base = { role, section, width: 1440, height: 900, lang: "ru", theme: "light" };
  return [
    { ...base, name: "desktop-light-ru" },
    { ...base, name: "desktop-dark-en", theme: "dark", lang: "en" },
    { ...base, name: "mobile-light-uz", width: 390, height: 844, lang: "uz", mobile: true }
  ];
}

function taskScenarios(task) {
  return task.verify?.scenarios?.length ? task.verify.scenarios : defaultScenarios(task);
}

function runChecks(task, scenario, metrics, shotSize) {
  const expect = scenario.expect || {};
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });

  add("раздел отрисован", metrics.hasBox, "sectionContent");
  add(`контент не пустой (${metrics.textLength} симв.)`, metrics.textLength >= (expect.minTextLength ?? 20));
  add("нет горизонтального переполнения", metrics.scrollWidth <= metrics.innerWidth + 2,
    `scrollWidth=${metrics.scrollWidth} innerWidth=${metrics.innerWidth}`);
  add("нет console.error", metrics.consoleErrors.length === 0, metrics.consoleErrors.slice(0, 3).join(" | "));
  add("нет исключений", metrics.exceptions.length === 0, metrics.exceptions.slice(0, 3).join(" | "));
  add("скриншот создан", shotSize > 12000, `${Math.round(shotSize / 1024)} КБ`);
  add("нет 'undefined'/'NaN'/'[object Object]'", !/undefined|\bNaN\b|\[object Object\]/.test(metrics.text),
    (metrics.text.match(/undefined|\bNaN\b|\[object Object\]/) || [""])[0]);

  if (expect.noStub !== false) {
    add("не заглушка «в разработке»", !metrics.stubText || !metrics.text.includes(metrics.stubText),
      metrics.stubText ? `найден: ${metrics.stubText}` : "ключ пуст");
  }
  if (expect.selector) {
    add(`селектор ${expect.selector} ≥ ${expect.count ?? 1}`, metrics.selectorCount >= (expect.count ?? 1),
      `найдено: ${metrics.selectorCount}`);
  }
  if (expect.hasText) {
    add(`есть текст «${expect.hasText}»`, metrics.bodyText.includes(expect.hasText));
  }
  if (expect.noText) {
    add(`нет текста «${expect.noText}»`, !metrics.bodyText.includes(expect.noText));
  }
  if (expect.modal) {
    add("модалка открыта", metrics.modalVisible);
  }
  if (scenario.click) {
    add(`клик по «${scenario.click}» сработал`, metrics.clicked, metrics.clickResult);
  }
  // Аудит q10: сетка расписания должна помещаться по ширине (без внутреннего
  // горизонтального скролла) и не переносить одну букву на вторую строку.
  if (metrics.scheduleGrid) {
    add("сетка расписания без внутреннего скролла",
      metrics.scheduleGrid.scrollWidth <= metrics.scheduleGrid.clientWidth + 2,
      `${metrics.scheduleGrid.scrollWidth}/${metrics.scheduleGrid.clientWidth}`);
    add("нет переноса одной буквы в карточке расписания",
      metrics.scheduleOrphans.length === 0,
      metrics.scheduleOrphans.slice(0, 3).join(" | "));
  }

  return checks;
}

async function runScenario(cdp, task, scenario, taskDir) {
  const { role, section, width = 1440, height = 900, lang = "ru", theme = "light", mobile = false } = scenario;
  const name = scenario.name || `${role}-${section}-${width}-${theme}-${lang}`;
  const file = path.join(taskDir, `${task.id}-${name}.png`);

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: 1, mobile: !!mobile
  });
  cdp.clearErrors();

  const clickJson = JSON.stringify(scenario.click || "");
  const expr = `(() => {
    try { if (typeof closeTestScreen === 'function') closeTestScreen(); } catch (e) {}
    try { if (typeof closeNotifDetail === 'function') closeNotifDetail(); } catch (e) {}
    try { if (typeof closeNotifications === 'function') closeNotifications(); } catch (e) {}
    try { if (typeof logout === 'function') logout(); } catch (e) {}
    changeLanguage(${JSON.stringify(lang)});
    currentTheme = ${JSON.stringify(theme)};
    applyTheme();
    selectRole(${JSON.stringify(role)});
    navigate(${JSON.stringify(section)});
    let clicked = false, clickResult = '';
    const sel = ${clickJson};
    if (sel) {
      const el = document.querySelector(sel);
      if (el) { el.click(); clicked = true; clickResult = 'ok'; }
      else { clickResult = 'не найден: ' + sel; }
    }
    return { clicked, clickResult };
  })()`;

  let clickInfo = { clicked: false, clickResult: "" };
  try {
    clickInfo = await cdp.eval(expr) || clickInfo;
  } catch (e) {
    clickInfo = { clicked: false, clickResult: "ошибка: " + e.message };
  }

  await sleep(scenario.wait ?? 900);

  const selectorJson = JSON.stringify(scenario.expect?.selector || "");
  const metrics = await cdp.eval(`(() => {
    const box = document.getElementById('sectionContent');
    const text = ((box || document.body).innerText || '').trim();
    const stub = (typeof translations !== 'undefined' && translations[currentLang])
      ? (translations[currentLang].placeholderHint || '') : '';
    const sel = ${selectorJson};
    const schedule = document.querySelector('.schedule-grid');
    const scheduleOrphans = [];
    if (schedule) {
      [...schedule.querySelectorAll('.schedule-subject')].forEach(el => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const lines = [...range.getClientRects()];
        if (lines.length > 1 && lines[lines.length - 1].width < 24) {
          scheduleOrphans.push(el.innerText.trim());
        }
      });
    }
    return {
      hasBox: !!box,
      textLength: text.length,
      text: text.slice(0, 4000),
      bodyText: document.body.innerText.slice(0, 8000),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      stubText: stub,
      selectorCount: sel ? document.querySelectorAll(sel).length : -1,
      scheduleGrid: schedule
        ? { clientWidth: schedule.clientWidth, scrollWidth: schedule.scrollWidth }
        : null,
      scheduleOrphans,
      modalVisible: [...document.querySelectorAll('.pt-overlay, .notif-modal, [class*="modal"], dialog[open]')]
        .some(el => !el.classList.contains('hidden') && el.getBoundingClientRect().width > 0)
    };
  })()`);

  const errors = {
    consoleErrors: cdp.consoleErrors.slice(),
    exceptions: cdp.exceptions.slice()
  };

  await cdp.screenshot(file);
  const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
  const hash = size ? crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 16) : "";

  const checks = runChecks(task, scenario, { ...metrics, ...errors, ...clickInfo }, size);
  const ok = checks.every((c) => c.ok);

  return {
    name, role, section, width, height, lang, theme,
    screenshot: path.relative(ROOT, file).replace(/\\/g, "/"),
    screenshotBytes: size,
    screenshotHash: hash,
    ok,
    checks,
    consoleErrors: errors.consoleErrors
  };
}

(async () => {
  const args = process.argv.slice(2);
  const taskJsonArg = args.indexOf("--task-json");
  const taskArg = args.indexOf("--task");
  let task = null;

  if (taskJsonArg >= 0) {
    const jsonPath = args[taskJsonArg + 1];
    if (!jsonPath || !fs.existsSync(jsonPath)) {
      console.error("Не найден --task-json: " + jsonPath);
      process.exit(2);
    }
    task = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } else {
    const taskId = taskArg >= 0 ? args[taskArg + 1] : null;
    if (!taskId) {
      console.error("Использование: node tests/verify-screens.js --task <id> | --task-json <file>");
      process.exit(2);
    }
    if (!fs.existsSync(QUEUE_PATH)) {
      console.error("Нет night-tasks.json");
      process.exit(2);
    }
    const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, "utf8"));
    task = (queue.tasks || []).find((t) => String(t.id) === String(taskId));
    if (!task) {
      console.error("Задача не найдена в night-tasks.json: " + taskId);
      process.exit(2);
    }
  }
  const taskId = String(task.id);

  const taskDir = path.join(OUT_ROOT, `task${task.id}`);
  fs.mkdirSync(taskDir, { recursive: true });
  const started = new Date().toISOString();
  const results = [];
  let launch = null;

  try {
    launch = await launchBrowser(1440, 900);
    console.log("browser:", launch.exe);

    for (const scenario of taskScenarios(task)) {
      console.log(`\n--- ${task.id}: ${scenario.name || scenario.role + "/" + scenario.section}`);
      let res;
      try {
        res = await runScenario(launch.cdp, task, scenario, taskDir);
      } catch (e) {
        res = {
          name: scenario.name, ok: false, screenshot: "",
          checks: [{ name: "сценарий выполнен", ok: false, detail: e.message }]
        };
      }
      for (const c of res.checks) {
        console.log(`  ${c.ok ? "ok  " : "FAIL"} | ${c.name}${c.detail ? "  -> " + c.detail : ""}`);
      }
      console.log(`  ${res.ok ? "✅" : "❌"} ${res.screenshot || "(без скриншота)"}`);
      results.push(res);
    }
  } catch (e) {
    console.error("ОШИБКА БРАУЗЕРА:", e.message);
    results.push({ name: "browser", ok: false, checks: [{ name: "браузер", ok: false, detail: e.message }] });
  } finally {
    if (launch) {
      launch.cdp.close();
      if (!args.includes("--keep-open")) killTree(launch.proc.pid);
      await sleep(300);
      try { fs.rmSync(launch.profile, { recursive: true, force: true }); } catch (e) {}
    }
  }

  // Защита от «залипшего» экрана: одинаковые PNG в разных темах/языках/ширинах — подозрительно
  const seenHashes = new Map();
  for (const r of results) {
    if (!r.screenshotHash) continue;
    if (seenHashes.has(r.screenshotHash)) {
      r.ok = false;
      r.checks.push({
        name: "уникальный скриншот",
        ok: false,
        detail: `совпадает с ${seenHashes.get(r.screenshotHash)} — возможно, экран не перерисовался`
      });
    } else {
      seenHashes.set(r.screenshotHash, r.name);
    }
  }
  for (const r of results) {
    const dup = r.checks.find((c) => c.name === "уникальный скриншот" && !c.ok);
    if (dup) console.log(`  FAIL | ${r.name}: ${dup.detail}`);
  }

  const ok = results.length > 0 && results.every((r) => r.ok);
  const report = {
    task: task.id,
    title: task.title,
    started,
    finished: new Date().toISOString(),
    ok,
    scenarios: results
  };
  fs.writeFileSync(path.join(taskDir, "report.json"), JSON.stringify(report, null, 2), "utf8");

  console.log("\n==================================================");
  console.log(`SCREENS: ${ok ? "OK" : "FAIL"} | сценариев: ${results.length} | зелёных: ${results.filter((r) => r.ok).length}`);
  console.log(`отчёт: ${path.relative(ROOT, path.join(taskDir, "report.json"))}`);
  console.log("==================================================");
  process.exit(ok ? 0 : 1);
})();
