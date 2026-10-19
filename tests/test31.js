/* test31.js — Промт №31: глобальный поиск.
   Проверяем: кнопку в шапке, Ctrl/Cmd+K, поиск от 2 символов, категории
   (тесты/группы/пользователи/объявления), права ролей, заглушку пустого
   результата, очистку при закрытии, alert по клику и переводы ru/uz/en.
   Запуск: node tests/test31.js */
const { createApp } = require("./harness");

const app = createApp();
const w = app.window, d = app.document;
let pass = 0, fail = 0;

function T(name, cond, extra) {
  if (cond) { pass++; console.log("  ok | " + name); }
  else { fail++; console.log("  FAIL | " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra) : "")); }
}
const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
const results = () => d.getElementById("searchResults");
const resultText = () => txt(results());
const resultItems = () => [...d.querySelectorAll("#searchResults .search-result")];
const isOpen = () => !d.getElementById("searchDropdown").classList.contains("hidden");
const key = (k, opts = {}) => d.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, ...opts }));

console.log("\n[1] Кнопка поиска и панель");
T("кнопка #searchBtn в шапке", !!d.querySelector(".app-header-actions #searchBtn"));
T("панель #searchDropdown скрыта при старте", !isOpen());
T("поле #searchInput", !!d.getElementById("searchInput"));
T("кнопка закрытия #searchClose", !!d.getElementById("searchClose"));
T("контейнер #searchResults", !!d.getElementById("searchResults"));
T("placeholder «Поиск...»", d.getElementById("searchInput").placeholder === "Поиск...");

console.log("\n[2] Студент: только свои тесты и объявления");
w.selectRole("student");
d.getElementById("searchBtn").click();
T("клик открывает панель", isOpen());
T("подсказка для 0 символов", resultText().includes("Введите минимум 2 символа"), resultText());

const inputEl = d.getElementById("searchInput");
inputEl.value = "матем";
inputEl.dispatchEvent(new w.Event("input", { bubbles: true }));
T("событие input обновляет результаты в реальном времени", resultItems().length >= 1, resultText());

w.performSearch("м");
T("1 символ — не ищем", resultItems().length === 0 && resultText().includes("Введите минимум 2 символа"), resultText());
w.performSearch("матем");
T("тест найден", resultItems().length >= 1 && resultText().includes("Тесты"), resultText());
T("название теста", resultText().includes("Математика. Контрольная №3"), resultText());
T("категория «Пользователи» отсутствует", !resultText().includes("Пользователи"), resultText());

w.performSearch("Ivanov");
T("студент не находит других студентов", resultText().includes("Ничего не найдено"), resultText());
T("в пустом результате есть запрос", resultText().includes("Ivanov"), resultText());

w.performSearch("расписан");
T("студент видит объявления своей группы/для всех", resultText().includes("Объявления") && resultText().includes("Обновление расписания"), resultText());

console.log("\n[3] Преподаватель: свои тесты, группы и студенты");
w.selectRole("teacher");
w.performSearch("Ivanov");
T("студент найден", resultItems().length >= 1 && resultText().includes("Ivanov Ivan"), resultText());
T("у результата указана группа", resultText().includes("101-PR"), resultText());

w.performSearch("101");
T("группа найдена", resultText().includes("Группы") && resultText().includes("101-PR"), resultText());
T("студенты группы найдены", resultText().includes("Tosheva Malika"), resultText());
T("нет чужих тестов (Smirnov)", (w.performSearch("Smirnov"), !resultText().includes("Математика. Контрольная")), resultText());

w.performSearch("Ivanova");
T("преподаватель не ищет других преподавателей", resultText().includes("Ничего не найдено"), resultText());

console.log("\n[4] Менеджер: только своё направление");
w.selectRole("manager");
w.performSearch("101");
T("группа направления найдена", resultText().includes("Группы") && resultText().includes("101-PR"), resultText());
T("студенты направления найдены", resultText().includes("Ivanov Ivan"), resultText());
w.performSearch("математика");
T("тесты направления найдены", resultText().includes("Тесты") && resultText().includes("Математика"), resultText());

w.performSearch("102-DZ");
T("чужая группа (дизайн) скрыта", resultText().includes("Ничего не найдено"), resultText());

w.performSearch("Ivanova");
T("чужой преподаватель скрыт", resultText().includes("Ничего не найдено"), resultText());

console.log("\n[5] Администратор: вся база");
w.selectRole("admin");
w.performSearch("101");
T("группа 101-PR найдена", resultText().includes("Группы") && resultText().includes("101-PR"), resultText());
T("студенты найдены", resultText().includes("Ivanov Ivan"), resultText());
w.performSearch("математика");
T("тесты найдены", resultText().includes("Тесты") && resultText().includes("Математика. Контрольная"), resultText());

w.performSearch("Ivanova");
T("преподаватель найден", resultText().includes("Ivanova E.P.") && resultText().includes("Преподаватель"), resultText());

w.performSearch("Sidorova");
T("менеджер найден", resultText().includes("Sidorova A.A.") && resultText().includes("Менеджер"), resultText());

w.performSearch("102-DZ");
T("дизайн-группа видна админу", resultText().includes("102-DZ"), resultText());

console.log("\n[6] Логи самопроверки");
T("лог запроса и роли", app.logs.some(l => l.startsWith("Поиск по запросу:") && l.includes("Роль:")), app.logs.slice(-6));
T("лог «Найдено тестов:»", app.logs.some(l => l.startsWith("Найдено тестов:")), app.logs.slice(-6));
T("лог «Найдено пользователей:»", app.logs.some(l => l.startsWith("Найдено пользователей:")), app.logs.slice(-6));

console.log("\n[7] Закрытие, горячие клавиши и клик по результату");
app.alerts.length = 0;
w.performSearch("101");
resultItems()[0].click();
T("клик по результату — демо-переход без «в разработке»",
  app.alerts.length === 1 && app.alerts[0].includes("Выбран объект") && app.alerts[0].includes("демо-переход"), app.alerts);

d.getElementById("searchClose").click();
T("крестик закрывает панель", !isOpen());
T("поле очищено", d.getElementById("searchInput").value === "");
T("результаты очищены", results().innerHTML === "");

key("k", { ctrlKey: true });
T("Ctrl+K открывает поиск", isOpen());
T("фокус в поле", d.activeElement === d.getElementById("searchInput"), d.activeElement && d.activeElement.id);
key("Escape");
T("Esc закрывает поиск", !isOpen());

d.getElementById("searchBtn").click();
T("кнопка снова открывает", isOpen());
d.body.click();
T("клик вне панели закрывает", !isOpen());

console.log("\n[8] Экранирование и переводы");
w.performSearch("<b>");
T("запрос экранирован", results().innerHTML.includes("&lt;b&gt;") && !results().querySelector("b"), results().innerHTML);

w.selectRole("student");
w.changeLanguage("en");
d.getElementById("searchBtn").click();
T("EN placeholder", d.getElementById("searchInput").placeholder === "Search...", d.getElementById("searchInput").placeholder);
T("EN подсказка", resultText().includes("Enter at least 2 characters"), resultText());
w.performSearch("math");
T("EN категория Tests", resultText().includes("Tests"), resultText());

w.changeLanguage("uz");
w.performSearch("");
T("UZ placeholder", d.getElementById("searchInput").placeholder === "Qidirish...", d.getElementById("searchInput").placeholder);
T("UZ подсказка", resultText().includes("Kamida 2 ta belgi kiriting"), resultText());
w.changeLanguage("ru");
w.closeSearch();

console.log("\n[9] Регресс");
T("уведомления на месте", !!d.getElementById("bellBtn") && !!d.getElementById("notifDropdown"));
T("панель профиля студента не сломана", (w.navigate("profile"), txt(d.getElementById("sectionContent")).includes("Tosheva")));
T("console.error пуст", app.errors.length === 0, app.errors);

console.log(`\n=== ИТОГ: пройдено ${pass}, провалено ${fail} ===`);
app.close();
process.exit(fail === 0 ? 0 : 1);
