param(
  [string]$Profile = "ycc-mcp",
  [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

$workspace = Split-Path -Parent $PSScriptRoot
$awsBase = @("tool", "run", "--from", "awscli", "aws", "--profile", $Profile, "--region", $Region, "--output", "json")

function Invoke-AwsJson {
  param([string[]]$AwsArgs)

  $out = & uv @awsBase @AwsArgs
  if ($LASTEXITCODE -ne 0) {
    throw "aws failed: aws $($AwsArgs -join ' ')"
  }

  $text = ($out -join "`n").Trim()
  if ($text.Length -eq 0) {
    return $null
  }

  return $text | ConvertFrom-Json
}

function Ensure-EventBus {
  $eventBuses = Invoke-AwsJson @("events", "list-event-buses", "--name-prefix", "ycc-events")
  $existing = @($eventBuses.EventBuses | Where-Object { $_.Name -eq "ycc-events" }) | Select-Object -First 1

  if ($null -ne $existing) {
    return $existing
  }

  return Invoke-AwsJson @(
    "events", "create-event-bus",
    "--name", "ycc-events",
    "--tags", "Key=Project,Value=YCC", "Key=ManagedBy,Value=CodexMCP", "Key=Environment,Value=prod"
  )
}

$identity = Invoke-AwsJson @("sts", "get-caller-identity")
Write-Host "Using $($identity.Arn)"

$runtimePolicyPath = Join-Path $workspace "infra/ycc-phase2-lambda-runtime-policy.json"
$null = Invoke-AwsJson @(
  "iam", "put-role-policy",
  "--role-name", "ycyyy-1778040454500",
  "--policy-name", "YccApiPhase2RuntimePolicy",
  "--policy-document", "file://$runtimePolicyPath"
)
Write-Host "Applied Lambda runtime policy YccApiPhase2RuntimePolicy."

$eventBus = Ensure-EventBus
Write-Host "Event bus ready: $($eventBus.Arn)"

$envPath = Join-Path $env:TEMP "ycc-api-lambda-env-ycc-events.json"
$envJson = @'
{
  "Variables": {
    "APP_ENV": "prod",
    "AWS_NODEJS_CONNECTION_REUSE_ENABLED": "1",
    "COGNITO_USER_POOL_ID": "us-east-1_63U9PflAX",
    "COGNITO_USER_POOL_CLIENT_ID": "2i2nvtt41l94n0mivc4tu4f9ms",
    "DB_PROXY_ENDPOINT": "proxy-1778040454500-database-1ycc.proxy-cuvgmek2eh9j.us-east-1.rds.amazonaws.com",
    "DB_PORT": "5432",
    "DB_NAME": "postgresycc",
    "DB_SECRET_ARN": "arn:aws:secretsmanager:us-east-1:374587466106:secret:rds-db-credentials/database-1ycc/postgresycc/1778040454500-6vRH4q",
    "EVENT_BUS_NAME": "ycc-events",
    "S3_APP_BUCKET": "classroom2",
    "FEATURE_DB_WRITES": "pending_schema",
    "FEATURE_BEDROCK": "pending_agent",
    "FEATURE_CONCIERGE_VOICE": "pending_services",
    "CONCIERGE_TRANSCRIBE_LANGUAGE_CODE": "en-US",
    "CONCIERGE_VOICE_BUCKET": "classroom2",
    "CONCIERGE_VOICE_PREFIX": "ycc/concierge-voice/",
    "CONCIERGE_VOICE_TRANSCRIBE_MAX_WAIT_MS": "22000",
    "CONCIERGE_POLLY_ENGINE": "neural",
    "CONCIERGE_POLLY_VOICE_ID": "Joanna",
    "FEATURE_SES": "pending_identity"
  }
}
'@
$envJson | Set-Content -LiteralPath $envPath -Encoding ascii

$null = Invoke-AwsJson @(
  "lambda", "update-function-configuration",
  "--function-name", "ycyyy",
  "--environment", "file://$envPath"
)

& uv @awsBase @("lambda", "wait", "function-updated", "--function-name", "ycyyy") | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "lambda wait function-updated failed"
}

Write-Host "Updated Lambda EVENT_BUS_NAME to ycc-events."

$stageArn = "arn:aws:apigateway:${Region}::/apis/13710cp67l/stages/" + '$default'
$null = Invoke-AwsJson @(
  "apigatewayv2", "tag-resource",
  "--resource-arn", $stageArn,
  "--tags", "Project=YCC,ManagedBy=CodexMCP,Environment=prod"
)

Write-Host "Tagged API Gateway default stage."
