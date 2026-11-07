# Runs the Solace phone test, and always cleans up the throwaway account (Ddk, Nov 7).
# Only run after Ddk has approved this run and pinned Solace with Android App pinning.
#   pwsh apps/mobile/.maestro/run-phone-test.ps1
param([string]$Api = 'https://solace-api-sg.onrender.com')
$ErrorActionPreference = 'Stop'
$env:JAVA_HOME = 'C:\Users\dheek\.jdks\jdk-17.0.21.0.2+1'
$maestro = (Get-Command maestro -ErrorAction SilentlyContinue)?.Source ?? "$env:USERPROFILE\.maestro\maestro\bin\maestro.bat"

$email = "smoke-$([guid]::NewGuid().ToString('N').Substring(0, 8))@example.com"
$password = 'Smoke' + [guid]::NewGuid().ToString('N').Substring(0, 12)
$out = Join-Path $PSScriptRoot "results\$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Force $out | Out-Null
"Throwaway account: $email"

$status = 1
try {
  Push-Location $out   # screenshots land here
  & $maestro test (Join-Path $PSScriptRoot 'full.yaml') -e "EMAIL=$email" -e "PASSWORD=$password" --format junit --output (Join-Path $out 'report.xml')
  $status = $LASTEXITCODE
} finally {
  Pop-Location
  # Whatever happened, the account must not outlive the run. A 401 at login means it was never
  # created or the flow already deleted it.
  try {
    $body = @{ email = $email; password = $password } | ConvertTo-Json
    $session = Invoke-RestMethod -Uri "$Api/auth/login" -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 60
    $gone = Invoke-WebRequest -Uri "$Api/me" -Method Delete -Headers @{ Authorization = "Bearer $($session.accessToken)" } -SkipHttpErrorCheck -TimeoutSec 60
    "Cleanup: account deleted through the API ($($gone.StatusCode))."
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 401) { 'Cleanup: no account left (already deleted, or never created).' }
    else { "Cleanup FAILED ($code): delete $email by hand." }
  }
}
"Maestro exit code: $status. Screenshots and report: $out"
exit $status
