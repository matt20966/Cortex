$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$browserUrl = "http://localhost:3000"

Start-Process code -ArgumentList $projectPath
Start-Process powershell -ArgumentList "-NoProfile -NoExit -Command \"Set-Location -Path '$projectPath'; npm start\""

Start-Sleep -Seconds 4
Start-Process $browserUrl
