@echo off
echo Packaging MLD Agent into an MSI installer...
echo Note: This requires JDK 14+ with jpackage installed.

if not exist "build" (
    call build.bat
)

REM Create a jar file
jar cfe mld-agent.jar agent.MldAgent -C build .

REM Create the MSI using jpackage
jpackage ^
  --type msi ^
  --dest installer ^
  --name "MLD Agent" ^
  --app-version "1.0.0" ^
  --input . ^
  --main-jar mld-agent.jar ^
  --main-class agent.MldAgent ^
  --win-menu ^
  --win-shortcut ^
  --win-dir-chooser

echo MSI created in installer/ folder.
echo.
echo Please manually merge the protocol handler registry keys by running:
echo regedit.exe /s protocol.reg
