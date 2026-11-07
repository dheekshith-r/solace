# Rebuilds the Solace release APK and copies it to the Desktop. Run from anywhere:
#   pwsh C:\Users\dheek\solace\build-apk.ps1
# Needs: Node, JDK 17 at the path below, the Android SDK, and apps/mobile/.env containing
# EXPO_PUBLIC_API_URL=https://solace-api-sg.onrender.com (gitignored; copy .env.example if missing).
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$env:JAVA_HOME = 'C:\Users\dheek\.jdks\jdk-17.0.21.0.2+1'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:NODE_ENV = 'production'

# 1. The API URL is compiled into the app: refuse to build without it.
$envFile = Join-Path $root 'apps\mobile\.env'
if (-not (Select-String -Path $envFile -Pattern '^EXPO_PUBLIC_API_URL=https://' -Quiet -ErrorAction SilentlyContinue)) {
  throw "Set EXPO_PUBLIC_API_URL=https://solace-api-sg.onrender.com in $envFile first."
}

# 2. Dependencies (only installs what is missing).
Push-Location $root; npm install; Pop-Location

# 3. Only after changing app.config.ts or native packages: uncomment to regenerate android/.
# Push-Location (Join-Path $root 'apps\mobile'); npx expo prebuild --platform android --no-install; Pop-Location

# 4. Build. Close other heavy apps first: the laptop runs out of memory with a second build or the API tests.
Push-Location (Join-Path $root 'apps\mobile\android')
.\gradlew.bat assembleRelease --max-workers=3 --console=plain --no-daemon
Pop-Location

# 5. Copy it out, named with the commit it was built from.
$apk = Join-Path $root 'apps\mobile\android\app\build\outputs\apk\release\app-release.apk'
$commit = (git -C $root rev-parse --short HEAD)
$dest = "$env:USERPROFILE\Desktop\Solace-$commit.apk"
Copy-Item $apk $dest -Force
"Built $dest ({0:N1} MB)" -f ((Get-Item $dest).Length / 1MB)
# Install on a USB-connected phone (not pinned):  & "$env:ANDROID_HOME\platform-tools\adb.exe" install -r $dest
