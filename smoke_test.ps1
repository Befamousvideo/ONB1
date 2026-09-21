param(
  [string]$BaseUrl = "http://localhost:8000"
)

Write-Host @"
QUARANTINED: smoke_test.ps1

This script posts a stale conversation contract (account_id / sender_type / body)
and does not prove the current in-memory identity intake.

Use the Linux/WSL smoke instead:

  ./scripts/smoke.sh
  ./scripts/smoke.sh --with-web

API base would have been: $BaseUrl
"@

exit 1
