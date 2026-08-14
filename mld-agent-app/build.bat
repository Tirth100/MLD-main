@echo off
echo Compiling MLD Agent...
if not exist "build" mkdir build
javac -d build -cp "lib/*" src/monitor/*.java src/agent/*.java
if %ERRORLEVEL% neq 0 (
    echo Compilation failed.
    exit /b %ERRORLEVEL%
)
echo Compilation successful.
