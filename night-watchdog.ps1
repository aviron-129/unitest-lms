<#
  night-watchdog.ps1 — супервизор ночного раннера.
  Держит ночь живой: если night-run.ps1 упал/был убит — перезапускает его
  и продолжает с того же состояния. Останавливается по времени или night.stop.

  Запускается из ЗАПУСТИТЬ-НОЧЬ.cmd (в цикле, если упадёт и сам watchdog).
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

$Runner      = Join-Path $Root "night-run.ps1"
$QueuePath   = Join-Path $Root "night-tasks.json"
$StatePath   = Join-Path $Root "night-state.json"
$DonePath    = Join-Path $Root "night.done"
$StopPath    = Join-Path $Root "night.stop"
$LockPath    = Join-Path $Root "night.lock"
$LogDir      = Join-Path $Root "logs"
$LogPath     = Join-Path $LogDir "watchdog.log"

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
function Write-Text([string]$Path, [string]$Text) {
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}
function Append-Log([string]$Text) {
  if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force -Path $LogDir | Out-Null }
  [System.IO.File]::AppendAllText($LogPath, ("[{0}] {1}`r`n" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Text), $Utf8NoBom)
}
function Read-Json([string]$Path) { return (Get-Content -Raw -Encoding UTF8 $Path | ConvertFrom-Json) }
function Step([string]$Msg) { Write-Host ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $Msg) -ForegroundColor Cyan; Append-Log $Msg }
function Ok([string]$Msg)   { Write-Host ("[{0}] OK   {1}" -f (Get-Date -Format "HH:mm:ss"), $Msg) -ForegroundColor Green; Append-Log ("OK   " + $Msg) }
function Warn([string]$Msg) { Write-Host ("[{0}] !!!  {1}" -f (Get-Date -Format "HH:mm:ss"), $Msg) -ForegroundColor Yellow; Append-Log ("WARN " + $Msg) }
function Err([string]$Msg)  { Write-Host ("[{0}] FAIL {1}" -f (Get-Date -Format "HH:mm:ss"), $Msg) -ForegroundColor Red; Append-Log ("FAIL " + $Msg) }
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

if (-not (Test-Path $Runner)) { Err "Нет night-run.ps1"; Write-Text $DonePath ((Get-Date).ToString("o")); exit 1 }
if (-not (Test-Path $QueuePath)) { Err "Нет night-tasks.json"; Write-Text $DonePath ((Get-Date).ToString("o")); exit 1 }
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force -Path $LogDir | Out-Null }

$queue = Read-Json $QueuePath
$s = $queue.settings
$maxHours = 10
if ($s.maxHours) { $maxHours = [double]$s.maxHours }
$deadline = ""
if ($s.deadline) { $deadline = [string]$s.deadline }
$qualityMode = $true
if ($null -ne $s.qualityMode) { $qualityMode = [bool]$s.qualityMode }

$start = Get-Date
$endAt = $null
if (Test-Path $StatePath) {
  try {
    $st = Read-Json $StatePath
    if ($st.session -and $st.session.endAt) { $endAt = [datetime]::Parse($st.session.endAt) }
  } catch {}
}
if (-not $endAt -or $endAt -le $start) { $endAt = Get-SessionEnd $start $maxHours $deadline }

Write-Host ""
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host "  UniTest — watchdog (раннер перезапускается сам)" -ForegroundColor Magenta
Write-Host "============================================================" -ForegroundColor Magenta
Ok ("Сессия до: " + $endAt.ToString("dd.MM.yyyy HH:mm"))
Ok ("Режим аудита после очереди: " + $qualityMode)
Write-Host ""

# ---------------------------------------------------------------------------
# Одиночные режимы: DryRun / Only — один запуск и выход
# ---------------------------------------------------------------------------
if ($DryRun -or $Only) {
  $runnerArgs = @()
  if ($DryRun) { $runnerArgs += "-DryRun" }
  if ($Only) { $runnerArgs += @("-Only", $Only) }
  if ($Force) { $runnerArgs += "-Force" }
  if ($MaxTasks -gt 0) { $runnerArgs += @("-MaxTasks", [string]$MaxTasks) }
  if ($NoKeepAwake) { $runnerArgs += "-NoKeepAwake" }
  & powershell -NoProfile -ExecutionPolicy Bypass -File $Runner @runnerArgs
  $code = $LASTEXITCODE
  Write-Text $DonePath ((Get-Date).ToString("o"))
  exit $code
}

# ---------------------------------------------------------------------------
# Lock от двойного запуска
# ---------------------------------------------------------------------------
if (Test-Path $LockPath) {
  $alive = $false
  try {
    $old = Read-Json $LockPath
    if ($old.pid -and (Get-Process -Id ([int]$old.pid) -ErrorAction SilentlyContinue)) { $alive = $true }
  } catch {}
  if ($alive) { Err "Watchdog уже работает (night.lock). Второй не нужен."; exit 0 }
  try { [IO.File]::Delete($LockPath) } catch {}
}
Write-Text $LockPath (@{ pid = $PID; started = (Get-Date).ToString("o"); endAt = $endAt.ToString("o") } | ConvertTo-Json)

if (Test-Path $DonePath) { try { [IO.File]::Delete($DonePath) } catch {} }
if (Test-Path $StopPath) { Warn "night.stop уже существует — снимаю, начинаю новую сессию"; try { [IO.File]::Delete($StopPath) } catch {} }

# Сон/гибернация — один раз на всю ночь
if (-not $NoKeepAwake) {
  Step "Отключаю сон/гибернацию (вернуть: powercfg /change standby-timeout-ac 30)"
  foreach ($cmd in @(
    @("standby-timeout-ac", "0"), @("hibernate-timeout-ac", "0"), @("disk-timeout-ac", "0"),
    @("standby-timeout-dc", "0"), @("hibernate-timeout-dc", "0"), @("disk-timeout-dc", "0"),
    @("monitor-timeout-ac", "15")
  )) {
    try { & powercfg /change $cmd[0] $cmd[1] 2>$null | Out-Null } catch {}
  }
  Warn "Ноутбук должен быть в розетке."
}

# ---------------------------------------------------------------------------
# Основной цикл перезапусков
# ---------------------------------------------------------------------------
$restarts = 0
$first = $true
try {
  while ((Get-Date) -lt $endAt -and -not (Test-Path $DonePath)) {
    if (Test-Path $StopPath) { Warn "Найден night.stop — останавливаюсь"; break }

    $runnerArgs = @("-Child")
    if ($MaxTasks -gt 0) { $runnerArgs += @("-MaxTasks", [string]$MaxTasks) }
    if ($NoKeepAwake) { $runnerArgs += "-NoKeepAwake" }
    if ($first -and $Force) { $runnerArgs += "-Force" }
    $first = $false

    Step "Запуск night-run.ps1 (попытка $($restarts + 1))..."
    & powershell -NoProfile -ExecutionPolicy Bypass -File $Runner @runnerArgs
    $code = $LASTEXITCODE

    # Перечитываем конец сессии: раннер мог создать state с другим endAt
    if (Test-Path $StatePath) {
      try {
        $st = Read-Json $StatePath
        if ($st.session -and $st.session.endAt) { $endAt = [datetime]::Parse($st.session.endAt) }
      } catch {}
    }

    if ((Get-Date) -ge $endAt) { Ok "Время сессии вышло"; break }
    if (Test-Path $StopPath) { Warn "night.stop — останавливаюсь"; break }

    # Если аудит выключен и все задачи закрыты — дальше нечего делать
    if ($code -eq 0 -and -not $qualityMode) {
      $pending = 0
      if (Test-Path $StatePath) {
        try {
          $st = Read-Json $StatePath
          foreach ($t in $queue.tasks) {
            $tid = [string]$t.id
            $done = $false
            if ($st.tasks) {
              $p = $st.tasks.PSObject.Properties | Where-Object { $_.Name -eq $tid } | Select-Object -First 1
              if ($p -and $p.Value.status -eq "done") { $done = $true }
            }
            if (-not $done) { $pending++ }
          }
        } catch {}
      }
      if ($pending -eq 0) { Ok "Все задачи закрыты, аудит выключен — завершаю"; break }
    }

    $restarts++
    if ($restarts -gt 20) { Err "Слишком много перезапусков (20) — останавливаюсь"; break }
    $wait = 30
    if ($code -ne 0) { $wait = 60 }
    Warn "Раннер завершился (exit $code). Перезапуск через $wait c (рестарт $restarts/20)..."
    Start-Sleep -Seconds $wait
  }
} finally {
  Write-Text $DonePath ((Get-Date).ToString("o"))
  try { if (Test-Path $LockPath) { [IO.File]::Delete($LockPath) } } catch {}
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host "  Watchdog завершил сессию." -ForegroundColor Magenta
Write-Host "  Отчёт: НОЧНОЙ-ОТЧЁТ.md" -ForegroundColor Magenta
Write-Host "  Логи: logs\\" -ForegroundColor Magenta
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host ""
exit 0
