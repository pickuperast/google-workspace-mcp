param(
  [string]$TaskName = "GoogleDocsMcpDockerStartup"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$startupScript = Join-Path $PSScriptRoot "startup_refresh.py"
$pythonPath = (Get-Command python.exe).Source
$userName = "$env:USERDOMAIN\$env:USERNAME"

$action = New-ScheduledTaskAction `
  -Execute $pythonPath `
  -Argument "`"$startupScript`""

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userName
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 15) `
  -StartWhenAvailable

$principal = New-ScheduledTaskPrincipal `
  -UserId $userName `
  -LogonType Interactive `
  -RunLevel Limited

$task = New-ScheduledTask `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "Runs the Google Workspace MCP startup refresh helper after Windows sign-in."

Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null

Write-Host "Registered scheduled task '$TaskName'."
Write-Host "It will run $startupScript at user logon."
