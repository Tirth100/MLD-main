@echo off
setlocal
set "INSTALL_DIR=%APPDATA%\MLD-Agent"
set "VBS=%INSTALL_DIR%\start-agent.vbs"
set "JAR=%INSTALL_DIR%\MLD-Agent.jar"

REM ── If this is already the installed copy running from startup, just launch ──
if /i "%~dp0"=="%INSTALL_DIR%\" goto :launch

REM ── FIRST-TIME SETUP ────────────────────────────────────────────────────────
title MLD Agent - Setup
cls
echo.
echo  ==========================================
echo    MLD Meeting Leak Detector - Agent Setup
echo  ==========================================
echo.
echo  Installing agent... please wait.
echo.

REM Copy all files to permanent AppData location
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
xcopy /E /I /Y "%~dp0jre" "%INSTALL_DIR%\jre\" >nul 2>&1
xcopy /E /I /Y "%~dp0lib" "%INSTALL_DIR%\lib\" >nul 2>&1
copy /Y "%~dp0MLD-Agent.jar" "%JAR%" >nul 2>&1

REM Create a silent VBScript launcher (no window shown on startup)
(
  echo Set sh = CreateObject^("WScript.Shell"^)
  echo Dim appData : appData = sh.ExpandEnvironmentStrings^("%%APPDATA%%"^)
  echo Dim installDir : installDir = appData ^& "\MLD-Agent"
  echo Dim jrePath : jrePath = installDir ^& "\jre\bin\javaw.exe"
  echo Dim fso : Set fso = CreateObject^("Scripting.FileSystemObject"^)
  echo If Not fso.FileExists^(jrePath^) Then jrePath = "javaw.exe"
  echo Dim cpPath : cpPath = installDir ^& "\lib\*;" ^& installDir ^& "\MLD-Agent.jar"
  echo Dim cmd : cmd = """""" ^& jrePath ^& """""" ^& " -cp """""" ^& cpPath ^& """""" agent.MldAgent"
  echo sh.Run cmd, 0, False
) > "%VBS%"

REM Register agent to auto-start silently on every Windows login (no admin needed)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "MLDAgent" /t REG_SZ /d "wscript.exe \"%VBS%\"" /f >nul 2>&1

echo  Setup complete!
echo  The agent will now start automatically every time you log in.
echo.

:launch
REM ── LAUNCH AGENT SILENTLY IN BACKGROUND ─────────────────────────────────────
if exist "%INSTALL_DIR%\jre\bin\javaw.exe" (
    set "JRE=%INSTALL_DIR%\jre\bin\javaw.exe"
) else (
    set "JRE=javaw.exe"
)

if exist "%VBS%" (
    start "" wscript.exe "%VBS%"
) else (
    REM Fallback: run directly if VBS missing
    start "" /B "%JRE%" -cp "%INSTALL_DIR%\lib\*;%JAR%" agent.MldAgent
)

if /i "%~dp0"=="%INSTALL_DIR%\" exit
echo  Agent is running in the background.
echo  You can close this window now.
echo.
timeout /t 4 >nul
