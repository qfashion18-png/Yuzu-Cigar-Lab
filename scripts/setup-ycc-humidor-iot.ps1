param(
  [string]$Profile = "ycc-mcp",
  [string]$Region = "us-east-1",
  [string]$FunctionName = "ycyyy",
  [string]$FunctionQualifier = "",
  [string]$RuleName = "YccHumidorTelemetryToLambda",
  [string]$PolicyName = "YccHumidorDeviceTelemetryPolicy",
  [string]$ThingTypeName = "YccHumidorDevice",
  [string]$SampleThingName = "",
  [switch]$ProvisionSampleCertificate
)

$ErrorActionPreference = "Stop"

function Invoke-AwsJson {
  param([string[]]$Arguments)

  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & uv tool run --from awscli aws --profile $Profile --region $Region @Arguments --output json 2>&1
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($LASTEXITCODE -ne 0) {
    throw "AWS CLI failed: aws $($Arguments -join ' ')`n$output"
  }

  if ([string]::IsNullOrWhiteSpace($output)) {
    return $null
  }

  return $output | ConvertFrom-Json
}

function Invoke-AwsText {
  param([string[]]$Arguments)

  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & uv tool run --from awscli aws --profile $Profile --region $Region @Arguments --output text 2>&1
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($LASTEXITCODE -ne 0) {
    throw "AWS CLI failed: aws $($Arguments -join ' ')`n$output"
  }

  return [string]$output
}

function Invoke-Aws {
  param([string[]]$Arguments)

  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & uv tool run --from awscli aws --profile $Profile --region $Region @Arguments 2>&1
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($LASTEXITCODE -ne 0) {
    throw "AWS CLI failed: aws $($Arguments -join ' ')`n$output"
  }

  return $output
}

function Test-AwsCommand {
  param([string[]]$Arguments)

  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & uv tool run --from awscli aws --profile $Profile --region $Region @Arguments 2>&1
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  return @{
    Success = $LASTEXITCODE -eq 0
    Output = [string]$output
  }
}

$workspace = (Resolve-Path ".").Path
$tempDir = Join-Path $workspace "output\aws-cli-tmp"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

$identity = Invoke-AwsJson @("sts", "get-caller-identity")
$accountId = [string]$identity.Account
$functionArnBase = "arn:aws:lambda:${Region}:${accountId}:function:${FunctionName}"
$functionArn = if ([string]::IsNullOrWhiteSpace($FunctionQualifier)) { $functionArnBase } else { "${functionArnBase}:${FunctionQualifier}" }
$ruleArn = "arn:aws:iot:${Region}:${accountId}:rule/${RuleName}"

$policyDocument = @{
  Version = "2012-10-17"
  Statement = @(
    @{
      Effect = "Allow"
      Action = @("iot:Connect")
      Resource = @("arn:aws:iot:${Region}:${accountId}:client/`${iot:Connection.Thing.ThingName}")
      Condition = @{
        Bool = @{
          "iot:Connection.Thing.IsAttached" = "true"
        }
      }
    },
    @{
      Effect = "Allow"
      Action = @("iot:Publish")
      Resource = @("arn:aws:iot:${Region}:${accountId}:topic/ycc/humidor/`${iot:Connection.Thing.ThingName}/telemetry")
    }
  )
}
$policyPath = Join-Path $tempDir "ycc-humidor-device-policy.json"
$policyDocument | ConvertTo-Json -Depth 12 | Set-Content -Path $policyPath -Encoding ASCII

$existingPolicy = Test-AwsCommand @("iot", "get-policy", "--policy-name", $PolicyName)
if ($existingPolicy.Success) {
  $versions = Invoke-AwsJson @("iot", "list-policy-versions", "--policy-name", $PolicyName)
  $nonDefaultVersions = @($versions.policyVersions | Where-Object { -not $_.isDefaultVersion } | Sort-Object createDate)
  if ($versions.policyVersions.Count -ge 5 -and $nonDefaultVersions.Count -gt 0) {
    Invoke-Aws @("iot", "delete-policy-version", "--policy-name", $PolicyName, "--policy-version-id", ([string]$nonDefaultVersions[0].versionId)) | Out-Null
  }
  Invoke-Aws @("iot", "create-policy-version", "--policy-name", $PolicyName, "--policy-document", "file://$policyPath", "--set-as-default") | Out-Null
} else {
  Invoke-Aws @("iot", "create-policy", "--policy-name", $PolicyName, "--policy-document", "file://$policyPath") | Out-Null
}

$permissionStatementId = $RuleName
$policyArgs = @("lambda", "get-policy", "--function-name", $FunctionName)
if (-not [string]::IsNullOrWhiteSpace($FunctionQualifier)) {
  $policyArgs += @("--qualifier", $FunctionQualifier)
}
$lambdaPolicy = Test-AwsCommand $policyArgs
$hasPermission = $lambdaPolicy.Success -and $lambdaPolicy.Output.Contains("`"$permissionStatementId`"")
if (-not $hasPermission) {
  $permissionArgs = @(
    "lambda", "add-permission",
    "--function-name", $FunctionName,
    "--statement-id", $permissionStatementId,
    "--action", "lambda:InvokeFunction",
    "--principal", "iot.amazonaws.com",
    "--source-arn", $ruleArn
  )
  if (-not [string]::IsNullOrWhiteSpace($FunctionQualifier)) {
    $permissionArgs += @("--qualifier", $FunctionQualifier)
  }
  $permissionResult = Test-AwsCommand $permissionArgs
  if (-not $permissionResult.Success -and -not $permissionResult.Output.Contains("ResourceConflictException")) {
    throw "AWS CLI failed: aws $($permissionArgs -join ' ')`n$($permissionResult.Output)"
  }
}

$rulePayload = @{
  sql = "SELECT *, topic() AS topic, topic(3) AS thingName, timestamp() AS receivedAt FROM 'ycc/humidor/+/telemetry'"
  awsIotSqlVersion = "2016-03-23"
  ruleDisabled = $false
  actions = @(
    @{
      lambda = @{
        functionArn = $functionArn
      }
    }
  )
}
$rulePath = Join-Path $tempDir "ycc-humidor-telemetry-rule.json"
$rulePayload | ConvertTo-Json -Depth 12 | Set-Content -Path $rulePath -Encoding ASCII

$existingRule = Test-AwsCommand @("iot", "get-topic-rule", "--rule-name", $RuleName)
if ($existingRule.Success) {
  Invoke-Aws @("iot", "replace-topic-rule", "--rule-name", $RuleName, "--topic-rule-payload", "file://$rulePath") | Out-Null
} else {
  Invoke-Aws @("iot", "create-topic-rule", "--rule-name", $RuleName, "--topic-rule-payload", "file://$rulePath") | Out-Null
}

$existingThingType = Test-AwsCommand @("iot", "describe-thing-type", "--thing-type-name", $ThingTypeName)
if (-not $existingThingType.Success) {
  Invoke-Aws @(
    "iot", "create-thing-type",
    "--thing-type-name", $ThingTypeName,
    "--thing-type-properties", "thingTypeDescription=Yuzu Cigar Club humidor telemetry device"
  ) | Out-Null
}

$endpoint = Invoke-AwsText @("iot", "describe-endpoint", "--endpoint-type", "iot:Data-ATS", "--query", "endpointAddress")

if (-not [string]::IsNullOrWhiteSpace($SampleThingName)) {
  $existingThing = Test-AwsCommand @("iot", "describe-thing", "--thing-name", $SampleThingName)
  if (-not $existingThing.Success) {
    Invoke-Aws @(
      "iot", "create-thing",
      "--thing-name", $SampleThingName,
      "--thing-type-name", $ThingTypeName,
      "--attribute-payload", "attributes={environment=production,domain=humidor}"
    ) | Out-Null
  }

  if ($ProvisionSampleCertificate) {
    $principals = Invoke-AwsJson @("iot", "list-thing-principals", "--thing-name", $SampleThingName)
    if (@($principals.principals).Count -eq 0) {
      $secureDir = Join-Path $workspace "secure\humidor-iot\$SampleThingName"
      New-Item -ItemType Directory -Force -Path $secureDir | Out-Null
      $certificateResult = Invoke-AwsJson @("iot", "create-keys-and-certificate", "--set-as-active")
      $certificateArn = [string]$certificateResult.certificateArn

      [string]$certificateResult.certificatePem | Set-Content -Path (Join-Path $secureDir "device.pem.crt") -Encoding ASCII
      [string]$certificateResult.keyPair.PrivateKey | Set-Content -Path (Join-Path $secureDir "private.pem.key") -Encoding ASCII
      [string]$certificateResult.keyPair.PublicKey | Set-Content -Path (Join-Path $secureDir "public.pem.key") -Encoding ASCII
      @{
        thingName = $SampleThingName
        certificateArn = $certificateArn
        certificateId = [string]$certificateResult.certificateId
        endpoint = $endpoint
        telemetryTopic = "ycc/humidor/$SampleThingName/telemetry"
        createdAt = (Get-Date).ToUniversalTime().ToString("o")
      } | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $secureDir "connection.json") -Encoding ASCII

      Invoke-Aws @("iot", "attach-policy", "--policy-name", $PolicyName, "--target", $certificateArn) | Out-Null
      Invoke-Aws @("iot", "attach-thing-principal", "--thing-name", $SampleThingName, "--principal", $certificateArn) | Out-Null
    }
  }
}

[pscustomobject]@{
  accountId = $accountId
  region = $Region
  endpoint = $endpoint.Trim()
  policyName = $PolicyName
  ruleName = $RuleName
  ruleArn = $ruleArn
  functionArn = $functionArn
  thingTypeName = $ThingTypeName
  sampleThingName = $SampleThingName
  telemetryTopic = "ycc/humidor/{thingName}/telemetry"
} | ConvertTo-Json -Depth 6
