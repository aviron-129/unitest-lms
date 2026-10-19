<#
  night-run.ps1 — ночной автономный раннер UniTest.
  Один запуск = одна задача = проверка = коммит. Следующая задача только после зелёных проверок.

  Запуск (обычно через ЗАПУСТИТЬ-НОЧЬ.cmd):
    powershell -NoProfile -ExecutionPolicy Bypass -File .\night-run.ps1

  Полезные режимы:
    -DryRun            показать план и промты, ничего не запускать
    -Only 22           выполнить только задачу №22
    -MaxTasks 3        ограничить число основных задач
    -Force             перезапустить даже выполненные задачи
    -NoKeepAwake       не менять настройки сна Windows
    -Child             внутренний режим для watchdog (без lock и powercfg)
#>
param(
  [switch]$DryRun,
  [switch]$Force,
  [string]$Only = "",
  [int]$MaxTasks = 0,
  [switch]$NoKeepAwake,
  [switch]$Child
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
$LockPath    = Join-Path $Root "night.lock"
$StopPath    = Join-Path $Root "night.stop"
$DonePath    = Join-Path $Root "night.done"

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
function Get-SessionEnd([datetime]$Start, [double]$Hours, [string]$Deadline) {
  $end = $Start.AddHours($Hours)
  if ($Deadline) {
    try {
      $parts = $Deadline.Split(":")
      $d = $Start.Date.AddHours([int]$parts[0]).AddMinutes([int]$parts[1])
      if ($d -le $Start) { $d = $d.AddDays(1) }
      if ($d -lt $end) { $end = $d }
    } catch {}
  }
  return $end
}
function New-QualityScenarios([string]$Focus) {
  $width = 1440; $height = 900; $theme = "light"; $lang = "ru"; $mobile = $false
  if ($Focus -match "mobile|320|768") { $width = 390; $height = 844; $mobile = $true }
  if ($Focus -match "тёмн|dark") { $theme = "dark"; $lang = "en" }
  $roles = @(
    @("student", "profile"),
    @("teacher", "dashboard"),
    @("manager", "dashboard"),
    @("admin", "dashboard")
  )
  $list = @()
  foreach ($r in $roles) {
    $list += @{
      name = ("quality-{0}-{1}" -f ($Focus -replace '[^a-zA-Z0-9]+', '-'), $r[0])
      role = $r[0]; section = $r[1]
      width = $width; height = $height; lang = $lang; theme = $theme; mobile = $mobile
      expect = @{ minTextLength = 20 }
    }
  }
  return $list
}
function New-QualityPrompt([string]$Id, [string]$Title, [string]$Focus, [string]$TaskJsonRel, [datetime]$EndAt) {
  return @"
# Ночной аудит $Id — $Title

Ты работаешь автономно. Выполни **ровно один** цикл аудита и не начинай следующий.

## Фокус
$Focus

## Что сделать
1. Найди **одну реальную проблему** в проекте по фокусу (баг, XSS, непереведённая строка,
   сломанная вёрстка, утечка таймера, пустое состояние, плохой контраст и т.п.).
2. Исправь её точечно, не ломая другие панели.
3. Добавь/обнови проверку, если это логично.
4. Прогони проверки (ниже) и сделай скриншоты.
5. Обнови ``progress.md`` / ``План-этапов.md``, если изменил поведение.

Если реальных проблем по фокусу нет — **ничего не меняй**, прогони проверки,
ответь ``AUDIT CLEAN`` и заверши сессию. Это нормальный результат.

## Обязательные проверки
``````powershell
node tests/run-all.js
node tests/verify-screens.js --task-json "$TaskJsonRel"
``````

- ``run-all.js``: синтаксис + 8 наборов + статика/i18n + smoke.
- ``verify-screens.js``: 4 роли, 1440/390, light/dark, ru/uz/en; заглушки, переполнение,
  ``console.error``, селекторы, уникальность скриншотов.

## Запреты
- Не делай ``git commit`` / ``git push`` / ``git reset`` — это работа раннера.
- Не трогай очередь ``night-tasks.json`` и настройки раннера.
- Не оставляй ``index.html`` сломанным.
- До конца сессии: $($EndAt.ToString("HH:mm")).

## В конце ответа
Коротко: что найдено, что исправлено, какие проверки прошли. Или ``AUDIT CLEAN``.
"@
}

# ---------------------------------------------------------------------------
# 0. Блокировка от двойного запуска
# ---------------------------------------------------------------------------
if (-not $Child -and -not $DryRun) {
  if (Test-Path $LockPath) {
    $alive = $false
    try {
      $oldLock = Read-Json $LockPath
      if ($oldLock.pid -and (Get-Process -Id ([int]$oldLock.pid) -ErrorAction SilentlyContinue)) { $alive = $true }
    } catch {}
    if ($alive) {
      Err "Ночной раннер уже работает (night.lock). Второй запуск не нужен."
      exit 0
    }
    try { [IO.File]::Delete($LockPath) } catch {}
  }
  Write-Text $LockPath (@{ pid = $PID; started = (Get-Date).ToString("o") } | ConvertTo-Json)
}

# ---------------------------------------------------------------------------
# 1. Проверки окружения
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
$limit = 0
if ($null -ne $s.maxTasks) { $limit = [int]$s.maxTasks }
if ($MaxTasks -gt 0) { $limit = $MaxTasks }
$maxHours = 10
if ($s.maxHours) { $maxHours = [double]$s.maxHours }
$timeoutMin = 90
if ($s.taskTimeoutMinutes) { $timeoutMin = [int]$s.taskTimeoutMinutes }
$stopOnFailure = $false
if ($null -ne $s.stopOnFailure) { $stopOnFailure = [bool]$s.stopOnFailure }
$maxAttempts = 2
if ($s.maxAttempts) { $maxAttempts = [int]$s.maxAttempts }
$retryFailed = $true
if ($null -ne $s.retryFailed) { $retryFailed = [bool]$s.retryFailed }
$qualityMode = $true
if ($null -ne $s.qualityMode) { $qualityMode = [bool]$s.qualityMode }
$qualityDelay = 300
if ($s.qualityDelaySeconds) { $qualityDelay = [int]$s.qualityDelaySeconds }
$deadline = ""
if ($s.deadline) { $deadline = [string]$s.deadline }
if ($Only) { $qualityMode = $false }

$stateTasks = @{}
$oldState = $null
if (Test-Path $StatePath) {
  try {
    $oldState = Read-Json $StatePath
    if ($oldState.tasks) {
      foreach ($p in $oldState.tasks.PSObject.Properties) { $stateTasks[$p.Name] = $p.Value }
    }
  } catch {
    Warn "Старый night-state.json повреждён — начинаю с чистого состояния"
  }
}

# Сессия: начало и конец. При перезапуске watchdog'ом продолжаем ту же сессию.
$startedAt = Get-Date
$endAt = $null
if ($oldState -and $oldState.session) {
  try { if ($oldState.session.started) { $startedAt = [datetime]::Parse($oldState.session.started) } } catch {}
  try { if ($oldState.session.endAt) { $endAt = [datetime]::Parse($oldState.session.endAt) } } catch {}
}
if (-not $endAt -or $endAt -le (Get-Date)) {
  $startedAt = Get-Date
  $endAt = Get-SessionEnd $startedAt $maxHours $deadline
}
$state = @{
  started = $startedAt.ToString("o")
  session = @{ started = $startedAt.ToString("o"); endAt = $endAt.ToString("o") }
  tasks = $stateTasks
}

$tasks = @($queue.tasks)
if ($Only) { $tasks = @($tasks | Where-Object { [string]$_.id -eq $Only }) }
if ($tasks.Count -eq 0) { Err "Задача '$Only' не найдена в night-tasks.json"; exit 1 }

# Подхватываем выполненные задачи из progress.md (если state потерялся/перебит)
$progressDone = @()
$progressPath = Join-Path $Root "progress.md"
if (Test-Path $progressPath) {
  $ptext = Get-Content -Raw -Encoding UTF8 $progressPath
  $progressDone = @([regex]::Matches($ptext, '- \[x\]\s+\*\*№([0-9.]+)\*\*') | ForEach-Object { $_.Groups[1].Value })
}
foreach ($t in $tasks) {
  $tid = [string]$t.id
  if ($stateTasks.ContainsKey($tid)) {
    $entry = $stateTasks[$tid]
    if ($entry.status -eq "running") { $entry.status = "pending" }
    if (($progressDone -contains $tid) -and $entry.status -ne "done") {
      $entry.status = "done"; $entry.source = "progress.md"; $entry.finished = (Get-Date).ToString("o")
    }
  } elseif ($progressDone -contains $tid) {
    $stateTasks[$tid] = @{ status = "done"; attempts = 0; source = "progress.md"; finished = (Get-Date).ToString("o") }
  }
}
$state.tasks = $stateTasks
if (-not $DryRun) { Write-Text $StatePath ($state | ConvertTo-Json -Depth 10) }

# ---------------------------------------------------------------------------
# 1.0 Если предыдущий запуск был прерван — сохраняем WIP и откатываем к checkpoint
# ---------------------------------------------------------------------------
if (-not $DryRun) {
  $runningIds = @($stateTasks.Keys | Where-Object { $stateTasks[$_].status -eq "running" })
  foreach ($rid in $runningIds) {
    $entry = $stateTasks[$rid]
    $cp = $null
    if ($entry.checkpoint) { $cp = [string]$entry.checkpoint }
    if ($cp) {
      $istamp = Get-Date -Format "yyyyMMdd-HHmmss"
      & git add -A 2>&1 | Out-Null
      $idirty = (& git status --porcelain) -join "`n"
      if ($idirty.Trim().Length -gt 0) {
        & git commit -m "wip($rid): прервано" 2>&1 | Out-Null
      }
      $ibr = "wip/$rid/interrupted-$istamp"
      & git branch $ibr HEAD 2>$null | Out-Null
      & git reset --hard $cp 2>&1 | Out-Null
      Ok "Прерванная задача #${rid}: WIP в $ibr, откат к $cp"
    }
    if ($rid -like "q*") { $entry.status = "failed"; $entry.interrupted = $true }
    else { $entry.status = "pending" }
  }
  if ($runningIds.Count -gt 0) {
    $state.tasks = $stateTasks
    Write-Text $StatePath ($state | ConvertTo-Json -Depth 10)
  }
}

# ---------------------------------------------------------------------------
# 1.1 Проверка здоровья базы: синтаксис + полный регресс
# ---------------------------------------------------------------------------
if (-not $DryRun) {
  & node "tests\check.js" *> (Join-Path $LogDir "startup-check.log")
  if ($LASTEXITCODE -ne 0) {
    Warn "index.html не проходит синтаксис — восстанавливаю из git (патч сохраняю в logs/)..."
    $patch = Join-Path $LogDir ("recovery-{0}.patch" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
    & git diff > $patch 2>$null
    & git checkout -- . 2>$null
    & node "tests\check.js" *> (Join-Path $LogDir "startup-check2.log")
    if ($LASTEXITCODE -ne 0) {
      $latest = Get-ChildItem $BackupDir -Filter "index_*.html" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if ($latest) { Copy-Item $latest.FullName (Join-Path $Root "index.html") -Force }
      & node "tests\check.js" *> (Join-Path $LogDir "startup-check3.log")
    }
    if ($LASTEXITCODE -ne 0) { Err "Не удалось восстановить index.html"; exit 1 }
    Ok "index.html восстановлен, продолжаю"
  }

  & node "tests\run-all.js" *> (Join-Path $LogDir "startup-tests.log")
  if ($LASTEXITCODE -ne 0) {
    Warn "База красная на старте — откатываю рабочую копию к HEAD и проверяю снова..."
    $patch = Join-Path $LogDir ("recovery-tests-{0}.patch" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
    & git diff > $patch 2>$null
    & git checkout -- . 2>$null
    & node "tests\run-all.js" *> (Join-Path $LogDir "startup-tests2.log")
    if ($LASTEXITCODE -ne 0) { Err "База красная даже после отката. Смотри logs/startup-tests2.log"; exit 1 }
    Ok "База восстановлена до HEAD"
  } else {
    Ok "Стартовый регресс: зелёный"
  }

  # Фиксируем любые незакоммиченные правки, чтобы откат не потерял их
  $dirty = (& git status --porcelain) -join "`n"
  if ($dirty.Trim().Length -gt 0) {
    Step "Фиксирую незакоммиченные изменения перед стартом..."
    & git add -A 2>&1 | Out-Null
    & git commit -m "checkpoint: перед ночной сессией" 2>&1 | Out-Null
    Ok "Checkpoint создан"
  }
}

Write-Host ""
Ok "Модель: $model"
$limitLabel = "без лимита"
if ($limit -gt 0) { $limitLabel = "$limit задач" }
Ok ("Лимит основных задач: {0} / сессия до {1} / таймаут {2} мин" -f $limitLabel, $endAt.ToString("dd.MM HH:mm"), $timeoutMin)
Ok ("Очередь: " + (($tasks | ForEach-Object { "#" + $_.id }) -join ", "))
Ok ("Провал задачи: " + $(if ($stopOnFailure) { "стоп" } else { "откат + продолжаю" }))
Ok ("После очереди: " + $(if ($qualityMode) { "режим аудита до конца сессии" } else { "остановка" }))
Write-Host ""

if (-not $NoKeepAwake -and -not $DryRun -and -not $Child) {
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
  $lines.Add("- Конец сессии: **" + $endAt.ToString("dd.MM.yyyy HH:mm") + "**")
  $lines.Add("- Модель: ``" + $model + "``")
  $lines.Add("- Задач в очереди: **" + $tasks.Count + "** + режим аудита: **" + $qualityMode + "**")
  $lines.Add("")
  $lines.Add("| # | Задача | Статус | Тесты | Скрины | Коммит | Лог |")
  $lines.Add("|---|--------|--------|-------|--------|--------|-----|")

  $qualityIds = @($stateTasks.Keys | Where-Object { $_ -like "q*" } | Sort-Object { [int](($_ -replace "[^0-9]", "")) })
  if ($qualityIds.Count -gt 20) { $qualityIds = $qualityIds | Select-Object -Last 20 }
  $reportTasks = @($tasks)
  foreach ($qid in $qualityIds) {
    $qtitle = "Аудит"
    if ($stateTasks[$qid] -and $stateTasks[$qid].title) { $qtitle = $stateTasks[$qid].title }
    $reportTasks += [pscustomobject]@{ id = $qid; title = $qtitle }
  }

  foreach ($t in $reportTasks) {
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
  $lines.Add("6. Проваленные задачи: ветки ``wip/<id>/<время>`` (``git branch --list wip/*``).")
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
$mainIndex = 0
$qualityRound = 0
$retryPassDone = $false
foreach ($k in $stateTasks.Keys) {
  if ($k -match '^q(\d+)$') {
    $n = [int]$Matches[1]
    if ($n -gt $qualityRound) { $qualityRound = $n }
  }
}
$focusList = @($queue.qualityFocus)
if (-not $focusList -or $focusList.Count -eq 0) {
  $focusList = @("security/XSS", "logic/timers", "i18n", "mobile 320-768", "dark theme", "empty states")
}

while ($true) {
  if ((Get-Date) -gt $endAt) { Warn "Вышло время сессии — останавливаюсь"; break }
  if (Test-Path $StopPath) { Warn "Найден night.stop — аккуратно останавливаюсь"; break }

  $task = $null
  $isQuality = $false

  if ($mainIndex -lt $tasks.Count) {
    if ($limit -gt 0 -and $processed -ge $limit) {
      Warn "Лимит основных задач ($limit) достигнут — перехожу в режим аудита"
      $mainIndex = $tasks.Count
    } else {
      $task = $tasks[$mainIndex]
      $mainIndex++
    }
  }

  if (-not $task) {
    if (-not $retryPassDone -and $retryFailed) {
      $retryable = @($tasks | Where-Object {
        $rid = [string]$_.id
        $stateTasks.ContainsKey($rid) -and $stateTasks[$rid].status -eq "failed" -and [int]$stateTasks[$rid].attempts -lt $maxAttempts
      })
      if ($retryable.Count -gt 0) {
        Step ("Повторная попытка: " + (($retryable | ForEach-Object { "#" + $_.id }) -join ", "))
        $retryPassDone = $true
        $limit = 0
        $mainIndex = 0
        continue
      }
      $retryPassDone = $true
    }

    if (-not $qualityMode) { break }
    $qualityRound++
    $focus = $focusList[($qualityRound - 1) % $focusList.Count]
    $task = [pscustomobject]@{
      id = "q$qualityRound"
      title = "Аудит ${qualityRound}: $focus"
      quality = $true
      focus = $focus
      promptFile = ""
      notes = "Фокус: $focus. Найди одну реальную проблему или ответь AUDIT CLEAN."
      verify = @{ scenarios = (New-QualityScenarios $focus) }
    }
    $isQuality = $true
  }

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
    if ($prev.status -eq "blocked") {
      Step "Задача #$id заблокирована — пропускаю"
      $skipped++
      continue
    }
    if ($prev.status -eq "failed" -and [int]$prev.attempts -ge $maxAttempts) {
      Step "Задача #$id исчерпала попытки ($maxAttempts) — пропускаю"
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

  # 3.1 Точка отката и бэкап
  $checkpoint = (& git rev-parse HEAD).Trim()
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $backup = Join-Path $BackupDir ("index_{0}_{1}.html" -f $id, $stamp)
  Copy-Item (Join-Path $Root "index.html") $backup -Force
  Ok "Бэкап: backups\$(Split-Path $backup -Leaf) | checkpoint: $checkpoint"

  # 3.2 Промт
  $promptPath = Join-Path $PromptDir ("{0}.md" -f $id)
  $taskJsonPath = Join-Path $PromptDir ("{0}.task.json" -f $id)
  $taskJsonRel = (Rel $taskJsonPath).Replace("\", "/")

  if ($isQuality) {
    Write-Text $taskJsonPath ($task | ConvertTo-Json -Depth 20)
    $promptText = New-QualityPrompt $id $title ([string]$task.focus) $taskJsonRel $endAt
  } else {
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

- ``run-all.js``: синтаксис + 8 наборов + статика/i18n + smoke.
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
  }
  Write-Text $promptPath $promptText
  Ok ("Промт: " + (Rel $promptPath))

  $logPath = Join-Path $LogDir ("night-{0}-{1}.log" -f $id, $stamp)
  $errPath = "$logPath.err"

  $stateTasks[$id] = @{
    status = "running"; attempts = $attempt; started = (Get-Date).ToString("o");
    title = $title; checkpoint = $checkpoint;
    tests = $null; screens = $null; commit = $null; log = (Rel $logPath)
  }
  $state.tasks = $stateTasks
  if (-not $DryRun) { Write-Text $StatePath ($state | ConvertTo-Json -Depth 10) }

  # 3.3 Запуск opencode
  $argList = @(
    "run", "--auto", "--agent", "night", "--model", $model,
    "--title", "Night $id",
    "--file", $promptPath,
    "Execute exactly one task from the attached file. Work autonomously, do not ask questions."
  )
  $argString = (($argList | ForEach-Object { Quote-Arg ([string]$_) }) -join " ")

  if ($DryRun) {
    Warn "DRY-RUN: не запускаю. Команда:"
    Write-Host ("  `"" + $OpenCodeExe + "`" " + $argString) -ForegroundColor DarkGray
    $stateTasks[$id] = @{ status = "pending"; attempts = 0; title = $title; tests = $null; screens = $null; commit = $null; log = $null }
    if ($isQuality) { break } else { continue }
  }

  Step "Запускаю opencode (таймаут $timeoutMin мин)..."
  $proc = $null
  try {
    $proc = Start-Process -FilePath $OpenCodeExe -ArgumentList $argString -WorkingDirectory $Root `
      -RedirectStandardOutput $logPath -RedirectStandardError $errPath -PassThru -WindowStyle Hidden
  } catch {
    Err "Не удалось запустить opencode: $($_.Exception.Message)"
  }
  if (-not $proc) {
    $stateTasks[$id] = @{
      status = "failed"; attempts = $attempt; finished = (Get-Date).ToString("o");
      title = $title; tests = 1; screens = 1; commit = $null; log = (Rel $logPath)
    }
    $failed++
    Append-Text $BlockersPath ("`r`n## ❌ Задача #$id — $title`r`n`r`n- opencode не запустился`r`n")
    $state.tasks = $stateTasks
    Write-Text $StatePath ($state | ConvertTo-Json -Depth 10)
    if ($stopOnFailure) { break } else { continue }
  }

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

  Step "ПРОВЕРКА 2/2: скриншоты + DOM"
  $screenLog = "$logPath.screens"
  if ($isQuality) {
    & node "tests\verify-screens.js" --task-json $taskJsonPath 2>&1 | Tee-Object -FilePath $screenLog | Out-Host
  } else {
    & node "tests\verify-screens.js" --task $id 2>&1 | Tee-Object -FilePath $screenLog | Out-Host
  }
  $screenExit = $LASTEXITCODE
  if ($screenExit -eq 0) { Ok "скриншоты: зелёно" } else { Err "скриншоты: КРАСНО (exit $screenExit)" }

  # 3.5 Коммит / откат
  & git add -A 2>&1 | Out-Null
  $changes = (& git status --porcelain) -join "`n"
  $commitHash = ""

  if ($testExit -eq 0 -and $screenExit -eq 0) {
    if ($changes.Trim().Length -gt 0) {
      $kind = if ($isQuality) { "audit" } else { "task" }
      & git commit -m "${kind}($id): $title" 2>&1 | Out-Null
      $commitHash = (& git rev-parse --short HEAD).Trim()
    } elseif (-not $isQuality) {
      & git commit --allow-empty -m "task($id): $title (no changes)" 2>&1 | Out-Null
      $commitHash = (& git rev-parse --short HEAD).Trim()
    } else {
      $commitHash = "none"
    }
    $stateTasks[$id] = @{
      status = "done"; attempts = $attempt; finished = (Get-Date).ToString("o");
      title = $title; checkpoint = $checkpoint;
      tests = $testExit; screens = $screenExit; commit = $commitHash;
      log = (Rel $logPath)
    }
    $done++
    Ok "ЗАДАЧА #$id ЗАКРЫТА. Коммит: $commitHash"
  } else {
    # Сохраняем WIP в отдельную ветку и откатываем рабочую копию к checkpoint
    $wipHash = ""
    if ($changes.Trim().Length -gt 0) {
      & git commit -m "wip($id): проверки красные" 2>&1 | Out-Null
      $wipHash = (& git rev-parse --short HEAD).Trim()
    }
    $wipBranch = "wip/$id/$stamp"
    & git branch $wipBranch HEAD 2>$null | Out-Null
    if ($checkpoint) { & git reset --hard $checkpoint 2>&1 | Out-Null }
    & node "tests\check.js" *> (Join-Path $LogDir "post-rollback-check.log")
    if ($LASTEXITCODE -ne 0) { Err "После отката index.html не проходит синтаксис — проверь logs/post-rollback-check.log" }

    $stateTasks[$id] = @{
      status = "failed"; attempts = $attempt; finished = (Get-Date).ToString("o");
      title = $title; checkpoint = $checkpoint; wipBranch = $wipBranch;
      tests = $testExit; screens = $screenExit; commit = $wipHash;
      log = (Rel $logPath)
    }
    $failed++
    $block = @(
      "", "## ❌ Задача #$id — $title", "",
      "- run-all: **$testExit**", "- скриншоты: **$screenExit**", "- opencode: **$runExit**",
      "- откат к: ``$checkpoint``", "- WIP-ветка: ``$wipBranch``",
      "- лог: ``$(Rel $logPath)``",
      "- скриншоты: ``screenshots/task$id/``",
      "- тесты: ``$(Rel $testLog)``",
      "- проверка экранов: ``$(Rel $screenLog)``",
      ""
    ) -join "`r`n"
    Append-Text $BlockersPath $block
    Err "ЗАДАЧА #$id НЕ ПРОЙДЕНА — откатил к $checkpoint, иду дальше"
  }

  $state.tasks = $stateTasks
  Write-Text $StatePath ($state | ConvertTo-Json -Depth 10)
  Update-Report

  if ($failed -gt 0 -and $stopOnFailure) {
    Warn "Остановка: задача провалена, дальше не иду (stopOnFailure=true)."
    break
  }
  if ($isQuality -and $qualityDelay -gt 0 -and (Get-Date) -lt $endAt) {
    Step "Пауза $qualityDelay c перед следующим аудитом..."
    Start-Sleep -Seconds $qualityDelay
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

if (-not $Child) {
  try { if (Test-Path $LockPath) { [IO.File]::Delete($LockPath) } } catch {}
  if (-not $DryRun) { Write-Text $DonePath ((Get-Date).ToString("o")) }
}

if ($failed -gt 0) {
  Warn "Провалено задач: $failed. Они откачены к checkpoint, WIP — в ветках wip/*. Смотри night-blockers.md."
}
exit 0
