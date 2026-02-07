@echo off
chcp 65001 > nul
echo.
echo ========================================
echo  Slidecast Pipeline
echo ========================================
echo.

cd /d "%~dp0"

REM Port 3001 check
netstat -ano | findstr ":3001 " | findstr "LISTENING" > nul 2>&1
if %errorlevel% equ 0 (
    echo [ERROR] Port 3001 is already in use.
    echo Close the other application and try again.
    echo.
    pause
    exit /b 1
)

REM Node.js check
where node > nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found.
    echo Run setup.ps1 first.
    echo.
    pause
    exit /b 1
)

REM Node.js version check (18+)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)" > nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js 18+ required.
    echo Run setup.ps1 to update.
    echo.
    pause
    exit /b 1
)

REM ffmpeg check
where ffmpeg > nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] ffmpeg not found.
    echo Run setup.ps1 first.
    echo.
    pause
    exit /b 1
)

where ffprobe > nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] ffprobe not found.
    echo Run setup.ps1 first.
    echo.
    pause
    exit /b 1
)

REM pdftoppm check (poppler)
where pdftoppm > nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] pdftoppm not in PATH. Searching...
    echo.

    set "PDFTOPPM_BIN="
    if exist "C:\ProgramData\chocolatey\lib\poppler\tools" (
        for /r "C:\ProgramData\chocolatey\lib\poppler\tools" %%F in (pdftoppm.exe) do (
            if not defined PDFTOPPM_BIN set "PDFTOPPM_BIN=%%~dpF"
        )
    )

    if defined PDFTOPPM_BIN (
        call echo [OK] Found pdftoppm: %%PDFTOPPM_BIN%%
        call set "PATH=%%PATH%%;%%PDFTOPPM_BIN%%"
        echo.
    ) else (
        echo [ERROR] pdftoppm not found.
        echo Run setup.ps1 first.
        echo.
        pause
        exit /b 1
    )
)

REM Final pdftoppm check
where pdftoppm > nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] pdftoppm not found.
    echo Run setup.ps1 first.
    echo.
    pause
    exit /b 1
)

echo Starting server...
echo.
echo Keep this window open while using the app.
echo.
echo Open in browser: http://localhost:3001
echo.
echo ----------------------------------------
echo.

REM Open browser after 3 sec delay
start "" cmd /c "timeout /t 3 /nobreak > nul && start http://localhost:3001"

REM Start server
node server.js

echo.
echo App stopped.
echo.
pause
