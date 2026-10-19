/* smoke.js — прогон всех ролей × разделов × языков × тем.
   Проверяет, что каждый раздел рендерится, не падает и не пишет console.error.
   Запуск: node tests/smoke.js */
const { createApp } = require("./harness");

const app = createApp();
const w = app.window;
const d = app.document;
const menuConfig = JSON.parse(app.eval("JSON.stringify(menuConfig)"));

let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log("  FAIL | " + name + (extra !== undefined ? "  -> " + extra : "")); }
}

console.log("Роли:", Object.keys(menuConfig).join(", "));

// Экран входа
T("экран входа видим", !d.getElementById("loginScreen").classList.contains("hidden"));
T("4 кнопки ролей", d.querySelectorAll("[data-role]").length >= 4,
  "найдено " + d.querySelectorAll("[data-role]").length);

const roles = Object.keys(menuConfig);
const langs = ["ru", "uz", "en"];
const themes = ["light", "dark"];

for (const role of roles) {
  for (const lang of langs) {
    for (const theme of themes) {
      app.errors.length = 0;
      w.changeLanguage(lang);
      app.eval(`currentTheme = ${JSON.stringify(theme)}; applyTheme();`);
      w.selectRole(role);

      for (const item of menuConfig[role]) {
        const label = `${role}/${item.id} [${lang}/${theme}]`;
        try {
          w.navigate(item.id);
          const box = d.getElementById("sectionContent");
          const text = (box?.textContent || "").trim();
          T(label + " — контент отрисован", !!box && box.innerHTML.trim().length > 0);
          T(label + " — есть текст", text.length > 0);
          T(label + " — нет ошибок", app.errors.length === 0, app.errors.slice(0, 2).join(" | "));
        } catch (e) {
          fail++;
          console.log(`  FAIL | ${label} — исключение: ${e.message}`);
        }
      }
      w.logout();
    }
  }
}

console.log(`\n=== SMOKE: пройдено ${pass}, провалено ${fail} ===`);
app.close();
process.exit(fail === 0 ? 0 : 1);
