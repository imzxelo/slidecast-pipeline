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
