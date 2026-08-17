param(
  [string]$Profile = "ycc-mcp",
  [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

$awsBase = @("tool", "run", "--from", "awscli", "aws", "--profile", $Profile, "--region", $Region, "--output", "json")
$runtimePolicyPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\infra\ycc-phase45-bedrock-runtime-vpce-policy.json")).Path
$agentRuntimePolicyPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\infra\ycc-phase45-bedrock-agent-runtime-vpce-policy.json")).Path
$rekognitionPolicyPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\infra\ycc-phase45-rekognition-vpce-policy.json")).Path

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

function Get-AvailableEndpointId {
  param([string]$ServiceName)

  $result = Invoke-AwsJson @(
    "ec2", "describe-vpc-endpoints",
    "--filters", "Name=vpc-id,Values=vpc-0d5c8ea6e5be2ad0b", "Name=service-name,Values=$ServiceName"
  )
  $endpoints = @($result.VpcEndpoints | Where-Object { $_.State -eq "available" })
  if ($endpoints.Count -ne 1) {
    throw "Expected exactly one available endpoint for $ServiceName, found $($endpoints.Count)."
  }

  return $endpoints[0].VpcEndpointId
}

$runtimeEndpointId = Get-AvailableEndpointId "com.amazonaws.$Region.bedrock-runtime"
$agentRuntimeEndpointId = Get-AvailableEndpointId "com.amazonaws.$Region.bedrock-agent-runtime"
$rekognitionEndpointId = Get-AvailableEndpointId "com.amazonaws.$Region.rekognition"

$runtimeResult = Invoke-AwsJson @(
  "ec2", "modify-vpc-endpoint",
  "--vpc-endpoint-id", $runtimeEndpointId,
  "--policy-document", "file://$runtimePolicyPath"
)

$agentRuntimeResult = Invoke-AwsJson @(
  "ec2", "modify-vpc-endpoint",
  "--vpc-endpoint-id", $agentRuntimeEndpointId,
  "--policy-document", "file://$agentRuntimePolicyPath"
)

$rekognitionResult = Invoke-AwsJson @(
  "ec2", "modify-vpc-endpoint",
  "--vpc-endpoint-id", $rekognitionEndpointId,
  "--policy-document", "file://$rekognitionPolicyPath"
)

[ordered]@{
  RuntimeEndpoint = [ordered]@{
    VpcEndpointId = $runtimeEndpointId
    PolicyDocument = $runtimePolicyPath
    Return = $runtimeResult.Return
  }
  AgentRuntimeEndpoint = [ordered]@{
    VpcEndpointId = $agentRuntimeEndpointId
    PolicyDocument = $agentRuntimePolicyPath
    Return = $agentRuntimeResult.Return
  }
  RekognitionEndpoint = [ordered]@{
    VpcEndpointId = $rekognitionEndpointId
    PolicyDocument = $rekognitionPolicyPath
    Return = $rekognitionResult.Return
  }
} | ConvertTo-Json
