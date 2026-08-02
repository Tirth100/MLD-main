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

echo Packaging executable MLD-Agent.jar...
jar cvfe MLD-Agent.jar agent.MldAgent -C bin .

echo.
echo ===================================================
echo [SUCCESS] MLD-Agent.jar built successfully!
echo ===================================================
pause
