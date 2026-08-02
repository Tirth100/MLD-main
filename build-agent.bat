@echo off
echo ===================================================
echo   Building MLD Desktop Agent (MLD-Agent.jar)
echo ===================================================
echo.

if not exist bin mkdir bin

echo Compiling Java Agent sources...
javac -cp "lib/*;src" -d bin src/monitor/ActiveWindowTracker.java src/agent/MldAgent.java

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Agent compilation failed.
    pause
    exit /b %ERRORLEVEL%
)

echo Creating Jar Manifest...
echo Main-Class: agent.MldAgent > bin/manifest.txt
echo Class-Path: ../lib/jna-5.14.0.jar ../lib/jna-platform-5.14.0.jar >> bin/manifest.txt

echo Packaging MLD-Agent.jar...
jar cvfm MLD-Agent.jar bin/manifest.txt -C bin agent -C bin monitor

echo.
echo ===================================================
echo [SUCCESS] MLD-Agent.jar built successfully!
echo ===================================================
pause
