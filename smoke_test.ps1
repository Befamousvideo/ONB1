param(
  [string]$BaseUrl = "http://localhost:8000"
)

$accountId = "11111111-1111-1111-1111-111111111111"

$createBody = @{
  account_id = $accountId
  channel = "web"
  subject = "Smoke test"
} | ConvertTo-Json

$create = Invoke-WebRequest -Uri "$BaseUrl/api/conversations" -Method Post -Body $createBody -ContentType "application/json"
$createJson = $create.Content | ConvertFrom-Json
$conversationId = $createJson.id

$messageBody = @{
  sender_type = "contact"
  body = "Hello from smoke test"
} | ConvertTo-Json

$message = Invoke-WebRequest -Uri "$BaseUrl/api/conversations/$conversationId/message" -Method Post -Body $messageBody -ContentType "application/json"

$getBefore = Invoke-WebRequest -Uri "$BaseUrl/api/conversations/$conversationId" -Method Get

$endBody = @{
  summary = "Smoke test summary"
} | ConvertTo-Json

$end = Invoke-WebRequest -Uri "$BaseUrl/api/conversations/$conversationId/end-and-send" -Method Post -Body $endBody -ContentType "application/json"

Write-Host "create:$($create.StatusCode) message:$($message.StatusCode) get:$($getBefore.StatusCode) end:$($end.StatusCode) conv:$conversationId"
