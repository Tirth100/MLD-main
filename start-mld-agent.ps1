$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location -Path $ScriptDir

$javaExe = "javaw.exe"

# 1. Check if Java is available globally
try {
    $null = Get-Command javaw.exe -ErrorAction Stop
} catch {
    # 2. Java not found globally. Check for local portable JRE.
    $localJrePath = Get-ChildItem -Path "$ScriptDir\jre\*\bin\javaw.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    
    if (-not $localJrePath) {
        Write-Host "Java is not installed on this system!" -ForegroundColor Yellow
        Write-Host "Downloading a portable Java Runtime (JRE)... This will only happen once." -ForegroundColor Cyan
        
        $infoUrl = "https://api.adoptium.net/v3/assets/latest/21/hotspot?os=windows&architecture=x64&image_type=jre&project=jdk"
        $info = Invoke-RestMethod -Uri $infoUrl -ErrorAction Stop
        $expectedHash = $info[0].binary.package.checksum
        $jreUrl = $info[0].binary.package.link

        $zipPath = "$ScriptDir\jre.zip"
        $jreDir = "$ScriptDir\jre"
        
        Invoke-WebRequest -Uri $jreUrl -OutFile $zipPath
        
        Write-Host "Verifying JRE download integrity..." -ForegroundColor Cyan
        $actualHash = (Get-FileHash -Path $zipPath -Algorithm SHA256).Hash
        if ($actualHash.ToLower() -ne $expectedHash.ToLower()) {
            Write-Error "JRE download integrity check failed. Expected: $expectedHash, Got: $actualHash"
            Remove-Item $zipPath -Force
            Pause
            exit 1
        }

        Write-Host "Extracting JRE (this may take a moment)..." -ForegroundColor Cyan
        if (Test-Path $jreDir) { Remove-Item -Recurse -Force $jreDir }
        Expand-Archive -Path $zipPath -DestinationPath $jreDir -Force
        Remove-Item $zipPath -Force
        
        $localJrePath = Get-ChildItem -Path "$ScriptDir\jre\*\bin\javaw.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
        Write-Host "Portable JRE downloaded successfully!" -ForegroundColor Green
    }
    
    if ($localJrePath) {
        $javaExe = $localJrePath.FullName
    } else {
        Write-Host "Failed to find Java even after download. Please install Java manually." -ForegroundColor Red
        Pause
        exit
    }
}

# 3. Start the MLD Agent silently
Start-Process -FilePath $javaExe -ArgumentList "-jar MLD-Agent.jar" -WindowStyle Hidden
Write-Host "MLD Agent started in background [Status: Connected 🟢]" -ForegroundColor Green

# Keep the window open for a short time so the user can read the success message
Start-Sleep -Seconds 2
