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

# ============================================================
# 事前チェック
# ============================================================

# 文字化け防止
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# --- チェック1: 実行ポリシー ---
$currentPolicy = Get-ExecutionPolicy
if ($currentPolicy -eq "Restricted") {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host " 実行ポリシーを一時的に変更します" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "現在の設定: $currentPolicy"
    Write-Host "このセッションのみ、スクリプト実行を許可します。"
    Write-Host ""
    try {
        Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
        Write-Host "[OK] 実行ポリシーを変更しました。" -ForegroundColor Green
    } catch {
        Write-Host "[エラー] 実行ポリシーの変更に失敗しました。" -ForegroundColor Red
        Write-Host "管理者権限でPowerShellを開き、以下を実行してください:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  Set-ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor Cyan
        Write-Host ""
        Read-Host "Enterキーを押すと終了します"
        exit 1
    }
    Write-Host ""
}

# --- チェック2: TLS設定（古いWindows対応） ---
try {
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls11
} catch {
    # 古い.NET Frameworkでは列挙型が使えない場合がある
    [System.Net.ServicePointManager]::SecurityProtocol = 3072 -bor 768
}

# --- チェック3: プロキシ検出 ---
try {
    $proxyAddr = [System.Net.WebRequest]::GetSystemWebProxy().GetProxy("https://chocolatey.org")
    if ($proxyAddr.Host -ne "chocolatey.org") {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Yellow
        Write-Host " プロキシが検出されました" -ForegroundColor Yellow
        Write-Host "========================================" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "プロキシ: $proxyAddr"
        Write-Host ""
        Write-Host "企業ネットワークを使用している場合、インストールに"
        Write-Host "失敗する可能性があります。"
        Write-Host ""
        Write-Host "問題が発生した場合は、IT部門に以下を確認してください:"
        Write-Host "- chocolatey.org へのアクセス許可"
        Write-Host "- npmjs.com へのアクセス許可"
        Write-Host ""
        # デフォルトの認証情報を使用
        [System.Net.WebRequest]::DefaultWebProxy.Credentials = [System.Net.CredentialCache]::DefaultNetworkCredentials
        Start-Sleep -Seconds 2
    }
} catch {
    # プロキシ検出に失敗しても続行
}

# --- チェック4: 日本語ユーザー名の警告 ---
$userProfile = $env:USERPROFILE
$scriptPath = $PSScriptRoot
$hasNonAscii = $false

# ユーザープロファイルパスに非ASCII文字があるかチェック
if ($userProfile -match '[^\x00-\x7F]') {
    $hasNonAscii = $true
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host " 警告: ユーザー名に日本語が含まれています" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "ユーザーフォルダ: $userProfile"
    Write-Host ""
    Write-Host "日本語を含むパスでは、一部のツールが正しく動作しない"
    Write-Host "場合があります。問題が発生した場合は、Makotoに連絡してください。"
    Write-Host ""
    Write-Host "セットアップを続行します..."
    Write-Host ""
    Start-Sleep -Seconds 2
}

# スクリプトのパスに非ASCII文字があるかチェック
if ($scriptPath -match '[^\x00-\x7F]') {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host " エラー: フォルダパスに日本語が含まれています" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "現在の場所: $scriptPath"
    Write-Host ""
    Write-Host "このアプリは日本語を含まないフォルダに配置してください。"
    Write-Host ""
    Write-Host "推奨: C:\slidecast-pipeline"
    Write-Host ""
    Write-Host "【対処方法】"
    Write-Host "1. このフォルダを C:\slidecast-pipeline に移動"
    Write-Host "2. 移動後、再度 setup.ps1 を実行"
    Write-Host ""
    Read-Host "Enterキーを押すと終了します"
    exit 1
}

# --- チェック5: 管理者権限 ---
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

# ============================================================
# メインセットアップ開始
# ============================================================

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

    try {
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

        # PATHを更新（Chocolateyのshimパスを明示的に追加）
        $env:ChocolateyInstall = [System.Environment]::GetEnvironmentVariable("ChocolateyInstall", "Machine")
        if (-not $env:ChocolateyInstall) {
            $env:ChocolateyInstall = "C:\ProgramData\chocolatey"
        }
        $shimPath = "$env:ChocolateyInstall\bin"
        $env:Path = "$shimPath;" + [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

        Write-Host ""
        Write-Host "[OK] Chocolateyのインストールが完了しました。" -ForegroundColor Green
    } catch {
        Write-Host ""
        Write-Host "[エラー] Chocolateyのインストールに失敗しました。" -ForegroundColor Red
        Write-Host "エラー詳細: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "考えられる原因:"
        Write-Host "- インターネット接続の問題"
        Write-Host "- 企業ネットワークでのブロック"
        Write-Host "- ウイルス対策ソフトによるブロック"
        Write-Host ""
        Write-Host "Makotoに連絡してください。"
        Read-Host "Enterキーを押すと終了します"
        exit 1
    }
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

    # Node.js 18+ が必要（古い場合はLTSをインストール）
    $nodeMajor = 0
    if ($nodeVersion -match '^v(\d+)') {
        $nodeMajor = [int]$Matches[1]
    }

    if ($nodeMajor -lt 18) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Yellow
        Write-Host " 警告: Node.js のバージョンが古すぎます" -ForegroundColor Yellow
        Write-Host "========================================" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "このアプリは Node.js 18 以上が必要です。"
        Write-Host "Node.js (LTS) をインストールします..." -ForegroundColor Cyan
        Write-Host ""

        try {
            choco install nodejs-lts -y

            # PATHを更新
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

            $nodeVersion = node --version
            Write-Host ""
            Write-Host "[OK] Node.js を更新しました。（バージョン: $nodeVersion）" -ForegroundColor Green
        } catch {
            Write-Host ""
            Write-Host "[エラー] Node.jsのインストールに失敗しました。" -ForegroundColor Red
            Write-Host "エラー詳細: $_" -ForegroundColor Red
            Read-Host "Enterキーを押すと終了します"
            exit 1
        }
    }
} else {
    Write-Host "Node.jsをインストールしています..." -ForegroundColor Cyan
    Write-Host "（数分かかる場合があります。お待ちください...）"
    Write-Host ""

    try {
        choco install nodejs-lts -y

        # PATHを更新
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

        Write-Host ""
        Write-Host "[OK] Node.jsのインストールが完了しました。" -ForegroundColor Green
    } catch {
        Write-Host ""
        Write-Host "[エラー] Node.jsのインストールに失敗しました。" -ForegroundColor Red
        Write-Host "エラー詳細: $_" -ForegroundColor Red
        Read-Host "Enterキーを押すと終了します"
        exit 1
    }
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

    try {
        choco install ffmpeg -y

        # PATHを更新
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

        Write-Host ""
        Write-Host "[OK] ffmpegのインストールが完了しました。" -ForegroundColor Green
    } catch {
        Write-Host ""
        Write-Host "[エラー] ffmpegのインストールに失敗しました。" -ForegroundColor Red
        Write-Host "エラー詳細: $_" -ForegroundColor Red
        Read-Host "Enterキーを押すと終了します"
        exit 1
    }
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

    try {
        choco install poppler -y

        # PATHを更新
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

        Write-Host ""
        Write-Host "[OK] popplerのインストールが完了しました。" -ForegroundColor Green
    } catch {
        Write-Host ""
        Write-Host "[エラー] popplerのインストールに失敗しました。" -ForegroundColor Red
        Write-Host "エラー詳細: $_" -ForegroundColor Red
        Read-Host "Enterキーを押すと終了します"
        exit 1
    }
}

# poppler はインストールされても pdftoppm.exe が PATH に追加されない場合があるため補正
if (-not (Get-Command pdftoppm -ErrorAction SilentlyContinue)) {
    try {
        $chocoRoot = $env:ChocolateyInstall
        if (-not $chocoRoot) {
            $chocoRoot = "C:\\ProgramData\\chocolatey"
        }

        $popplerTools = Join-Path $chocoRoot "lib\\poppler\\tools"
        $pdftoppmExe = $null

        if (Test-Path $popplerTools) {
            $pdftoppmExe = Get-ChildItem $popplerTools -Recurse -Filter "pdftoppm.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
        }

        if ($pdftoppmExe) {
            $popplerBin = Split-Path -Parent $pdftoppmExe.FullName

            function Normalize-PathEntry([string]$p) {
                if (-not $p) { return "" }
                return $p.Trim().TrimEnd('\\').ToLowerInvariant()
            }

            $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
            if (-not $machinePath) { $machinePath = "" }

            $entries = $machinePath.Split(';') | ForEach-Object { Normalize-PathEntry $_ }
            $popplerNorm = Normalize-PathEntry $popplerBin

            if ($popplerNorm -and ($entries -notcontains $popplerNorm)) {
                $newMachinePath = ($machinePath.TrimEnd(';') + ";" + $popplerBin).TrimStart(';')
                [Environment]::SetEnvironmentVariable("Path", $newMachinePath, "Machine")
            }

            # 現在のセッションに反映
            $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")

            Write-Host "[OK] pdftoppm のパスをPATHに追加しました: $popplerBin" -ForegroundColor Green
            Write-Host "※ すでに開いているコマンドプロンプト/エクスプローラーには、PC再起動後に反映されることがあります。" -ForegroundColor Yellow
        } else {
            Write-Host "[警告] pdftoppm.exe が見つかりませんでした。popplerのインストールを確認してください。" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[警告] pdftoppm の PATH 設定に失敗しました: $_" -ForegroundColor Yellow
    }
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
    try {
        $npmOutput = npm install 2>&1
        $npmOutput | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed with exit code $LASTEXITCODE"
        }
        Write-Host ""
        Write-Host "[OK] 依存関係のインストールが完了しました。" -ForegroundColor Green
    } catch {
        Write-Host ""
        Write-Host "[エラー] npm installに失敗しました。" -ForegroundColor Red
        Write-Host "エラー詳細: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Makotoに連絡してください。"
    }
} else {
    Write-Host "[スキップ] package.jsonが見つかりませんでした。" -ForegroundColor Yellow
}
Write-Host ""

# ステップ6: .envファイルの自動作成
Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host " 追加ステップ: 設定ファイルの準備" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "[OK] 設定ファイル (.env) を作成しました。" -ForegroundColor Green
        Write-Host ""
        Write-Host "注意: APIキーの設定が必要です。" -ForegroundColor Yellow
        Write-Host "docs/2_API設定ガイド.md を参照してください。"
    } else {
        Write-Host "[スキップ] .env.exampleが見つかりませんでした。" -ForegroundColor Yellow
    }
} else {
    Write-Host "[OK] 設定ファイル (.env) は既に存在します。" -ForegroundColor Green
}
Write-Host ""

# ============================================================
# インストール確認
# ============================================================
Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host " インストール結果の確認" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host ""

$allOk = $true

# Node.js確認
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVer = node --version
    Write-Host "[OK] Node.js: $nodeVer" -ForegroundColor Green
} else {
    Write-Host "[NG] Node.js: 見つかりません" -ForegroundColor Red
    $allOk = $false
}

# ffmpeg確認
if (Get-Command ffmpeg -ErrorAction SilentlyContinue) {
    Write-Host "[OK] ffmpeg: インストール済み" -ForegroundColor Green
} else {
    Write-Host "[NG] ffmpeg: 見つかりません" -ForegroundColor Red
    $allOk = $false
}

# poppler確認
if (Get-Command pdftoppm -ErrorAction SilentlyContinue) {
    Write-Host "[OK] poppler: インストール済み" -ForegroundColor Green
} else {
    Write-Host "[NG] poppler: 見つかりません" -ForegroundColor Red
    $allOk = $false
}

Write-Host ""

# 完了メッセージ
if ($allOk) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host " セットアップが完了しました！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host " 一部のインストールに問題があります" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "上記で [NG] と表示されている項目があります。"
    Write-Host "PCを再起動してから、再度 setup.ps1 を実行してみてください。"
    Write-Host "それでも解決しない場合は、Makotoに連絡してください。"
}
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
