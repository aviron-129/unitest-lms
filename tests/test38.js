/* Тест Промта №38: аудит и исправление тёмной темы.
   Проверяем переменные тем, страховочные стили полей/плейсхолдеров,
   модалки и попапы, таблицы/чат, SVG-схемы, KaTeX, MathLive-клавиатуру,
   контраст ролевых кнопок, скроллбары и JS-аудитор auditDarkTheme(). */
const fs = require("fs");
const { createApp, HTML_PATH } = require("./harness");

const html = fs.readFileSync(HTML_PATH, "utf8");
const css = (html.match(/<style>([\s\S]*?)<\/style>/) || ["", ""])[1];
const app = createApp();
const w = app.window, D = w.document;

let pass = 0, fail = 0;
function T(n, c, e) { if (c) { pass++; console.log("  ok | " + n); } else { fail++; console.log("  FAIL | " + n + (e !== undefined ? "  -> " + e : "")); } }
function cssHas(re) { return re.test(css); }
function hexLum(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(x => x + x).join("") : h;
  const rgb = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
function contrastWithWhite(hex) { return 1.05 / (hexLum(hex) + 0.05); }
function hexRgb(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(x => x + x).join("") : h;
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
}
/* Полупрозрачный цвет поверх тёмной карточки → непрозрачный hex. */
function mixHex(fgHex, alpha, bgHex) {
  const f = hexRgb(fgHex), b = hexRgb(bgHex);
  const c = f.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)));
  return "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
}
function contrastHex(a, b) {
  const l1 = hexLum(a), l2 = hexLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

console.log("\n[1] Переменные тем");
T("тёмная тема меняет основной текст", cssHas(/\[data-theme="dark"\]\s*\{[^}]*--text:\s*#e5e7eb/i));
T("тёмная тема меняет приглушённый текст", cssHas(/\[data-theme="dark"\]\s*\{[^}]*--text-muted:\s*#9ca3af/i));
T("тёмная тема: непрозрачный фон попапов", cssHas(/\[data-theme="dark"\]\s*\{[^}]*--surface-solid:\s*#161a36/i));
T("тёмная тема: фон экрана теста", cssHas(/\[data-theme="dark"\]\s*\{[^}]*--overlay-bg:\s*#0f132e/i));
T("тёмная тема: color-scheme dark", cssHas(/\[data-theme="dark"\]\s*\{[^}]*color-scheme:\s*dark/i));
T("светлая тема не изменена (--text #111827)", /:root\s*\{[^}]*--text:\s*#111827/i.test(css));
T("светлая тема не изменена (--card-bg)", /:root\s*\{[^}]*--card-bg:\s*rgba\(255,\s*255,\s*255,\s*0\.62\)/i.test(css));

console.log("\n[2] Границы в тёмной теме");
const darkBlock = (css.match(/\[data-theme="dark"\]\s*\{([\s\S]*?)\}/) || ["", ""])[1];
const cardBorder = (darkBlock.match(/--card-border:\s*rgba\(255,\s*255,\s*255,\s*([\d.]+)\)/) || [])[1];
const surfaceBorder = (darkBlock.match(/--surface-border:\s*rgba\(255,\s*255,\s*255,\s*([\d.]+)\)/) || [])[1];
T("--card-border в тёмной теме заметнее 8%", Number(cardBorder) >= 0.12, cardBorder);
T("--surface-border в тёмной теме заметнее 12%", Number(surfaceBorder) >= 0.16, surfaceBorder);

console.log("\n[3] Поля ввода и плейсхолдеры");
T(".field-input: фон --surface-solid", cssHas(/\.field-input\s*\{[^}]*background:\s*var\(--surface-solid\)/));
T(".field-input: текст --text", cssHas(/\.field-input\s*\{[^}]*color:\s*var\(--text\)/));
T(".field-input: рамка --surface-border", cssHas(/\.field-input\s*\{[^}]*border:\s*1px solid var\(--surface-border\)/));
T("плейсхолдер .field-input не чёрный", cssHas(/\.field-input::placeholder\s*\{[^}]*color:\s*var\(--text-muted\)/));
T("страховка для «сырых» input/textarea/select через :where()",
  /:where\(input:not\(\[type="checkbox"\]\)[\s\S]{0,700}?background-color:\s*var\(--surface-solid\)/.test(css));
T("общий плейсхолдер через :where()", cssHas(/:where\(input,\s*textarea\)::placeholder\s*\{[^}]*color:\s*var\(--text-muted\)/));
T("нативные <option> в тёмной теме читаемы", cssHas(/\[data-theme="dark"\]\s*select option\s*\{[^}]*background-color:\s*var\(--surface-solid\)/));

console.log("\n[4] Модалки и выпадающие панели");
T("админ-модалка на --surface-solid", cssHas(/\.admin-modal\s*\{[^}]*background:\s*var\(--surface-solid\)/));
T("периодическая таблица/схемы на переменных карточки", cssHas(/\.pt-window\s*\{[^}]*background:\s*var\(--card-bg\)/));
T("панель уведомлений непрозрачная", cssHas(/\.notif-dropdown\s*\{[^}]*background:\s*var\(--surface-solid\)/));
const chatInputCss = (css.match(/\.chat-input\s*\{([\s\S]*?)\}/) || ["", ""])[1];
T("поле чата: текст и фон из переменных",
  /color:\s*var\(--text\)/.test(chatInputCss) && /background:\s*var\(--hover-bg\)/.test(chatInputCss));
T("плейсхолдер чата не чёрный", cssHas(/\.chat-input::placeholder\s*\{[^}]*color:\s*var\(--text-muted\)/));

console.log("\n[5] Таблицы и чат");
T("зачётка: hover через --hover-bg", cssHas(/\.transcript-table tbody tr:hover\s*\{\s*background:\s*var\(--hover-bg\)/));
T("результаты: hover через --hover-bg", cssHas(/\.results-table tbody tr:hover\s*\{\s*background:\s*var\(--hover-bg\)/));
T("своё сообщение — акцент + белый текст", cssHas(/\.chat-msg--own \.chat-msg-text\s*\{[^}]*background:\s*var\(--accent\)[^}]*color:\s*#ffffff/));
T("чужое сообщение в тёмной теме — свой фон", cssHas(/\[data-theme="dark"\] \.chat-msg--other \.chat-msg-text\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.07\)/));

console.log("\n[6] SVG-схемы, KaTeX, MathLive");
T("подписи SVG-схем — var(--text)", cssHas(/\.diagram-svg \.dg-label\s*\{\s*fill:\s*var\(--text\)/));
T("сетка схем в тёмной теме видна", cssHas(/\[data-theme="dark"\] \.diagram-svg \.dg-grid\s*\{\s*stroke:\s*rgba\(255,\s*255,\s*255,\s*0\.10\)/));
T("оси схем в тёмной теме видна", cssHas(/\[data-theme="dark"\] \.diagram-svg \.dg-axis\s*\{\s*stroke:\s*rgba\(255,\s*255,\s*255,\s*0\.45\)/));
T("MathLive-поле в тёмной теме", cssHas(/\[data-theme="dark"\] \.q-mathfield\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.06\)/));
T("клавиатура MathLive: тёмный фон клавиш", cssHas(/\[data-theme="dark"\] body\s*\{[^}]*--keyboard-background:\s*#1e243a/));
T("клавиатура MathLive: светлые символы", cssHas(/\[data-theme="dark"\] body\s*\{[^}]*--keycap-text:\s*#e2e8f0/));
T("KaTeX: цвет ошибки зависит от темы", /errorColor:\s*currentTheme === 'dark' \? '#f87171' : '#cc0000'/.test(html));

console.log("\n[7] Контраст ролевых кнопок в тёмной теме");
for (const role of ["admin", "manager", "teacher", "student"]) {
  T(`--role-solid определён для ${role}`, new RegExp(`\\.role-${role}\\s*\\{[^}]*--role-solid:`).test(css));
}
const darkSolid = {};
for (const role of ["admin", "manager", "teacher", "student"]) {
  const re = new RegExp(`\\[data-theme="dark"\\]\\s*\\.role-${role}\\s*\\{\\s*--role-solid:\\s*(#[0-9a-f]{6})`, "i");
  const m = css.match(re);
  darkSolid[role] = m ? m[1] : "";
  T(`тёмный оттенок ${role} задан`, !!m, darkSolid[role]);
  if (m) T(`белый текст на ${role} ≥ 4.5:1`, contrastWithWhite(m[1]) >= 4.5, contrastWithWhite(m[1]).toFixed(2));
}
T("кнопки/меню/аватары используют --role-solid",
  (css.match(/var\(--role-solid,\s*var\(--role/g) || []).length >= 8,
  (css.match(/var\(--role-solid,\s*var\(--role/g) || []).length);

console.log("\n[8] Скроллбары");
T("тёмный scrollbar-color", cssHas(/\[data-theme="dark"\]\s*\{[^}]*scrollbar-color:\s*rgba\(148,\s*163,\s*184/));
T("::-webkit-scrollbar в тёмной теме", cssHas(/\[data-theme="dark"\] ::-webkit-scrollbar\s*\{\s*width:\s*10px/));
T("ползунок скроллбара стилизован", cssHas(/\[data-theme="dark"\] ::-webkit-scrollbar-thumb\s*\{[^}]*background:\s*rgba\(148,\s*163,\s*184/));

console.log("\n[9] JS-аудитор тёмной темы");
T("auditDarkTheme() существует", typeof w.auditDarkTheme === "function");
const box = D.getElementById("sectionContent");
const probe = D.createElement("div");
probe.setAttribute("style", "background: white; color: #000");
box.appendChild(probe);

app.eval("currentTheme = 'light'; applyTheme();");
T("в светлой теме аудит молчит", Array.isArray(w.auditDarkTheme(box)) && w.auditDarkTheme(box).length === 0);

app.eval("currentTheme = 'dark'; applyTheme();");
const warns = [];
const prevWarn = w.console.warn;
w.console.warn = (...a) => warns.push(a.map(String).join(" "));
const found = w.auditDarkTheme(box);
w.console.warn = prevWarn;
T("в тёмной теме найден inline background:white", found.length === 1, `найдено: ${found.length}`);
T("есть console.warn «Найден жестко заданный цвет:»", warns.some(x => x.includes("Найден жестко заданный цвет")), warns.slice(0, 2).join(" | "));
probe.remove();
T("без жёстких цветов аудит возвращает []", w.auditDarkTheme(box).length === 0);

console.log("\n[10] Вызовы и лог переключения темы");
T("аудит вызывается после профиля студента",
  /box\.innerHTML = renderStudentProfile\(\);[\s\S]{0,320}auditDarkTheme\(box\)/.test(html));
T("аудит вызывается после дашборда админа",
  /box\.innerHTML = renderAdminDashboard\(\);[\s\S]{0,160}auditDarkTheme\(box\)/.test(html));
const before = app.logs.length;
app.eval("currentTheme = 'light'; applyTheme();");
w.switchTheme();
const themeLog = app.logs.slice(before).find(l => l.includes("Тема изменена на:"));
T("лог «Тема изменена на: … Все компоненты перекрашены»", !!themeLog && themeLog.includes("Все компоненты перекрашены"), themeLog || "");
app.eval("currentTheme = 'light'; applyTheme();");

console.log("\n[11] Контраст текстовых бейджей в тёмной теме (аудит q5)");
const DARK_CARD = "#171b3a";                       // типичный непрозрачный фон карточки
const ROLE_SOFT = { admin: ["#8b5cf6", 0.35], manager: ["#3b82f6", 0.35], teacher: ["#10b981", 0.35], student: ["#f59e0b", 0.35] };
for (const role of ["admin", "manager", "teacher", "student"]) {
  const m = css.match(new RegExp(`\\[data-theme="dark"\\]\\s*\\.role-${role}\\s*\\{[^}]*--role-text:\\s*(#[0-9a-f]{6})`, "i"));
  const bg = mixHex(ROLE_SOFT[role][0], ROLE_SOFT[role][1], DARK_CARD);
  const cr = m ? contrastHex(m[1], bg) : 0;
  T(`--role-text (${role}) на --role-soft ≥ 4.5:1`, !!m && cr >= 4.5, m ? `${m[1]} / ${bg} = ${cr.toFixed(2)}` : "нет значения");
}
T(".sidebar-user-role использует --role-text", /\.sidebar-user-role\s*\{[^}]*color:\s*var\(--role-text/i.test(css));
T(".admin-direction-count использует --role-text", /\.admin-direction-count\s*\{[^}]*color:\s*var\(--role-text/i.test(css));

const badgeCount = css.match(/\[data-theme="dark"\]\s*\.badges-count\s*\{[^}]*color:\s*(#[0-9a-f]{6})/i);
const badgeBg = mixHex("#6366f1", 0.12, DARK_CARD);
T("счётчик бейджей в тёмной теме ≥ 4.5:1",
  !!badgeCount && contrastHex(badgeCount[1], badgeBg) >= 4.5,
  badgeCount ? `${badgeCount[1]} / ${badgeBg} = ${contrastHex(badgeCount[1], badgeBg).toFixed(2)}` : "нет значения");

T("счётчик меню: белый на #dc2626 ≥ 4.5:1",
  /\.menu-badge\s*\{[^}]*background:\s*#dc2626/i.test(css) && contrastHex("#ffffff", "#dc2626") >= 4.5,
  contrastHex("#ffffff", "#dc2626").toFixed(2));

const langActive = css.match(/\.lang-btn\.active\s*\{[^}]*background:\s*(#[0-9a-f]{6})/i);
T("активный языковой чип: белый текст ≥ 4.5:1",
  !!langActive && contrastHex("#ffffff", langActive[1]) >= 4.5,
  langActive ? `${langActive[1]} = ${contrastHex("#ffffff", langActive[1]).toFixed(2)}` : "нет значения");

for (const [cls, rgba, alpha] of [
  ["type-lecture", "#3b82f6", 0.14],
  ["type-practice", "#10b981", 0.14],
  ["type-lab", "#f59e0b", 0.16]
]) {
  const m = css.match(new RegExp(`\\[data-theme="dark"\\]\\s*\\.${cls}\\s+\\.schedule-type\\s*\\{[^}]*color:\\s*(#[0-9a-f]{6})`, "i"));
  const bg = mixHex(rgba, alpha, DARK_CARD);
  const cr = m ? contrastHex(m[1], bg) : 0;
  T(`бейдж ${cls} в тёмной теме ≥ 4.5:1`, !!m && cr >= 4.5, m ? `${m[1]} / ${bg} = ${cr.toFixed(2)}` : "нет значения");
}

console.log("\n[12] Консоль");
T("console.error пуст", app.errors.length === 0, app.errors.slice(0, 3).join(" | "));

console.log(`\n=== TEST38: пройдено ${pass}, провалено ${fail} ===`);
app.close();
process.exit(fail === 0 ? 0 : 1);
