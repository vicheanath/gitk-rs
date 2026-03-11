@echo off
REM GitK-RS Post-Install Setup Script (Windows)
REM This script is typically run after installing the app
REM It sets up the 'gitr' CLI command

echo.
echo 🚀 GitK-RS Post-Install Setup
echo.
echo This script will set up the 'gitr' command for your system.
echo.

REM Try to find gitr.bat in the app directory
if exist "%ProgramFiles%\GitK-RS\scripts\gitr.bat" (
    set SCRIPT_PATH=%ProgramFiles%\GitK-RS\scripts\gitr.bat
) else if exist "%LocalAppData%\Programs\GitK-RS\scripts\gitr.bat" (
    set SCRIPT_PATH=%LocalAppData%\Programs\GitK-RS\scripts\gitr.bat
) else (
    echo ❌ Error: Cannot find gitr.bat in app directory
    exit /b 1
)

echo 📍 Found script at: %SCRIPT_PATH%
echo.

REM Check if we can write to System32
set INSTALL_DIR=%SystemRoot%\System32

if exist %INSTALL_DIR% (
    echo Installing to %INSTALL_DIR%...
    REM This requires admin privileges
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Copy-Item '%SCRIPT_PATH%' '%INSTALL_DIR%\gitr.bat' -Force" 2>nul
    
    if %ERRORLEVEL% EQU 0 (
        echo ✅ Gitr CLI installed successfully to System32!
    ) else (
        echo ⚠️  Could not install to System32 (requires admin)
        echo.
        echo Alternative: Add the app scripts folder to your PATH:
        echo 1. Open System Environment Variables
        echo 2. Edit the PATH variable
        echo 3. Add: %ProgramFiles%\GitK-RS\scripts
        echo    or: %LocalAppData%\Programs\GitK-RS\scripts
        exit /b 1
    )
) else (
    echo ❌ Error: System32 folder not found
    exit /b 1
)

echo.
echo 🎉 Setup complete!
echo.
echo You can now use 'gitr' from anywhere:
echo   gitr
echo   gitr C:\path\to\repo
echo.
pause
