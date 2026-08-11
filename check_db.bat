@echo off
echo ===================================================
echo   MLD Cloud Database Checker (Render PostgreSQL)
echo ===================================================
echo.
javac -d build -cp "lib/*" src/api/*.java src/database/*.java src/agent/*.java src/monitor/*.java src/service/*.java src/main/*.java src/report/*.java
java -cp "lib/*;build" main.MainCheckDb
pause
