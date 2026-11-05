# Compila y firma la APK de MooPing sin Gradle: aapt2 -> javac -> d8 -> zipalign -> apksigner.
#   powershell -ExecutionPolicy Bypass -File build.ps1
# Necesita un JDK 17+ en el PATH y el SDK de Android (build-tools 35.0.0 y platforms;android-35).
# Si el SDK no está, lo baja a %LOCALAPPDATA%\Android\Sdk.
# La clave de firma vive FUERA del repo (%USERPROFILE%\.mooping\mooping-release.jks). Guardá una copia:
# sin la misma clave, los celulares no aceptan actualizar la app.
# 'Continue': las herramientas escriben avisos por stderr; los errores se miran con $LASTEXITCODE.
$ErrorActionPreference = 'Continue'
$here = $PSScriptRoot
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$bt = Join-Path $sdk 'build-tools\35.0.0'
$jar = Join-Path $sdk 'platforms\android-35\android.jar'

if (-not (Test-Path $jar) -or -not (Test-Path $bt)) {
  Write-Host 'Instalando el SDK de Android en' $sdk
  $clt = Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat'
  if (-not (Test-Path $clt)) {
    New-Item -ItemType Directory -Force (Join-Path $sdk 'cmdline-tools') | Out-Null
    $zip = Join-Path $env:TEMP 'android-clt.zip'
    Invoke-WebRequest 'https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip' -OutFile $zip
    Expand-Archive $zip (Join-Path $sdk 'cmdline-tools') -Force
    Rename-Item (Join-Path $sdk 'cmdline-tools\cmdline-tools') 'latest'
  }
  ('y`n' * 20) | & $clt "--sdk_root=$sdk" --licenses | Out-Null
  & $clt "--sdk_root=$sdk" 'platforms;android-35' 'build-tools;35.0.0'
}

$out = Join-Path $here 'build'
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Force "$out\gen", "$out\classes", "$out\dex" | Out-Null

# Versión: la del AndroidManifest.xml
[xml]$manifest = Get-Content (Join-Path $here 'AndroidManifest.xml')
$ver = $manifest.manifest.versionName

Write-Host '1/6 Recursos'
& "$bt\aapt2.exe" compile --dir (Join-Path $here 'res') -o "$out\res.zip"
if ($LASTEXITCODE) { throw 'aapt2 compile' }
& "$bt\aapt2.exe" link -o "$out\base.apk" -I $jar --manifest (Join-Path $here 'AndroidManifest.xml') `
  -A (Join-Path $here 'assets') --java "$out\gen" --min-sdk-version 24 --target-sdk-version 35 "$out\res.zip"
if ($LASTEXITCODE) { throw 'aapt2 link' }

Write-Host '2/6 Java'
$sources = @(Get-ChildItem -Recurse -Filter *.java (Join-Path $here 'src'), "$out\gen" | ForEach-Object FullName)
& javac --release 17 -nowarn -encoding UTF-8 -classpath $jar -d "$out\classes" @sources
if ($LASTEXITCODE) { throw 'javac' }

Write-Host '3/6 Dex'
$classes = @(Get-ChildItem -Recurse -Filter *.class "$out\classes" | ForEach-Object FullName)
& "$bt\d8.bat" --release --min-api 24 --lib $jar --output "$out\dex" @classes
if ($LASTEXITCODE) { throw 'd8' }

Write-Host '4/6 Empaquetado'
Copy-Item "$out\base.apk" "$out\unaligned.apk"
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open("$out\unaligned.apk", 'Update')
[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, "$out\dex\classes.dex", 'classes.dex') | Out-Null
$zip.Dispose()
& "$bt\zipalign.exe" -p -f 4 "$out\unaligned.apk" "$out\aligned.apk"
if ($LASTEXITCODE) { throw 'zipalign' }

Write-Host '5/6 Clave de firma'
$keyDir = Join-Path $env:USERPROFILE '.mooping'
$ks = Join-Path $keyDir 'mooping-release.jks'
$passFile = Join-Path $keyDir 'mooping-release.pass'
if (-not (Test-Path $ks)) {
  New-Item -ItemType Directory -Force $keyDir | Out-Null
  $pass = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
  [IO.File]::WriteAllText($passFile, $pass)
  $keytool = (Get-Command keytool -ErrorAction SilentlyContinue).Source
  if (-not $keytool -and $env:JAVA_HOME) { $keytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe' }
  if (-not $keytool -or -not (Test-Path $keytool)) {
    $keytool = Get-ChildItem 'C:\Program Files\Java', 'C:\Program Files\Eclipse Adoptium', 'C:\Program Files\Microsoft' -Recurse -Filter keytool.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
  }
  if (-not $keytool) { throw 'No encuentro keytool (viene con el JDK). Definí JAVA_HOME.' }
  & $keytool -genkeypair -keystore $ks -alias mooping -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass $pass -keypass $pass -dname 'CN=MooPing, O=MooPing, C=AR' 2>&1 | Out-Null
  if ($LASTEXITCODE) { throw 'keytool' }
  Write-Host "  Nueva clave en $ks. GUARDÁ UNA COPIA de esa carpeta."
}

Write-Host '6/6 Firma'
New-Item -ItemType Directory -Force (Join-Path $here 'release') | Out-Null
$apk = Join-Path $here 'release\MooPing.apk'
& "$bt\apksigner.bat" sign --ks $ks --ks-key-alias mooping --ks-pass "file:$passFile" `
  --out $apk "$out\aligned.apk"
if ($LASTEXITCODE) { throw 'apksigner' }
Remove-Item "$apk.idsig" -ErrorAction SilentlyContinue

& "$bt\apksigner.bat" verify $apk
if ($LASTEXITCODE) { throw 'apksigner verify' }
Write-Host ("Listo: {0} (v{1}, {2:N0} KB)" -f $apk, $ver, ((Get-Item $apk).Length / 1KB))
