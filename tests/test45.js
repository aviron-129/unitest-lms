/* test45 — единый вход: одна форма, роль по логину, демо-аккаунты. */
const { createApp } = require("./harness");

let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log("  ok | " + name); }
  else { fail++; console.log("  FAIL | " + name + (extra !== undefined ? "  -> " + extra : "")); }
}

const app = createApp();
const w = app.window, d = app.document;
const form = d.getElementById('loginForm');
const user = d.getElementById('loginUsername');
const passEl = d.getElementById('loginPassword');
const error = d.getElementById('loginError');
const submit = () => form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));

console.log("\n[1] Одна форма вместо 4 карточек");
T("форма входа существует", !!form && !!user && !!passEl);
T("карточек ролей больше нет", !d.querySelector('.role-card'));
T("демо-аккаунтов 4", d.querySelectorAll('[data-demo-login]').length === 4);

console.log("\n[2] Валидация и вход");
submit();
T("пустые поля → ошибка", !error.classList.contains('hidden'));
user.value = 'teacher'; passEl.value = 'wrong'; submit();
T("неверный пароль → ошибка", !error.classList.contains('hidden'));

user.value = 'teacher'; passEl.value = 'teacher'; submit();
T("teacher/teacher → панель преподавателя",
  !d.getElementById('panelScreen').classList.contains('hidden')
  && w.eval("currentRole") === 'teacher');
T("после входа ошибка скрыта", error.classList.contains('hidden'));

console.log("\n[3] Выход и демо-аккаунты");
w.logout();
T("выход → снова экран входа", !d.getElementById('loginScreen').classList.contains('hidden'));
T("логин и пароль очищены", user.value === '' && passEl.value === '');

d.querySelector('[data-demo-login="student"]').click();
T("демо student заполняет логин/пароль", user.value === 'student' && passEl.value === 'student');
submit();
T("вход студентом", w.eval("currentRole") === 'student');
w.logout();

console.log("\n[4] Алиасы и языки");
user.value = 'студент'; passEl.value = 'demo'; submit();
T("алиас «студент» + demo → студент", w.eval("currentRole") === 'student');
w.logout();

const keys = ['loginSubtitle', 'loginUsername', 'loginPassword', 'signIn', 'loginError', 'demoAccounts'];
T("ключи входа есть в ru/uz/en",
  ['ru', 'uz', 'en'].every(l => keys.every(k => typeof w.eval(`translations.${l}`)[k] === 'string')));
T("console.error пуст", app.errors.length === 0, JSON.stringify(app.errors));

console.log(`\n=== ИТОГ: пройдено ${pass}, провалено ${fail} ===`);
process.exit(fail ? 1 : 0);
