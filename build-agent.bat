@echo off

echo ===================================================
echo   Building Native Windows MLD-Agent (MLD-Agent.exe)
echo ===================================================
echo.

set CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe

if not exist "%CSC%" goto NO_CSC

echo [INFO] Compiling using Windows Native C# Compiler (csc.exe)...
"%CSC%" /target:winexe /platform:anycpu /optimize+ /out:MLD-Agent.exe /win32manifest:mld-agent-dotnet\app.manifest /r:System.dll,System.Core.dll,System.Drawing.dll,System.Windows.Forms.dll,System.Net.Http.dll,Microsoft.VisualBasic.dll /recurse:mld-agent-dotnet\*.cs

if errorlevel 1 goto BUILD_ERROR

if not exist frontend\public mkdir frontend\public
copy /y MLD-Agent.exe frontend\public\MLD-Agent.exe >nul

echo.
echo ===================================================
echo  [SUCCESS] MLD-Agent.exe built successfully!
echo ===================================================
exit /b 0

:NO_CSC
echo [ERROR] csc.exe was not found at %CSC%
exit /b 1

:BUILD_ERROR
echo [ERROR] MLD-Agent compilation failed.
exit /b 1
