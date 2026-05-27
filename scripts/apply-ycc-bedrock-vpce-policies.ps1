param(
  [string]$Profile = "ycc-mcp",
  [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

$awsBase = @("tool", "run", "--from", "awscli", "aws", "--profile", $Profile, "--region", $Region, "--output", "json")
$runtimeEndpointId = "vpce-08ceae2011933db0e"
$agentRuntimeEndpointId = "vpce-0eaf893d65f8ec9f5"
$runtimePolicyPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\infra\ycc-phase45-bedrock-runtime-vpce-policy.json")).Path
$agentRuntimePolicyPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\infra\ycc-phase45-bedrock-agent-runtime-vpce-policy.json")).Path

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
} | ConvertTo-Json
