@echo off
REM Arb-Visualizer - Automated GitHub Push (Windows)
echo ====================================
echo Pushing Arb-Visualizer to GitHub...
echo ====================================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo ERROR: Not in project directory
    echo Please cd to the Arb-Visualizer folder first
    pause
    exit /b 1
)

REM Configure git
git config user.email "jasp@arbvisualizer.app"
git config user.name "bamove6969"

REM Set remote (uses git credential helper for authentication)
git remote remove origin 2>nul
git remote add origin https://github.com/bamove6969/arb-visualizer.git

REM Push with force to overwrite everything
echo Pushing to GitHub (this will overwrite existing content)...
git push -u origin main --force

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ====================================
    echo SUCCESS! Code pushed to GitHub!
    echo ====================================
    echo.
    echo NEXT STEPS:
    echo 1. Go to: https://github.com/bamove6969/arb-visualizer/actions
    echo 2. Watch the APK build (takes ~5-10 minutes^)
    echo 3. Download from: https://github.com/bamove6969/arb-visualizer/releases
    echo.
    echo Download: app-universal-debug.apk
    echo Install on your Pixel 10 Pro Fold!
    echo.
) else (
    echo.
    echo Push failed. Check your internet connection and try again.
    pause
    exit /b 1
)

pause
