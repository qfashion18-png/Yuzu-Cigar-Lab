param(
  [string]$Profile = "ycc-mcp",
  [string]$Region = "us-east-1",
  [string]$FunctionName = "ycyyy",
  [string]$SecretName = "ycc/commerce/prod",
  [Parameter(Mandatory = $true)]
  [string]$CommerceSecretJsonPath,
  [string]$CaBundlePath = ""
)

$ErrorActionPreference = "Stop"

function Invoke-AwsJson {
  param([string[]]$Arguments)

  $awsBase = @("--profile", $Profile, "--region", $Region)
  if ($CaBundlePath) {
    $awsBase += @("--ca-bundle", $CaBundlePath)
  }

  $output = & aws @awsBase @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ($output -join "`n")
  }

  if (-not $output) {
    return $null
  }

  return ($output -join "`n") | ConvertFrom-Json
}

function Invoke-Aws {
  param([string[]]$Arguments)

  $awsBase = @("--profile", $Profile, "--region", $Region)
  if ($CaBundlePath) {
    $awsBase += @("--ca-bundle", $CaBundlePath)
  }

  $output = & aws @awsBase @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ($output -join "`n")
  }

  return $output
}

$secretPath = (Resolve-Path -LiteralPath $CommerceSecretJsonPath).ProviderPath
$secretJson = Get-Content -LiteralPath $secretPath -Raw | ConvertFrom-Json
if (-not $secretJson.stripe.secretKey -or -not $secretJson.stripe.webhookSecret) {
  throw "Commerce secret JSON must include stripe.secretKey and stripe.webhookSecret."
}

$secretArn = $null
try {
  $existing = Invoke-AwsJson @("secretsmanager", "describe-secret", "--secret-id", $SecretName, "--output", "json")
  $secretArn = $existing.ARN
  Invoke-Aws @("secretsmanager", "put-secret-value", "--secret-id", $SecretName, "--secret-string", "file://$secretPath") | Out-Null
} catch {
  $created = Invoke-AwsJson @(
    "secretsmanager",
    "create-secret",
    "--name",
    $SecretName,
    "--description",
    "YCC commerce provider runtime secret",
    "--secret-string",
    "file://$secretPath",
    "--output",
    "json"
  )
  $secretArn = $created.ARN
}

$config = Invoke-AwsJson @("lambda", "get-function-configuration", "--function-name", $FunctionName, "--output", "json")
$variables = @{}
if ($config.Environment -and $config.Environment.Variables) {
  foreach ($property in $config.Environment.Variables.PSObject.Properties) {
    $variables[$property.Name] = [string]$property.Value
  }
}

$variables["COMMERCE_PROVIDER_SECRET_ARN"] = [string]$secretArn
$environmentFile = Join-Path $env:TEMP "ycc-commerce-lambda-env-$([Guid]::NewGuid()).json"
try {
  $environmentJson = @{ Variables = $variables } | ConvertTo-Json -Depth 20 -Compress
  [System.IO.File]::WriteAllText($environmentFile, $environmentJson, [System.Text.UTF8Encoding]::new($false))
  Invoke-Aws @(
    "lambda",
    "update-function-configuration",
    "--function-name",
    $FunctionName,
    "--revision-id",
    $config.RevisionId,
    "--environment",
    "file://$environmentFile"
  ) | Out-Null
  Invoke-Aws @("lambda", "wait", "function-updated", "--function-name", $FunctionName) | Out-Null
} finally {
  Remove-Item -LiteralPath $environmentFile -Force -ErrorAction SilentlyContinue
}

Write-Host "Configured $FunctionName to read commerce provider settings from $secretArn"
