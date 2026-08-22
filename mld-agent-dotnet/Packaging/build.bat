@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo   Building Native MLD-Agent Windows Executable
echo ===================================================
echo.

cd /d "%~dp0\.."

set CSC_PATH=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe

where dotnet >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Found dotnet SDK. Compiling with dotnet...
    dotnet build MldAgent.csproj -c Release -o bin\Release
    if %ERRORLEVEL% EQU 0 (
        copy /y bin\Release\MLD-Agent.exe ..\MLD-Agent.exe >nul
        copy /y bin\Release\MLD-Agent.exe ..\frontend\public\MLD-Agent.exe >nul 2>nul
        echo [SUCCESS] Built MLD-Agent.exe with dotnet!
        goto DONE
    )
)

if exist "%CSC_PATH%" (
    echo [INFO] Compiling using Windows Native C# Compiler (csc.exe)...
    if not exist bin mkdir bin
    "%CSC_PATH%" /target:winexe /platform:anycpu /optimize+ /out:bin\MLD-Agent.exe /win32manifest:app.manifest /r:System.dll,System.Core.dll,System.Drawing.dll,System.Windows.Forms.dll,System.Net.Http.dll,Microsoft.VisualBasic.dll /recurse:*.cs
    
    if %ERRORLEVEL% EQU 0 (
        copy /y bin\MLD-Agent.exe ..\MLD-Agent.exe >nul
        if exist "..\frontend\public" copy /y bin\MLD-Agent.exe ..\frontend\public\MLD-Agent.exe >nul
        echo.
        echo ===================================================
        echo  [SUCCESS] MLD-Agent.exe built successfully!
        echo ===================================================
        goto DONE
    ) else (
        echo [ERROR] C# compilation failed.
        exit /b 1
    )
) else (
    echo [ERROR] Neither dotnet SDK nor csc.exe was found.
    exit /b 1
)

:DONE
endlocal
exit /b 0
