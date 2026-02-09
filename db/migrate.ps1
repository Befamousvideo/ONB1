param(
  [string]$DatabaseUrl = $env:DATABASE_URL
)

if (-not $DatabaseUrl) {
  Write-Error "DATABASE_URL is not set. Set it in your environment or .env before running."
  exit 1
}

$migrationsPath = Join-Path $PSScriptRoot "..\db\migrations"

if (-not (Test-Path $migrationsPath)) {
  Write-Error "Migrations folder not found: $migrationsPath"
  exit 1
}

$scripts = Get-ChildItem -Path $migrationsPath -Filter "*.sql" | Sort-Object Name
if (-not $scripts) {
  Write-Error "No migration files found in: $migrationsPath"
  exit 1
}

$psqlCommand = Get-Command psql -ErrorAction SilentlyContinue

foreach ($script in $scripts) {
  Write-Host "Applying migration $($script.Name)..."
  if ($psqlCommand) {
    & psql $DatabaseUrl -f $script.FullName
  }
  else {
    Get-Content -Raw $script.FullName | docker compose exec -T postgres psql $DatabaseUrl -v ON_ERROR_STOP=1 -f -
  }
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
