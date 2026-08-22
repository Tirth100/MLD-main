# PowerShell packaging script for MLD Windows x64 Agent
[CmdletBinding()]
param (
    [string]$Configuration = "Release",
    [string]$OutputDir = "bin\publish"
)

$ErrorActionPreference = "Stop"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "   Publishing MLD-Agent Single Executable (win-x64)" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptRoot
$csproj = Join-Path $projectRoot "MldAgent.csproj"

if (-not (Get-Command "dotnet" -ErrorAction SilentlyContinue)) {
    Write-Warning "dotnet SDK command not found in PATH. Using build.bat fallback."
    & (Join-Path $scriptRoot "build.bat")
    exit $LASTEXITCODE
}

Write-Host "Publishing project: $csproj" -ForegroundColor Green

dotnet publish $csproj `
    -c $Configuration `
    -r win-x64 `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:EnableCompressionInSingleFile=true `
    -o (Join-Path $projectRoot $OutputDir)

if ($LASTEXITCODE -eq 0) {
    $publishedExe = Join-Path $projectRoot "$OutputDir\MLD-Agent.exe"
    $rootExe = Join-Path (Split-Path -Parent $projectRoot) "MLD-Agent.exe"
    
    if (Test-Path $publishedExe) {
        Copy-Item -Path $publishedExe -Destination $rootExe -Force
        Write-Host "Copied executable to workspace root: $rootExe" -ForegroundColor Green
    }
    Write-Host "===================================================" -ForegroundColor Green
    Write-Host " [SUCCESS] MLD-Agent.exe published successfully!" -ForegroundColor Green
    Write-Host "===================================================" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Publishing failed with exit code $LASTEXITCODE" -ForegroundColor Red
}
