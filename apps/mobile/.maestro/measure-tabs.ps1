# Ticket 08b measurement. Only after Ddk approves the run and pins Solace (signed in, on Today).
#   pwsh apps/mobile/.maestro/measure-tabs.ps1
$ErrorActionPreference = 'Stop'
$env:JAVA_HOME = 'C:\Users\dheek\.jdks\jdk-17.0.21.0.2+1'
$maestro = (Get-Command maestro -ErrorAction SilentlyContinue)?.Source ?? "$env:USERPROFILE\.maestro\maestro\bin\maestro.bat"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$pkg = 'com.ddk.solace'

# Read-only: PSS and its parts from dumpsys meminfo, in MB.
function Mem($label) {
  $m = & $adb shell dumpsys meminfo $pkg
  $pick = { param($name) $l = $m | Select-String -Pattern "^\s*$name" | Select-Object -First 1; if ($l) { [math]::Round([int](($l.Line -split '\s+' | Where-Object { $_ -match '^\d+$' })[0]) / 1024, 1) } }
  [pscustomobject]@{ when = $label; pss = & $pick 'TOTAL PSS:'; native = & $pick 'Native Heap:'; graphics = & $pick 'Graphics:'; java = & $pick 'Java Heap:' }
}
function Targets { (& $adb shell dumpsys gfxinfo $pkg | Select-String -Pattern '1220x2712|2712x1220').Count }

$rows = @(Mem 'start (on Today)'); $t0 = Targets
& $maestro test (Join-Path $PSScriptRoot 'tabs-memory.yaml')
$status = $LASTEXITCODE
$rows += Mem 'after 60 switches'
Start-Sleep -Seconds 45
$rows += Mem 'after 45 s idle on Today'
$rows | Format-Table -AutoSize
"full-screen render targets: start $t0, end $(Targets)"
"PSS change: $([math]::Round($rows[-1].pss - $rows[0].pss, 1)) MB (target: within 10 MB)"
"Maestro exit code: $status"
