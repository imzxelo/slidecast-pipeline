# ============================================================
# Slidecast Pipeline セットアップスクリプト
# ============================================================
# このスクリプトは、Slidecast Pipelineを動かすために必要な
# ソフトウェアを自動でインストールします。
#
# 【このスクリプトがインストールするもの】
# - Chocolatey（ソフトウェアを簡単にインストールするためのツール）
# - Node.js（このアプリを動かすためのプログラム実行環境）
# - ffmpeg（動画を作成するためのツール）
# - poppler（PDFを画像に変換するためのツール）
#
# 【実行方法】
# 1. このファイルを右クリック
# 2.「PowerShellで実行」を選択
# 3. 「管理者として実行しますか？」と聞かれたら「はい」を選択
# ============================================================

# 管理者権限で実行されているか確認
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host " エラー: 管理者権限が必要です" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "このスクリプトを実行するには、管理者権限が必要です。"
    Write-Host ""
    Write-Host "【やり直し方法】"
    Write-Host "1. このウィンドウを閉じてください"
    Write-Host "2. setup.ps1 ファイルを右クリック"
    Write-Host "3.「PowerShellで実行」を選択"
    Write-Host "4.「管理者として実行しますか？」で「はい」を選択"
    Write-Host ""
    Read-Host "Enterキーを押すと、このウィンドウが閉じます"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Slidecast Pipeline セットアップ開始" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "これから必要なソフトウェアをインストールします。"
Write-Host "インターネット接続が必要です。"
Write-Host "完了まで5〜10分程度かかる場合があります。"
Write-Host ""

# ステップ1: Chocolateyのインストール
Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host " ステップ 1/4: Chocolateyの確認" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "Chocolateyは、Windowsでソフトウェアを簡単にインストールするための"
Write-Host "ツールです。これを使って、必要なソフトを自動でインストールします。"
Write-Host ""

if (Get-Command choco -ErrorAction SilentlyContinue) {
    Write-Host "[OK] Chocolateyは既にインストールされています。" -ForegroundColor Green
} else {
    Write-Host "Chocolateyをインストールしています..." -ForegroundColor Cyan
    Write-Host "（少し時間がかかります。お待ちください...）"
    Write-Host ""

    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

    # PATHを更新
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    Write-Host ""
    Write-Host "[OK] Chocolateyのインストールが完了しました。" -ForegroundColor Green
}
Write-Host ""

# ステップ2: Node.jsのインストール
Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host " ステップ 2/4: Node.jsの確認" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "Node.jsは、このアプリケーションを動かすために必要な"
Write-Host "プログラム実行環境です。"
Write-Host ""

if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    Write-Host "[OK] Node.jsは既にインストールされています。（バージョン: $nodeVersion）" -ForegroundColor Green
} else {
    Write-Host "Node.jsをインストールしています..." -ForegroundColor Cyan
    Write-Host "（数分かかる場合があります。お待ちください...）"
    Write-Host ""

    choco install nodejs-lts -y

    # PATHを更新
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    Write-Host ""
    Write-Host "[OK] Node.jsのインストールが完了しました。" -ForegroundColor Green
}
Write-Host ""

# ステップ3: ffmpegのインストール
Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host " ステップ 3/4: ffmpegの確認" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "ffmpegは、動画を作成・編集するためのツールです。"
Write-Host "PDFスライドと音声から動画を生成する際に使用します。"
Write-Host ""

if (Get-Command ffmpeg -ErrorAction SilentlyContinue) {
    Write-Host "[OK] ffmpegは既にインストールされています。" -ForegroundColor Green
} else {
    Write-Host "ffmpegをインストールしています..." -ForegroundColor Cyan
    Write-Host "（数分かかる場合があります。お待ちください...）"
    Write-Host ""

    choco install ffmpeg -y

    # PATHを更新
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    Write-Host ""
    Write-Host "[OK] ffmpegのインストールが完了しました。" -ForegroundColor Green
}
Write-Host ""

# ステップ4: popplerのインストール
Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host " ステップ 4/4: popplerの確認" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "popplerは、PDFファイルを画像に変換するためのツールです。"
Write-Host "PDFの各ページを画像にして、動画に組み込む際に使用します。"
Write-Host ""

if (Get-Command pdftoppm -ErrorAction SilentlyContinue) {
    Write-Host "[OK] popplerは既にインストールされています。" -ForegroundColor Green
} else {
    Write-Host "popplerをインストールしています..." -ForegroundColor Cyan
    Write-Host "（数分かかる場合があります。お待ちください...）"
    Write-Host ""

    choco install poppler -y

    # PATHを更新
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    Write-Host ""
    Write-Host "[OK] popplerのインストールが完了しました。" -ForegroundColor Green
}
Write-Host ""

# ステップ5: npmパッケージのインストール
Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host " 追加ステップ: アプリの依存関係をインストール" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "アプリケーションが使用する追加のプログラムをインストールします。"
Write-Host ""

# スクリプトのディレクトリに移動
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

if (Test-Path "package.json") {
    Write-Host "npm installを実行しています..." -ForegroundColor Cyan
    npm install
    Write-Host ""
    Write-Host "[OK] 依存関係のインストールが完了しました。" -ForegroundColor Green
} else {
    Write-Host "[スキップ] package.jsonが見つかりませんでした。" -ForegroundColor Yellow
}
Write-Host ""

# 完了メッセージ
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " セットアップが完了しました！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "次のステップ:"
Write-Host ""
Write-Host "1. このウィンドウを閉じてください"
Write-Host ""
Write-Host "2. API設定を行ってください"
Write-Host "   → docs/2_API設定ガイド.md を参照"
Write-Host ""
Write-Host "3. アプリを起動してください"
Write-Host "   → start.bat をダブルクリック"
Write-Host ""
Write-Host ""
Read-Host "Enterキーを押すと、このウィンドウが閉じます"
