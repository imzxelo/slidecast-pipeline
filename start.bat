@echo off
chcp 65001 > nul
echo.
echo ========================================
echo  Slidecast Pipeline を起動しています...
echo ========================================
echo.
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

cd /d "%~dp0"

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
