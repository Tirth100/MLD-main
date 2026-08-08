@echo off
title MLD Agent
cd /d "%~dp0"
echo Starting MLD Agent...
.\jre\bin\javaw.exe -jar MLD-Agent.jar
