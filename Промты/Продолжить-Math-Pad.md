# ПРОМТ-ПРОДОЛЖЕНИЕ — Math Pad (математическая клавиатура), финализация

## КОНТЕКСТ ПРОЕКТА
- UniTest LMS: один файл `index.html` (vanilla JS, mock + localStorage, ru/uz/en, KaTeX+mhchem с CDN jsdelivr, акцент #6366f1, glassmorphism). Файл: `C:\Users\aliev\Downloads\Telegram Desktop\Новая папка\Новая папка\index.html` (248 181 символов, синтаксис OK).
- Тесты jsdom запускать ТОЛЬКО из `C:\Users\aliev\AppData\Local\Temp\opencode` (там установлен jsdom). PowerShell-однострочники с кириллицей/переносами ломать — писать временные .js файлы.
- Проект не в git. Промты №1–16 реализованы; прежние тесты зелёные: test15.js=93, test16.js=58, test17.js=47, test18.js=42 (запуск: `node testNN.js`).

## ЧТО ДЕЛАЕМ
ЗАДАЧА-ФИКС от пользователя: виртуальная клавиатура формул (Math Pad) в конструкторе тестов (как в приложениях для решения уравнений): табы y / f(x) / x², сетка `repeat(12,1fr)`, кнопки с LaTeX, нижний ряд abc ← → ⌫ ↵, блок предпросмотра, самопроверки: клик «Дробь» → дробь в поле; abc → русский текст; НЕ должно быть ошибок «mathfield is not defined».

## РЕШЕНИЕ (уже принято, не пересматривать)
MathLive НЕ подключаем (его в проекте нет; ломает value-поток валидаций/черновика, офлайн и всю jsdom-тестовую стратегию; самопроверка «русский текст + формула» тривиально решается на обычных полях). Клавиатура своя, поверх input/textarea, API в духе MathLive: `insertMathSymbol` с маркерами `#@` (карман для курсора) и `#?` (пропускается), команды `mpCommand('abc'|'left'|'right'|'backspace'|'enter')`.

## УЖЕ ВНЕСЁНО В index.html (все правки применены, синтаксис OK)
1. CSS (после `.math-preview--empty`/тёмной темы): `.math-pad`, `.mp-head`, `.mp-title`, `.mp-toggle` (ƒx), `.mp-tabs`, `.mp-tab/--active`, `.mp-keys` (grid 12 колонок, gap 4px), `.mp-btn` (span 2, hover: accent-подчёркивание `inset 0 -2px 0 var(--accent)`), `.mp-btn--fn` (italic), `.mp-ctrl`, `.mp-collapsed .mp-body{display:none}`, тёмная тема `[data-theme="dark"] .mp-btn`.
2. Переводы ×3 после `formulaHint`: `mpTitle, mpVars, mpFuncs, mpPowers, mpAbc`.
3. JS-секция 5.11.0.3 (после `bindMathPreviews`): `MP_KEYS` (vars: цифры/операции обычным текстом; funcs: `$\frac{#@}{#?}$`, √, ∛, ∫, ∑, ∏, lim, ∞, π, e, ln, log, sin/cos/tan, α β θ, матрица pmatrix 2×2 span 4; powers: x², xⁿ, xₐ, x⁻¹, 1/x, °, !, |x|, aᵇ, ·, ≈, ≡), `mpActiveField`, `mpSetActiveField`, `mpSyncPreview` (блок `#mathPreview` рендерится через `updateMathPreview`), `insertMathSymbol` (снятие `$...$` при `insideMath`, вырезка #@/#?, карман → скобки → конец; в конце `mpSetActiveField` + `syncMathPreview`), `mpCommand`, `mathPadHTML()` (табы y/f(x)/x², 3 группы + управляющий ряд abc(span4) ← → ⌫ ↵, `#mathPreview`), `bindMathPad` (mousedown-preventDefault чтобы не терять курсор, делегированный click, focus-слушатели на qText/qOpt0-3, начальный таргет qText).
4. Шаблон `renderQuestionBuilder`: `${mathPadHTML()}` перед `<label class="field">` текста вопроса.
5. `bindQuestionBuilder`: `bindMathPad(sectionContent)` после `bindMathPreviews`.

## ОСТАЛОСЬ (в этом порядке)
1. Запустить `node test19.js` (уже написан: `C:\Users\aliev\AppData\Local\Temp\opencode\test19.js`, ~45 проверок в 9 разделах — статика/переводы, цифры+дробь с #@-карманом, матрица, вставка внутрь формулы, команды, варианты-ответов, табы, смешение «Найдите значение»+формула, чистота консоли). Починить падения.
2. Регресс: `node test15.js` + `test16.js` + `test17.js` + `test18.js` (все зелёные до Math Pad).
3. Опционально скриншот: `node shot.js` (CDP, headless Chrome из temp opencode) — расширить: доехать до конструктора (заполнить шаг 1 → submit) и снять клавиатуру; PNG складывать в `...\Новая папка\Новая папка\screenshots\`.
4. Документы: `00_ЗАДАЧИ.md` — пункт **17.9** (Math Pad); `progress.md` — строка чек-листа + буллет в тест-логе (45 проверок); `Не-забыть.md` — §5 (MP_KEYS/insertMathSymbol/mpCommand/bindMathPad, маркеры #@/#?, решение без MathLive); `План-этапов.md` — строка «Сделано».
5. Финальный ответ: что умеет клавиатура (таблица кнопок), объяснение замены MathLive на свою клавиатуру, маппинг самопроверок пользователя, итог тестов.

## КЛЮЧЕВЫЕ ИДЕНТИФИКАТОРЫ
`renderMath`, `FORMULA_SNIPPETS`, `insertFormulaSnippet`, `insideMath`, `updateMathPreview`, `syncMathPreview`, `bindMathPreviews`, `MP_KEYS`, `insertMathSymbol`, `mpCommand`, `mpActiveField`, `mathPadHTML`, `bindMathPad`; id: `mathPad`, `mathPreview`, `mpToggle`; data-атрибуты: `data-mp`, `data-mp-cmd`, `data-mp-tab`, `data-mp-group`; ключи перевода `mp*`.

## ИЗВЕСТНЫЕ ГОТЧИ jsdom
- CDN-скрипты не грузятся → `katex` undefined; ставить шпионы `w.katex = {render(...)}` и `w.renderMathInElement = (...)`; при `readyState === "loading"` звать `initApp()` вручную.
- `translations` — top-level const → читать через `w.eval("translations.uz")`.
- CSS-селекторы атрибутов с `\` в значениях не работают → кнопки искать JS-ом: `[...el.querySelectorAll('.mp-btn')].find(b => b.dataset.mp === "$\\frac{#@}{#?}$")`.
- Событие фокуса: `el.dispatchEvent(new w.Event("focus"))`.
- `mockTeacher.name === "Sardor Rahimov"`; демо-тесты без `author` → фильтр результатов пуст до сохранения теста.
