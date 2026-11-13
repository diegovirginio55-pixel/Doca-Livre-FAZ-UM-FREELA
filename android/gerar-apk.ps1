# Gera o instalador do aplicativo Android do fazumfreela neste computador, assinado com a chave local.
#
#   powershell -ExecutionPolicy Bypass -File android\gerar-apk.ps1
#
# O que faz: compila a pasta android/, assina com android\assinatura\fazumfreela-release.p12, confere se a assinatura
# e a que o site declara em public\.well-known\assetlinks.json e copia o APK para public\app\fazumfreela.apk, que e o
# arquivo do botao "Baixar o app" (menu Aplicativo). Depois e so publicar o site.
#
# Precisa, uma vez so, do Android SDK com a plataforma 34 (o mesmo do app do WMS). Se faltar, o script mostra o
# comando para instalar (a instalacao pede que VOCE aceite os termos de licenca do Android).
#
# A chave (android\assinatura) nao vai para o GitHub. Guarde uma copia dela e da senha em lugar seguro: sem ela, uma
# versao nova do app nao instala por cima da anterior.
$ErrorActionPreference = 'Stop'
$projeto = Split-Path -Parent $PSScriptRoot
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$gradle = "$env:LOCALAPPDATA\doca-livre-android\gradle-8.9\bin\gradle.bat"
$chave = Join-Path $PSScriptRoot 'assinatura\fazumfreela-release.p12'
$senha = Join-Path $PSScriptRoot 'assinatura\senha.txt'
$assetlinks = Join-Path $projeto 'public\.well-known\assetlinks.json'

if (-not (Test-Path "$sdk\platforms\android-34") -or -not (Test-Path "$sdk\build-tools")) {
    Write-Host "Falta instalar a plataforma do Android (uma vez so). Rode este comando e responda 'y' para aceitar as licencas:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  & `"$sdk\cmdline-tools\latest\bin\sdkmanager.bat`" --sdk_root=`"$sdk`" `"platform-tools`" `"platforms;android-34`" `"build-tools;34.0.0`""
    Write-Host ""
    Write-Host "Depois rode este script de novo."
    exit 1
}
foreach ($arquivo in @($gradle, $chave, $senha, $assetlinks)) {
    if (-not (Test-Path $arquivo)) { Write-Host "Nao encontrei: $arquivo" -ForegroundColor Red; exit 1 }
}

# cada instalador novo precisa de um numero de versao maior, para instalar por cima do anterior
$arquivoVersao = Join-Path $PSScriptRoot 'versao.txt'
$versao = 1 + [int](Get-Content $arquivoVersao -ErrorAction SilentlyContinue | Select-Object -First 1)

$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:ANDROID_KEYSTORE_FILE = $chave
$env:ANDROID_KEYSTORE_PASSWORD = (Get-Content $senha -Raw).Trim()
$env:VERSION_CODE = "$versao"

Push-Location $PSScriptRoot
try {
    & $gradle --no-daemon assembleRelease
    if ($LASTEXITCODE -ne 0) { Write-Host "A compilacao falhou." -ForegroundColor Red; exit 1 }
} finally {
    Pop-Location
    $env:ANDROID_KEYSTORE_PASSWORD = $null
}

$apk = Join-Path $PSScriptRoot 'app\build\outputs\apk\release\app-release.apk'
$apksigner = Get-ChildItem "$sdk\build-tools\*\apksigner.bat" | Sort-Object FullName | Select-Object -Last 1
$saida = & $apksigner.FullName verify --print-certs $apk
$impressao = (($saida | Select-String 'SHA-256' | Select-Object -First 1).ToString() -replace '.*:\s*', '').ToUpper()
$declarada = ((Get-Content $assetlinks -Raw | ConvertFrom-Json)[0].target.sha256_cert_fingerprints[0] -replace ':', '').ToUpper()
if ($impressao -ne $declarada) {
    Write-Host "A chave que assinou o APK nao e a que o site declara (assetlinks). Nada foi copiado." -ForegroundColor Red
    exit 1
}

$destino = Join-Path $projeto 'public\app'
New-Item -ItemType Directory -Force $destino | Out-Null
$final = Join-Path $destino 'fazumfreela.apk'
Copy-Item $apk $final -Force
Set-Content $arquivoVersao "$versao" -Encoding ascii
$tamanho = [math]::Round((Get-Item $final).Length / 1MB, 1)
# a tela Aplicativo do site le este arquivo para mostrar a versao e o tamanho do instalador
$info = [ordered]@{ versao = "1.0.$versao"; tamanhoMb = $tamanho; geradoEm = (Get-Date).ToString('yyyy-MM-dd') }
[System.IO.File]::WriteAllText((Join-Path $destino 'versao.json'), ($info | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding $false))
Write-Host ""
Write-Host "APK gerado: public\app\fazumfreela.apk (versao 1.0.$versao, $tamanho MB), assinatura conferida." -ForegroundColor Green
Write-Host "Agora publique o site para o botao 'Baixar o app' passar a entregar esta versao."
