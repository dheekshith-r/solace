# Before run-phone-test.ps1, with Solace NOT pinned: wipes Solace's data on the phone so the run
# starts from onboarding. Ddk then opens Solace and pins it. Only clears com.ddk.solace.
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$lock = (& $adb shell dumpsys activity activities | Select-String -Pattern 'mLockTaskModeState=\w+' | Select-Object -First 1).Matches.Value
if ($lock -notmatch 'NONE') { 'STOP: Solace is pinned. Unpin it first; clearing a pinned app locks the phone.'; exit 1 }
& $adb shell pm clear com.ddk.solace
'Solace data cleared. Open Solace (it shows onboarding), pin it, then approve the run.'
