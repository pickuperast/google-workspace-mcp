param(
  [int]$DockerWaitSeconds = 120
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$deadline = (Get-Date).AddSeconds($DockerWaitSeconds)

while ((Get-Date) -lt $deadline) {
  try {
    docker info | Out-Null
    docker compose up -d
    exit 0
  } catch {
    Start-Sleep -Seconds 5
  }
}

throw "Docker was not ready within $DockerWaitSeconds seconds."
