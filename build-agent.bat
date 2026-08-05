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

echo Packaging MLD-Agent.zip distribution...
powershell -Command "Compress-Archive -Path 'MLD-Agent.jar', 'start-mld-agent.bat', 'stop-mld-agent.bat', 'start-mld-agent.ps1', 'stop-mld-agent.ps1', 'run-silent-agent.vbs' -DestinationPath 'MLD-Agent.zip' -Force"

echo.
echo ===================================================
echo [SUCCESS] MLD-Agent.jar & MLD-Agent.zip built successfully!
echo ===================================================
pause
