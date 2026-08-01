@echo off
echo ===================================================
echo   MLD Cloud Database Checker (Render PostgreSQL)
echo ===================================================
echo.
javac -cp "lib/*;src" src/database/DatabaseHelper.java
java -cp "lib/*;src" main.MainCheckDb
pause
