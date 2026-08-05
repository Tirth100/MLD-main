Start-Process -FilePath "javaw.exe" -ArgumentList "-jar MLD-Agent.jar" -WindowStyle Hidden
Write-Host "MLD Agent started in background [Status: Connected 🟢]" -ForegroundColor Green
