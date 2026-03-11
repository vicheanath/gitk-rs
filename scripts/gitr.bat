@echo off
REM Gitr - GitK-RS CLI launcher for Windows
REM Opens a git repository in GitK-RS
REM Usage: gitr [path]

setlocal enabledelayedexpansion

REM Get the target directory
set TARGET_DIR=%1
if "%TARGET_DIR%"=="" set TARGET_DIR=.

REM Resolve to absolute path
cd /d "%TARGET_DIR%" 2>nul || (
    echo ❌ Error: Directory '%TARGET_DIR%' does not exist
    exit /b 1
)

for /f "tokens=*" %%i in ('cd') do set TARGET_DIR=%%i

REM Check if it's a git repository
if not exist "%TARGET_DIR%\.git" (
    echo ❌ Error: '%TARGET_DIR%' is not a git repository
    exit /b 1
)

REM Try to find and launch GitK-RS
if exist "C:\Program Files\gitk-rs\gitk-rs.exe" (
    echo 📂 Opening repository: %TARGET_DIR%
    start "" "C:\Program Files\gitk-rs\gitk-rs.exe" "%TARGET_DIR%"
    echo ⏳ GitK-RS is starting...
    exit /b 0
)

if exist "C:\Program Files (x86)\gitk-rs\gitk-rs.exe" (
    echo 📂 Opening repository: %TARGET_DIR%
    start "" "C:\Program Files (x86)\gitk-rs\gitk-rs.exe" "%TARGET_DIR%"
    echo ⏳ GitK-RS is starting...
    exit /b 0
)

if exist "%LOCALAPPDATA%\Programs\gitk-rs\gitk-rs.exe" (
    echo 📂 Opening repository: %TARGET_DIR%
    start "" "%LOCALAPPDATA%\Programs\gitk-rs\gitk-rs.exe" "%TARGET_DIR%"
    echo ⏳ GitK-RS is starting...
    exit /b 0
)

REM Try to find in PATH
where gitkrs-rs.exe >nul 2>&1 && (
    echo 📂 Opening repository: %TARGET_DIR%
    start "" gitkrs-rs.exe "%TARGET_DIR%"
    echo ⏳ GitK-RS is starting...
    exit /b 0
)

echo ❌ Error: GitK-RS is not installed
echo Please install GitK-RS first
exit /b 1
