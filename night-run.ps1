<#
  night-run.ps1 — ночной автономный раннер UniTest.
  Один запуск = одна задача = проверка = коммит. Следующая задача только после зелёных проверок.

  Запуск (обычно через ЗАПУСТИТЬ-НОЧЬ.cmd):
    powershell -NoProfile -ExecutionPolicy Bypass -File .\night-run.ps1

  Полезные режимы:
    -DryRun            показать план и промты, ничего не запускать
    -Only 22           выполнить только задачу №22
    -MaxTasks 3        ограничить число задач
    -Force             перезапустить даже выполненные задачи
    -NoKeepAwake       не менять настройки сна Windows
#>
param(
  [switch]$DryRun,
  [switch]$Force,
  [string]$Only = "",
  [int]$MaxTasks = 0,
  [switch]$NoKeepAwake
)

$ErrorActionPreference = "Continue"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$OutputEncoding = [System.Text.Encoding]::UTF8

$Root = $PSScriptRoot
if (-not $Root) { $Root = Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location $Root

$QueuePath   = Join-Path $Root "night-tasks.json"
$StatePath   = Join-Path $Root "night-state.json"
$ReportPath  = Join-Path $Root "НОЧНОЙ-ОТЧЁТ.md"
$BlockersPath= Join-Path $Root "night-blockers.md"
$BackupDir   = Join-Path $Root "backups"
$LogDir      = Join-Path $Root "logs"
$PromptDir   = Join-Path $Root "night-prompts"

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Write-Text([string]$Path, [string]$Text) {
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}
function Append-Text([string]$Path, [string]$Text) {
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [System.IO.File]::AppendAllText($Path, $Text, $Utf8NoBom)
}
function Read-Json([string]$Path) {
  return (Get-Content -Raw -Encoding UTF8 $Path | ConvertFrom-Json)
}
function Step([string]$Msg) { Write-Host ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $Msg) -ForegroundColor Cyan }
function Ok([string]$Msg)   { Write-Host ("[{0}] OK   {1}" -f (Get-Date -Format "HH:mm:ss"), $Msg) -ForegroundColor Green }
function Warn([string]$Msg) { Write-Host ("[{0}] !!!  {1}" -f (Get-Date -Format "HH:mm:ss"), $Msg) -ForegroundColor Yellow }
function Err([string]$Msg)  { Write-Host ("[{0}] FAIL {1}" -f (Get-Date -Format "HH:mm:ss"), $Msg) -ForegroundColor Red }
function Quote-Arg([string]$a) {
  if ($a -match '[\s"]') { return '"' + ($a -replace '"', '\"') + '"' }
  return $a
}
function Rel([string]$p) {
  if ($p -and $p.StartsWith($Root)) { return $p.Substring($Root.Length).TrimStart('\', '/') }
  return $p
}
function Resolve-OpenCode {
  $cmd = Get-Command opencode -ErrorAction SilentlyContinue
  if ($cmd) {
    if ($cmd.CommandType -eq "ExternalScript") {
      $base = Split-Path $cmd.Source -Parent
      $exe = Join-Path $base "node_modules\@opencode\cli\bin\opencode.exe"
      if (Test-Path $exe) { return $exe }
    }
    if ($cmd.Source -and (Test-Path $cmd.Source)) { return $cmd.Source }
  }
  return $null
}

# ---------------------------------------------------------------------------
# 0. Проверки окружения
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host "  UniTest — ночной раннер (одна задача → проверка → коммит)" -ForegroundColor Magenta
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host ""

foreach ($f in @("index.html", "night-tasks.json", "tests\run-all.js", "tests\verify-screens.js")) {
  if (-not (Test-Path (Join-Path $Root $f))) {
    Err "Не найден обязательный файл: $f"
    exit 1
  }
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Err "Node.js не найден в PATH"; exit 1 }
if (-not (Get-Command git  -ErrorAction SilentlyContinue)) { Err "Git не найден в PATH"; exit 1 }
$OpenCodeExe = Resolve-OpenCode
if (-not $OpenCodeExe) { Err "opencode не найден в PATH"; exit 1 }

$nodeVer = (& node --version).Trim()
$gitVer  = (& git --version).Trim()
$ocVer   = (& $OpenCodeExe --version).Trim()
Ok "Node $nodeVer | $gitVer | opencode $ocVer"

# jsdom для тестов
if (-not (Test-Path (Join-Path $Root "tests\node_modules\jsdom"))) {
  Warn "jsdom не установлен — ставлю зависимости тестов (npm install)..."
  if (-not $DryRun) {
    & npm install --prefix (Join-Path $Root "tests") --no-audit --no-fund 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { Err "npm install не удался"; exit 1 }
  }
}

# Git
$inside = (& git rev-parse --is-inside-work-tree 2>$null)
if ($inside -ne "true") {
  Step "Инициализирую git-репозиторий..."
  if (-not $DryRun) { & git init 2>&1 | Out-Null }
}
$hasHead = $true
& git rev-parse --verify HEAD 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { $hasHead = $false }
if (-not $hasHead -and -not $DryRun) {
  Step "Создаю базовый коммит..."
  & git add -A 2>&1 | Out-Null
  & git commit -m "baseline: 21 задача, тесты и ночной раннер" 2>&1 | Out-Null
}

foreach ($d in @($BackupDir, $LogDir, $PromptDir)) {
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
}

# ---------------------------------------------------------------------------
# 1. Очередь и состояние
# ---------------------------------------------------------------------------
$queue = Read-Json $QueuePath
if (-not $queue.tasks -or $queue.tasks.Count -eq 0) { Err "В night-tasks.json нет задач"; exit 1 }

$s = $queue.settings
$model = "deepseek/deepseek-flash#high"
if ($s.model) { $model = [string]$s.model }
$limit = 6
if ($s.maxTasks) { $limit = [int]$s.maxTasks }
if ($MaxTasks -gt 0) { $limit = $MaxTasks }
$maxHours = 8
if ($s.maxHours) { $maxHours = [double]$s.maxHours }
$timeoutMin = 90
if ($s.taskTimeoutMinutes) { $timeoutMin = [int]$s.taskTimeoutMinutes }
$stopOnFailure = $true
if ($null -ne $s.stopOnFailure) { $stopOnFailure = [bool]$s.stopOnFailure }

$stateTasks = @{}
if (Test-Path $StatePath) {
  try {
    $old = Read-Json $StatePath
    if ($old.tasks) {
      foreach ($p in $old.tasks.PSObject.Properties) { $stateTasks[$p.Name] = $p.Value }
    }
  } catch {
    Warn "Старый night-state.json повреждён — начинаю с чистого состояния"
  }
}
$state = @{ started = (Get-Date).ToString("o"); tasks = $stateTasks }

$startedAt = Get-Date
$endAt = $startedAt.AddHours($maxHours)

$tasks = @($queue.tasks)
if ($Only) { $tasks = @($tasks | Where-Object { [string]$_.id -eq $Only }) }
if ($tasks.Count -eq 0) { Err "Задача '$Only' не найдена в night-tasks.json"; exit 1 }

Write-Host ""
Ok "Модель: $model"
Ok ("Лимит: {0} задач / {1} ч / таймаут задачи {2} мин" -f $limit, $maxHours, $timeoutMin)
Ok ("Очередь: " + (($tasks | ForEach-Object { "#" + $_.id }) -join ", "))
Ok "Стоп при красных проверках: $stopOnFailure"
Write-Host ""

if (-not $NoKeepAwake -and -not $DryRun) {
  Step "Отключаю сон/гибернацию Windows (вернуть: powercfg /change standby-timeout-ac 30)..."
  foreach ($cmd in @(
    @("standby-timeout-ac", "0"), @("hibernate-timeout-ac", "0"), @("disk-timeout-ac", "0"),
    @("standby-timeout-dc", "0"), @("hibernate-timeout-dc", "0"), @("disk-timeout-dc", "0"),
    @("monitor-timeout-ac", "15")
  )) {
    try { & powercfg /change $cmd[0] $cmd[1] 2>$null | Out-Null } catch {}
  }
  Warn "Ноутбук должен быть в розетке: на батарее ночь может не выдержать."
}

# ---------------------------------------------------------------------------
# 2. Отчёт
# ---------------------------------------------------------------------------
function Update-Report {
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("# 🌙 Ночной отчёт UniTest")
  $lines.Add("")
  $lines.Add("- Начат: **" + $startedAt.ToString("dd.MM.yyyy HH:mm") + "**")
  $lines.Add("- Предел: **" + $endAt.ToString("dd.MM.yyyy HH:mm") + "**")
  $lines.Add("- Модель: ``" + $model + "``")
  $lines.Add("- Задач в очереди: **" + $tasks.Count + "**")
  $lines.Add("")
  $lines.Add("| # | Задача | Статус | Тесты | Скрины | Коммит | Лог |")
  $lines.Add("|---|--------|--------|-------|--------|--------|-----|")
  foreach ($t in $tasks) {
    $id = [string]$t.id
    $st = "⏳ ожидает"
    $tests = "—"; $screens = "—"; $commit = "—"; $log = "—"
    if ($stateTasks.ContainsKey($id)) {
      $x = $stateTasks[$id]
      if ($x.status -eq "done") { $st = "✅ готово" }
      elseif ($x.status -eq "failed") { $st = "❌ провал" }
      elseif ($x.status -eq "running") { $st = "▶ идёт" }
      if ($null -ne $x.tests) { $tests = if ([int]$x.tests -eq 0) { "✅" } else { "❌" } }
      if ($null -ne $x.screens) { $screens = if ([int]$x.screens -eq 0) { "✅" } else { "❌" } }
      if ($x.commit) { $commit = "``" + $x.commit + "``" }
      if ($x.log) { $log = "[лог](" + ($x.log -replace "\\", "/") + ")" }
    }
    $lines.Add("| $id | $($t.title) | $st | $tests | $screens | $commit | $log |")
  }
  $lines.Add("")
  $lines.Add("## Утром проверь")
  $lines.Add("")
  $lines.Add("1. Скриншоты: ``screenshots/task<id>/`` (PNG + ``report.json``).")
  $lines.Add("2. Логи: ``logs/``.")
  $lines.Add("3. ``git log --oneline -10`` — коммит на каждую задачу.")
  $lines.Add("4. ``node tests/run-all.js`` — полный регресс.")
  $lines.Add("5. ``cat НОЧНОЙ-ОТЧЁТ.md`` — эта таблица.")
  $lines.Add("")
  Write-Text $ReportPath ($lines -join "`r`n")
}

Update-Report

# ---------------------------------------------------------------------------
# 3. Основной цикл
# ---------------------------------------------------------------------------
$done = 0
$failed = 0
$skipped = 0
$processed = 0

foreach ($task in $tasks) {
  if ($processed -ge $limit) { Warn "Достигнут лимит задач ($limit) — останавливаюсь"; break }
  if ((Get-Date) -gt $endAt) { Warn "Вышло время ($maxHours ч) — останавливаюсь"; break }

  $id = [string]$task.id
  $title = [string]$task.title
  $prev = $null
  if ($stateTasks.ContainsKey($id)) { $prev = $stateTasks[$id] }

  if (-not $Force -and $prev) {
    if ($prev.status -eq "done") {
      Step "Задача #$id уже выполнена — пропускаю"
      $skipped++
      continue
    }
    if ($prev.status -eq "failed" -and [int]$prev.attempts -ge 2) {
      Step "Задача #$id уже дважды провалена — пропускаю"
      $skipped++
      continue
    }
  }

  $processed++
  $attempt = 1
  if ($prev -and $prev.attempts) { $attempt = [int]$prev.attempts + 1 }

  Write-Host ""
  Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
  Step "ЗАДАЧА #$id — $title (попытка $attempt)"
  Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray

  # 3.1 Бэкап
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $backup = Join-Path $BackupDir ("index_{0}_{1}.html" -f $id, $stamp)
  Copy-Item (Join-Path $Root "index.html") $backup -Force
  Ok "Бэкап: backups\$(Split-Path $backup -Leaf)"

  # 3.2 Промт
  $promptPath = Join-Path $PromptDir ("{0}.md" -f $id)
  $notes = ""
  if ($task.notes) { $notes = [string]$task.notes }
  $promptFile = [string]$task.promptFile
  $promptText = @"
# Ночная задача $id — $title

Выполни **ровно одну** задачу. Не начинай следующую.

## Прочитай перед работой
1. ``AGENTS.md`` — правила проекта.
2. ``Не-забыть.md`` — расхождения промтов с реальным кодом.
3. ``ПЛАН-ДЕЙСТВИЙ.md`` — Definition of Done.
4. ``progress.md`` — что уже сделано.
5. Файл задачи: ``$promptFile``.

## Задача
$title

Файл промта: ``$promptFile``. Адаптируй его под фактический код (см. «Не-забыть»):
имена функций, ключи переводов, группы ``101-PR`` (латиница), направления ``programming``/``design``.

## Важные заметки
$notes

## Обязательные проверки (исправляй, пока не зелено)
``````powershell
node tests/run-all.js
node tests/verify-screens.js --task $id
``````

- ``run-all.js``: синтаксис + 8 наборов + статика/i18n + smoke (сейчас 11/11 зелёные).
- ``verify-screens.js``: headless Chrome, скриншоты 1440/390, light/dark, ru/uz/en,
  проверка заглушек, переполнения, console.error и селекторов.
- Если селектор в ``night-tasks.json`` → ``verify`` не совпадает с твоей вёрсткой —
  уточни **только этот блок своей задачи** (не меняй порядок задач и settings).

## Что обновить
- ``progress.md`` — галочка и краткая запись.
- ``План-этапов.md`` — статус ✅.
- ``Промты/00_ИНДЕКС.md`` — статус ✅.

## Запреты
- Не делай ``git commit`` / ``git push`` / ``git reset`` — это работа раннера.
- Не трогай другие задачи и другие панели без необходимости.
- Не оставляй хардкод русских строк в UI — только ``dict`` (ru/uz/en).
- Не оставляй ``index.html`` сломанным.

## Если не получается
Запиши причину в ``night-blockers.md`` и заверши сессию. Не ломай работающий код.

## В конце ответа
Коротко: что изменено, какие проверки прошли, что осталось.
"@
  Write-Text $promptPath $promptText
  Ok ("Промт: " + (Rel $promptPath))

  $logPath = Join-Path $LogDir ("night-{0}-{1}.log" -f $id, $stamp)
  $errPath = "$logPath.err"

  $stateTasks[$id] = @{
    status = "running"; attempts = $attempt; started = (Get-Date).ToString("o");
    tests = $null; screens = $null; commit = $null; log = (Rel $logPath)
  }
  $state.tasks = $stateTasks
  if (-not $DryRun) { Write-Text $StatePath ($state | ConvertTo-Json -Depth 10) }

  # 3.3 Запуск opencode
  $argList = @(
    "run", "--auto", "--model", $model,
    "--title", "Night $id",
    "--file", $promptPath,
    "Execute exactly one task from the attached file. Work autonomously, do not ask questions."
  )
  $argString = (($argList | ForEach-Object { Quote-Arg ([string]$_) }) -join " ")

  if ($DryRun) {
    Warn "DRY-RUN: не запускаю. Команда:"
    Write-Host ("  `"" + $OpenCodeExe + "`" " + $argString) -ForegroundColor DarkGray
    $stateTasks[$id] = @{ status = "pending"; attempts = 0; tests = $null; screens = $null; commit = $null; log = $null }
    continue
  }

  Step "Запускаю opencode (таймаут $timeoutMin мин)..."
  $proc = Start-Process -FilePath $OpenCodeExe -ArgumentList $argString -WorkingDirectory $Root `
    -RedirectStandardOutput $logPath -RedirectStandardError $errPath -PassThru -WindowStyle Hidden

  $proc | Wait-Process -Timeout ($timeoutMin * 60) -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 700
  try { $proc.Refresh() } catch {}
  $runExit = 0
  if (-not $proc.HasExited) {
    Warn "Таймаут задачи — останавливаю процесс opencode"
    try { & taskkill /PID $proc.Id /T /F 2>$null | Out-Null } catch {}
    $runExit = 124
  } else {
    $runExit = $proc.ExitCode
  }
  if (Test-Path $errPath) {
    try { Append-Text $logPath ((Get-Content -Raw -Encoding UTF8 $errPath) + "`r`n") } catch {}
    Remove-Item $errPath -Force -ErrorAction SilentlyContinue
  }
  if ($runExit -eq 0) { Ok "opencode завершился" } else { Warn "opencode exit code: $runExit" }

  # 3.4 Проверки
  Step "ПРОВЕРКА 1/2: node tests/run-all.js"
  $testLog = "$logPath.tests"
  & node "tests\run-all.js" 2>&1 | Tee-Object -FilePath $testLog | Out-Host
  $testExit = $LASTEXITCODE
  if ($testExit -eq 0) { Ok "run-all: зелёно" } else { Err "run-all: КРАСНО (exit $testExit)" }

  Step "ПРОВЕРКА 2/2: скриншоты + DOM (node tests/verify-screens.js --task $id)"
  $screenLog = "$logPath.screens"
  & node "tests\verify-screens.js" --task $id 2>&1 | Tee-Object -FilePath $screenLog | Out-Host
  $screenExit = $LASTEXITCODE
  if ($screenExit -eq 0) { Ok "скриншоты: зелёно" } else { Err "скриншоты: КРАСНО (exit $screenExit)" }

  # 3.5 Коммит / статус
  & git add -A 2>&1 | Out-Null
  $changes = (& git status --porcelain) -join "`n"
  $commitHash = ""
  if ($testExit -eq 0 -and $screenExit -eq 0) {
    if ($changes.Trim().Length -gt 0) {
      & git commit -m "task($id): $title" 2>&1 | Out-Null
    } else {
      & git commit --allow-empty -m "task($id): $title (no changes)" 2>&1 | Out-Null
    }
    $commitHash = (& git rev-parse --short HEAD).Trim()
    $stateTasks[$id] = @{
      status = "done"; attempts = $attempt; finished = (Get-Date).ToString("o");
      tests = $testExit; screens = $screenExit; commit = $commitHash;
      log = (Rel $logPath)
    }
    $done++
    Ok "ЗАДАЧА #$id ЗАКРЫТА. Коммит: $commitHash"
  } else {
    if ($changes.Trim().Length -gt 0) {
      & git commit -m "wip($id): проверки красные" 2>&1 | Out-Null
      $commitHash = (& git rev-parse --short HEAD).Trim()
    }
    $stateTasks[$id] = @{
      status = "failed"; attempts = $attempt; finished = (Get-Date).ToString("o");
      tests = $testExit; screens = $screenExit; commit = $commitHash;
      log = (Rel $logPath)
    }
    $failed++
    $block = @(
      "", "## ❌ Задача #$id — $title", "",
      "- run-all: **$testExit**", "- скриншоты: **$screenExit**", "- opencode: **$runExit**",
      "- лог: ``$(Rel $logPath)``",
      "- скриншоты: ``screenshots/task$id/``",
      "- тесты: ``$(Rel $testLog)``",
      "- проверка экранов: ``$(Rel $screenLog)``",
      ""
    ) -join "`r`n"
    Append-Text $BlockersPath $block
    Err "ЗАДАЧА #$id НЕ ПРОЙДЕНА"
  }

  $state.tasks = $stateTasks
  Write-Text $StatePath ($state | ConvertTo-Json -Depth 10)
  Update-Report

  if ($failed -gt 0 -and $stopOnFailure) {
    Warn "Остановка: задача провалена, дальше не иду (stopOnFailure=true)."
    break
  }
}

# ---------------------------------------------------------------------------
# 4. Итог
# ---------------------------------------------------------------------------
Update-Report
Write-Host ""
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host ("  ИТОГ: готово {0}, провалено {1}, пропущено {2}" -f $done, $failed, $skipped) -ForegroundColor Magenta
Write-Host "  Отчёт:  НОЧНОЙ-ОТЧЁТ.md" -ForegroundColor Magenta
Write-Host "  Скрины: screenshots\task<id>\" -ForegroundColor Magenta
Write-Host "  Логи:   logs\" -ForegroundColor Magenta
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host ""

if ($DryRun) { Warn "Это был DRY-RUN: код не менялся." }
if ($failed -gt 0) { exit 1 }
exit 0
