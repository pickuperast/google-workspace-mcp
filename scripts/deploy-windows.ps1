param(
  [switch]$SkipBuild,
  [switch]$SkipStartupTask
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$configRoot = Join-Path $repoRoot "docker-data\config"
$projectConfigDir = Join-Path $configRoot "google-workspace-mcp"
$hostTokenDir = Join-Path $HOME ".config\google-workspace-mcp"
$hostTokenFile = Join-Path $hostTokenDir "token.json"
$containerTokenFile = Join-Path $projectConfigDir "token.json"

New-Item -ItemType Directory -Force -Path $projectConfigDir | Out-Null

if (Test-Path $hostTokenFile) {
  $shouldCopyToken = $true

  if (Test-Path $containerTokenFile) {
    $hostTokenHash = (Get-FileHash $hostTokenFile -Algorithm SHA256).Hash
    $containerTokenHash = (Get-FileHash $containerTokenFile -Algorithm SHA256).Hash
    $shouldCopyToken = $hostTokenHash -ne $containerTokenHash
  }

  if ($shouldCopyToken) {
    Copy-Item $hostTokenFile $containerTokenFile -Force
    Write-Host "Synced Google Workspace MCP token into docker-data\config."
  }
}

if (-not (Test-Path $containerTokenFile) -and -not $env:SERVICE_ACCOUNT_PATH) {
  throw "No token found at $containerTokenFile. Run local auth first or provide SERVICE_ACCOUNT_PATH in .env."
}

if (-not $SkipBuild) {
  docker compose up -d --build
} else {
  docker compose up -d
}

if (-not $SkipStartupTask) {
  & (Join-Path $PSScriptRoot "install-windows-startup.ps1")
}

Write-Host ""
Write-Host "Waiting for container health..."

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8089/ready" -UseBasicParsing -TimeoutSec 3
    if ($response.StatusCode -eq 200) {
      $ready = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 2
  }
}

if (-not $ready) {
  docker compose logs --tail=100 google-workspace-mcp
  throw "Container did not become ready."
}

Write-Host "Container is ready at http://127.0.0.1:8089/mcp"
docker compose ps
