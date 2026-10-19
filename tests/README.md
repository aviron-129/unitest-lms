# tests — проверки UniTest

Все проверки запускаются из корня проекта.

## Полный прогон

```powershell
node tests/run-all.js
```

Сейчас: **14/14 наборов, 997 проверок** — синтаксис, функциональные тесты №13–24,
статика/i18n и smoke по всем ролям/разделам/языкам/темам.

## Проверка по скриншотам

```powershell
node tests/verify-screens.js --task 22
node tests/verify-screens.js --task-json "night-prompts/q1.task.json"
```

`--task` берёт сценарии из `night-tasks.json`. `--task-json` — из отдельного файла
(используется для задач аудита, которых нет в очереди).

Открывает `index.html` в headless Chrome (CDP, без puppeteer), снимает PNG
в `screenshots/task22/` и проверяет:

- раздел отрисован и не является заглушкой «в разработке»;
- нет горизонтального переполнения на 1440 и 390 px;
- нет `console.error` и исключений;
- ожидаемые селекторы/тексты (задаются в `night-tasks.json` → `verify`);
- скриншот создан и не пустой.

Сценарии по умолчанию: desktop light ru, desktop dark en, mobile light uz.
Для задачи можно задать свои сценарии в `night-tasks.json`.

## Отдельные тесты

```powershell
node tests/check.js
node tests/test15.js
node tests/test22.js
node tests/test25.js
node tests/static.js
node tests/smoke.js
```

## Зависимости

`jsdom` установлен локально в `tests/node_modules` (см. `package.json`).
Если папки нет:

```powershell
npm install --prefix tests
```

## Ночной режим

Из корня проекта: `ЗАПУСТИТЬ-НОЧЬ.cmd`.
Раннер сам вызывает `run-all.js` и `verify-screens.js` после каждой задачи.
