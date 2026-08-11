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

echo Bundling minimal JRE...
if exist jre rmdir /s /q jre
jlink --no-header-files --no-man-pages --compress=2 --strip-debug --add-modules java.base,java.logging,java.desktop,java.management,java.naming,java.security.jgss,java.instrument,jdk.crypto.ec --output jre

echo Packaging MLD-Agent.zip distribution...
powershell -Command "Compress-Archive -Path 'MLD-Agent.jar', 'run-agent.bat', 'lib', 'jre' -DestinationPath 'MLD-Agent.zip' -Force"

echo.
echo ===================================================
echo [SUCCESS] MLD-Agent.jar & MLD-Agent.zip built successfully!
echo ===================================================
pause
