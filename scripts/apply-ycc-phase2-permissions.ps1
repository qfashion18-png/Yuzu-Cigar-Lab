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

$functionConfig = Invoke-AwsJson @(
  "lambda", "get-function-configuration",
  "--function-name", "ycyyy"
)
$variables = [ordered]@{}
foreach ($property in $functionConfig.Environment.Variables.PSObject.Properties) {
  $variables[$property.Name] = [string]$property.Value
}
$variables["EVENT_BUS_NAME"] = "ycc-events"
$environmentJson = @{ Variables = $variables } | ConvertTo-Json -Depth 10 -Compress

$null = Invoke-AwsJson @(
  "lambda", "update-function-configuration",
  "--function-name", "ycyyy",
  "--environment", $environmentJson,
  "--revision-id", $functionConfig.RevisionId
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
