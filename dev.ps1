param(
  [string]$DatabaseUrl = "postgresql://onb1:onb1_dev_password@localhost:5432/onb1",
  [int]$Port = 8000
)

docker compose up -d

for ($i = 0; $i -lt 30; $i++) {
  if ((Test-NetConnection -ComputerName localhost -Port 5432).TcpTestSucceeded) { break }
  Start-Sleep -Seconds 1
}

$env:DATABASE_URL = $DatabaseUrl
$env:ALLOWED_ORIGINS = "*"
$env:REQUIRE_CAPTCHA = "false"
$env:ENCRYPTION_KEY = "u7nJk3xl6m0h0nq7Z5Q3p3K5ZtU2p2K7vR8b1e2ZrDk="

powershell -NoProfile -ExecutionPolicy Bypass -File .\db\migrate.ps1
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
powershell -NoProfile -ExecutionPolicy Bypass -File .\db\seed.ps1
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

python -m uvicorn server.app.main:app --reload --port $Port --host 0.0.0.0
