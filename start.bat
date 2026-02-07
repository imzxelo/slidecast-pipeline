@echo off
chcp 65001 > nul
echo.
echo ========================================
echo  Slidecast Pipeline を起動しています...
echo ========================================
echo.

cd /d "%~dp0"

REM ポート3001が使用中かチェック
netstat -ano | findstr ":3001 " | findstr "LISTENING" > nul 2>&1
if %errorlevel% equ 0 (
    echo ========================================
    echo  警告: ポート3001が既に使用されています
    echo ========================================
    echo.
    echo 別のアプリケーションがポート3001を使用中です。
    echo.
    echo 対処方法:
    echo   1. 既に起動している Slidecast Pipeline を閉じる
    echo   2. または、ポート3001を使用中の他のアプリを終了する
    echo.
    echo 使用中のプロセスを確認するには:
    echo   タスクマネージャーを開いて確認してください
    echo.
    pause
    exit /b 1
)

REM Node.jsが使えるか確認
where node > nul 2>&1
if %errorlevel% neq 0 (
    echo ========================================
    echo  エラー: Node.js が見つかりません
    echo ========================================
    echo.
    echo setup.ps1 を実行してセットアップを完了してください。
    echo.
    pause
    exit /b 1
)

REM Node.js のバージョン確認（18+ 必須）
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)" > nul 2>&1
if %errorlevel% neq 0 (
    echo ========================================
    echo  エラー: Node.js のバージョンが古すぎます
    echo ========================================
    echo.
    echo このアプリは Node.js 18 以上が必要です。
    echo setup.ps1 を実行して Node.js (LTS) をインストールしてください。
    echo.
    pause
    exit /b 1
)

REM ffmpeg/ffprobe が使えるか確認
where ffmpeg > nul 2>&1
if %errorlevel% neq 0 (
    echo ========================================
    echo  エラー: ffmpeg が見つかりません
    echo ========================================
    echo.
    echo FFmpeg がインストールされていないか、PATHが通っていません。
    echo setup.ps1 を実行してセットアップを完了してください。
    echo.
    pause
    exit /b 1
)

where ffprobe > nul 2>&1
if %errorlevel% neq 0 (
    echo ========================================
    echo  エラー: ffprobe が見つかりません
    echo ========================================
    echo.
    echo FFmpeg がインストールされていないか、PATHが通っていません。
    echo setup.ps1 を実行してセットアップを完了してください。
    echo.
    pause
    exit /b 1
)

REM pdftoppm が使えるか確認（poppler）
where pdftoppm > nul 2>&1
if %errorlevel% neq 0 (
    echo ----------------------------------------
    echo  注意: pdftoppm が PATH から見つかりません
    echo ----------------------------------------
    echo poppler がインストールされていても、PATHに追加されない場合があります。
    echo pdftoppm.exe を自動で探します...
    echo.

    set "PDFTOPPM_BIN="
    if exist "C:\\ProgramData\\chocolatey\\lib\\poppler\\tools" (
        for /r "C:\\ProgramData\\chocolatey\\lib\\poppler\\tools" %%F in (pdftoppm.exe) do (
            if not defined PDFTOPPM_BIN set "PDFTOPPM_BIN=%%~dpF"
        )
    )

    if defined PDFTOPPM_BIN (
        call echo [OK] pdftoppm.exe を見つけました: %%PDFTOPPM_BIN%%
        call set "PATH=%%PATH%%;%%PDFTOPPM_BIN%%"
        echo.
    ) else (
        echo ========================================
        echo  エラー: pdftoppm が見つかりません
        echo ========================================
        echo.
        echo Poppler (pdftoppm) がインストールされていない可能性があります。
        echo setup.ps1 を実行してセットアップを完了してください。
        echo.
        pause
        exit /b 1
    )
)

REM 最終確認（pdftoppm）
where pdftoppm > nul 2>&1
if %errorlevel% neq 0 (
    echo ========================================
    echo  エラー: pdftoppm が見つかりません
    echo ========================================
    echo.
    echo setup.ps1 を実行してセットアップを完了してください。
    echo.
    pause
    exit /b 1
)

echo このウィンドウは、アプリを使用中は開いたままにしてください。
echo 閉じるとアプリが停止します。
echo.
echo ブラウザが自動で開きます。
echo 開かない場合は、以下のアドレスをChromeで開いてください：
echo.
echo     http://localhost:3001
echo.
echo ----------------------------------------
echo.

REM ブラウザを3秒後に開く（サーバー起動を待つため）
start "" cmd /c "timeout /t 3 /nobreak > nul && start http://localhost:3001"

REM サーバーを起動
node server.js

echo.
echo ========================================
echo  アプリが停止しました
echo ========================================
echo.
pause
