param(
  [string]$DatabaseUrl = $env:DATABASE_URL
)

if (-not $DatabaseUrl) {
  Write-Error "DATABASE_URL is not set. Set it in your environment or .env before running."
  exit 1
}

$scriptPath = Join-Path $PSScriptRoot "..\db\migrations\0001_init.sql"

if (-not (Test-Path $scriptPath)) {
  Write-Error "Migration file not found: $scriptPath"
  exit 1
}

& psql $DatabaseUrl -f $scriptPath
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
