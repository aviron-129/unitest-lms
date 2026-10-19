/* test35.js — Промт №35: групповой чат (студент ↔ преподаватель).
   Проверяем: пункт меню «Чат» у студента и преподавателя, демо-данные и
   localStorage (unitest_messages), фильтр по группе, выравнивание своих/чужих
   сообщений, отправку (trim, Enter, очистка поля, логи), переключение групп
   преподавателем, мобильное состояние «Назад», пустое состояние, экранирование
   XSS, синхронизацию через storage и переводы ru/uz/en.
   Запуск: node tests/test35.js */
const { createApp } = require("./harness");

const app = createApp();
const w = app.window, d = app.document;
let pass = 0, fail = 0;

function T(name, cond, extra) {
  if (cond) { pass++; console.log("  ok | " + name); }
  else { fail++; console.log("  FAIL | " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra) : "")); }
}
const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
const hasLog = (s) => app.logs.some(l => l.includes(s));
const savedMessages = () => JSON.parse(w.localStorage.getItem("unitest_messages") || "[]");
const liveMessages = () => JSON.parse(app.eval("JSON.stringify(mockMessages)"));
const cards = (sel) => [...d.querySelectorAll("#sectionContent " + sel)];
const menuItem = (role) => d.querySelector(`#sidebarMenu .menu-item[data-section="chat"]`);
const menuLabel = () => txt(d.querySelector('#sidebarMenu .menu-item[data-section="chat"] span'));
const input = () => d.getElementById("chatInput");
const sendBtn = () => d.getElementById("chatSendBtn");

const XSS = '<img src=x onerror=alert(1)>';

console.log("\n[1] Демо-данные и localStorage");
T("ключ unitest_messages создан при старте", Array.isArray(savedMessages()), w.localStorage.getItem("unitest_messages"));
T("демо-сообщений 5", liveMessages().length === 5, liveMessages().length);
T("сообщения сохраняются в localStorage", savedMessages().length === 5, savedMessages().length);
T("есть сообщения группы 101-PR", liveMessages().filter(m => m.groupName === "101-PR").length === 3);
T("есть сообщения группы 201-PR", liveMessages().filter(m => m.groupName === "201-PR").length === 2);
T("структура сообщения: id/groupName/senderName/senderRole/text/time",
  liveMessages().every(m => m.id && m.groupName && m.senderName && m.senderRole && m.text && m.time));

console.log("\n[2] Студент: меню и окно чата");
w.selectRole("student");
T("пункт «Чат» есть в меню студента", !!menuItem());
T("подпись пункта — «Чат»", menuLabel() === "Чат", menuLabel());
T("иконка комментариев", !!menuItem() && !!menuItem().querySelector(".fa-comments"));
w.navigate("chat");
const studentBox = d.getElementById("sectionContent");
T("раздел чата отрисован", !!studentBox.querySelector(".chat-page--student"));
T("заголовок «Чат группы 101-PR»", txt(studentBox.querySelector(".chat-title")) === "Чат группы 101-PR",
  txt(studentBox.querySelector(".chat-title")));
T("только сообщения своей группы (3)", cards(".chat-msg").length === 3, cards(".chat-msg").length);
T("чужой группы 201-PR в чате нет", !txt(studentBox).includes("201-PR"));
T("лог «Сообщений в чате 101-PR : 3»", hasLog("Сообщений в чате 101-PR : 3"));
T("своё сообщение справа", cards(".chat-msg--own").length === 1, cards(".chat-msg--own").length);
T("сообщения других слева", cards(".chat-msg--other").length === 2, cards(".chat-msg--other").length);
T("своё сообщение — от студента", txt(cards(".chat-msg--own")[0]).includes("консультация"));
T("сообщение преподавателя слева", cards(".chat-msg--other").some(el => txt(el).includes("Sardor Rahimov")));
T("подпись «Вы» у своего сообщения", txt(cards(".chat-msg--own")[0]).includes("Вы"));
T("демо-пометка «Демо без сервера»", txt(studentBox.querySelector(".chat-demo-note")).includes("Демо без сервера"));
T("бейдж «Демо»", txt(studentBox.querySelector(".chat-demo-badge")) === "Демо");
T("поле ввода и кнопка есть", !!input() && !!sendBtn());
T("placeholder поля", input() && input().placeholder === "Напишите сообщение...", input() && input().placeholder);
T("кнопка «Отправить»", txt(sendBtn()) === "Отправить", txt(sendBtn()));

console.log("\n[3] Отправка: пустые, Enter, trim, XSS, автоскролл");
input().value = "   ";
sendBtn().click();
T("пустое сообщение не добавлено", liveMessages().length === 5, liveMessages().length);
T("лог про пустое сообщение", hasLog("Пустое сообщение не отправлено"));

input().value = "  " + XSS + " Привет  ";
sendBtn().click();
let msgs = liveMessages();
T("сообщение добавлено", msgs.length === 6, msgs.length);
T("текст очищен через trim", msgs[5].text === XSS + " Привет", msgs[5].text);
T("группа 101-PR", msgs[5].groupName === "101-PR", msgs[5].groupName);
T("автор — студент", msgs[5].senderName === "Tosheva Malika Alisherovna", msgs[5].senderName);
T("роль student", msgs[5].senderRole === "student", msgs[5].senderRole);
T("id начинается с msg_", String(msgs[5].id).startsWith("msg_"), msgs[5].id);
T("время в формате HH:MM", /^\d{2}:\d{2}$/.test(msgs[5].time), msgs[5].time);
T("сообщение сохранено в localStorage", savedMessages().length === 6, savedMessages().length);
T("поле ввода очищено", input() && input().value === "", input() && input().value);
T("лог отправки с группой и текстом", hasLog("Отправлено сообщение в группу: 101-PR Текст:"));
T("новое сообщение отрисовано справа", cards(".chat-msg--own").length === 2, cards(".chat-msg--own").length);
T("XSS не выполнился (нет img в сообщении)", cards(".chat-msg-text img").length === 0);
T("XSS показан как текст", txt(studentBox).includes("<img src=x onerror=alert(1)>"));
T("лог перерисовки: 4 сообщения", hasLog("Сообщений в чате 101-PR : 4"));

// Enter без Shift отправляет, Shift+Enter — нет
input().value = "Сообщение по Enter";
input().dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
T("Enter отправляет сообщение", liveMessages().length === 7, liveMessages().length);
input().value = "Строка";
input().dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true, cancelable: true }));
T("Shift+Enter не отправляет", liveMessages().length === 7, liveMessages().length);

console.log("\n[4] Восстановление из localStorage (F5)");
w.eval("mockMessages.length = 0;");
T("в памяти очищено", liveMessages().length === 0);
w.eval("loadMessagesFromStorage();");
T("сообщения восстановлены", liveMessages().length === 7, liveMessages().length);

console.log("\n[5] Преподаватель: две колонки и переключение групп");
w.selectRole("teacher");
T("пункт «Чат» есть в меню преподавателя", !!menuItem());
T("подпись пункта — «Чат»", menuLabel() === "Чат", menuLabel());
w.navigate("chat");
const teacherBox = d.getElementById("sectionContent");
T("две колонки чата", !!teacherBox.querySelector(".chat-layout"));
T("две группы преподавателя", cards(".chat-group-item").length === 2, cards(".chat-group-item").length);
T("группа 101-PR в списке", cards(".chat-group-item").some(el => txt(el).includes("101-PR")));
T("группа 201-PR в списке", cards(".chat-group-item").some(el => txt(el).includes("201-PR")));
T("чужая группа 102-DZ скрыта", !txt(teacherBox).includes("102-DZ"));
T("по умолчанию открыта 101-PR", txt(teacherBox.querySelector(".chat-panel-name")) === "Чат группы 101-PR",
  txt(teacherBox.querySelector(".chat-panel-name")));
T("сообщений 101-PR = 5", cards(".chat-msg").length === 5, cards(".chat-msg").length);
T("сообщение преподавателя справа", cards(".chat-msg--own").length === 1, cards(".chat-msg--own").length);
T("сообщения студентов слева", cards(".chat-msg--other").length === 4, cards(".chat-msg--other").length);

// Переключение на 201-PR
d.querySelector('[data-chat-group="201-PR"]').click();
const switched = d.getElementById("sectionContent");
T("открыт чат 201-PR", txt(switched.querySelector(".chat-panel-name")) === "Чат группы 201-PR",
  txt(switched.querySelector(".chat-panel-name")));
T("сообщений 201-PR = 2", cards(".chat-msg").length === 2, cards(".chat-msg").length);
T("активная группа 201-PR", txt(switched.querySelector(".chat-group-item.active .chat-group-name")) === "201-PR");
T("лог «Открыт чат группы: 201-PR»", hasLog("Открыт чат группы: 201-PR"));

// Отправка преподавателем
input().value = "Тестовый ответ преподавателя";
sendBtn().click();
msgs = liveMessages();
T("сообщение преподавателя добавлено", msgs.length === 8, msgs.length);
T("роль teacher", msgs[7].senderRole === "teacher", msgs[7].senderRole);
T("автор — Sardor Rahimov", msgs[7].senderName === "Sardor Rahimov", msgs[7].senderName);
T("группа 201-PR", msgs[7].groupName === "201-PR", msgs[7].groupName);
T("в чате 201-PR теперь 3 сообщения", cards(".chat-msg").length === 3, cards(".chat-msg").length);
T("ответ преподавателя справа", cards(".chat-msg--own").length === 2, cards(".chat-msg--own").length);
T("преподаватель видит ответ в списке групп", txt(d.querySelector('[data-chat-group="201-PR"]')).includes("Тестовый ответ"));

console.log("\n[6] Мобильное состояние: список → чат → «Назад»");
T("кнопка «Назад» есть", !!d.getElementById("chatBackBtn"));
d.getElementById("chatBackBtn").click();
T("после «Назад» открыт список групп", !d.querySelector(".chat-layout").classList.contains("chat-open"));
d.querySelector('[data-chat-group="101-PR"]').click();
T("после клика по группе открыт чат", d.querySelector(".chat-layout").classList.contains("chat-open"));
T("выбранная группа 101-PR", txt(d.querySelector(".chat-panel-name")) === "Чат группы 101-PR");

console.log("\n[7] Пустое состояние");
w.localStorage.setItem("unitest_messages", JSON.stringify([]));
w.eval("loadMessagesFromStorage();");
w.navigate("chat");
T("показано пустое состояние", !!d.querySelector("#sectionContent .chat-empty"));
T("текст пустого состояния", txt(d.querySelector("#sectionContent .chat-empty")).includes("Пока нет сообщений"),
  txt(d.querySelector("#sectionContent .chat-empty")));
T("лог «Сообщений в чате 101-PR : 0»", hasLog("Сообщений в чате 101-PR : 0"));
input().value = "Первое сообщение в пустом чате";
sendBtn().click();
T("из пустого состояния можно отправить", liveMessages().length === 1, liveMessages().length);
T("сообщение появилось", cards(".chat-msg").length === 1, cards(".chat-msg").length);

console.log("\n[8] Синхронизация между вкладками (storage)");
w.navigate("chat"); // преподаватель, 101-PR
const external = liveMessages().concat([{
  id: "msg_external_35", groupName: "101-PR", senderName: "Tosheva Malika Alisherovna",
  senderRole: "student", text: "Сообщение из другой вкладки", time: "11:45", date: "2026-10-20"
}]);
input().value = "Недописанный черновик";
w.localStorage.setItem("unitest_messages", JSON.stringify(external));
w.dispatchEvent(new w.StorageEvent("storage", { key: "unitest_messages", newValue: JSON.stringify(external) }));
T("сообщение из другой вкладки добавлено", liveMessages().some(m => m.id === "msg_external_35"));
T("оно отрисовано", txt(d.getElementById("sectionContent")).includes("Сообщение из другой вкладки"));
T("недописанный текст не потерян", input() && input().value === "Недописанный черновик", input() && input().value);
T("лог синхронизации", hasLog("Чат синхронизирован из другой вкладки"));

console.log("\n[9] Переводы ru/uz/en");
const translations = JSON.parse(app.eval("JSON.stringify(translations)"));
const keys = ["chat", "chatGroupTitle", "chatSubtitle", "chatTeacherSubtitle", "chatMyGroups",
  "chatDemoBadge", "chatDemoNote", "chatInputPlaceholder", "chatSend", "chatEnterHint",
  "chatEmpty", "chatNoMessages", "chatSelectGroup", "chatBack", "chatNoGroups",
  "chatAriaMessages", "chatAriaInput", "chatYou", "chatStudents"];
T("все ключи чата есть в 3 языках",
  Object.keys(translations).every(l => keys.every(k => typeof translations[l][k] === "string" && translations[l][k].trim())));

w.changeLanguage("en");
T("en: пункт меню «Chat»", menuLabel() === "Chat", menuLabel());
T("en: заголовок группы", txt(d.querySelector(".chat-panel-name")) === "101-PR group chat",
  txt(d.querySelector(".chat-panel-name")));
T("en: кнопка «Send»", txt(sendBtn()) === "Send", txt(sendBtn()));
T("en: placeholder", input() && input().placeholder === "Write a message...", input() && input().placeholder);
T("en: группа сохранилась после смены языка", app.eval("currentChatGroup") === "101-PR", app.eval("currentChatGroup"));

w.changeLanguage("uz");
T("uz: пункт меню «Chat»", menuLabel() === "Chat", menuLabel());
T("uz: заголовок группы", txt(d.querySelector(".chat-panel-name")) === "101-PR guruhi chati",
  txt(d.querySelector(".chat-panel-name")));
T("uz: кнопка «Yuborish»", txt(sendBtn()) === "Yuborish", txt(sendBtn()));
T("uz: демо-пометка переведена", txt(d.querySelector(".chat-demo-note")).includes("Demo serversiz"),
  txt(d.querySelector(".chat-demo-note")));
T("нет console.error", app.errors.length === 0, app.errors.slice(0, 3));

console.log(`\n=== TEST35: пройдено ${pass}, провалено ${fail} ===`);
app.close();
process.exit(fail === 0 ? 0 : 1);
