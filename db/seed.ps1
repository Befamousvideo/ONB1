param(
  [string]$DatabaseUrl = $env:DATABASE_URL
)

if (-not $DatabaseUrl) {
  Write-Error "DATABASE_URL is not set. Set it in your environment or .env before running."
  exit 1
}

$scriptPath = Join-Path $PSScriptRoot "..\db\seeds\0001_demo.sql"

if (-not (Test-Path $scriptPath)) {
  Write-Error "Seed file not found: $scriptPath"
  exit 1
}

& psql $DatabaseUrl -f $scriptPath
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
