param(
  [string]$Profile = "ycc-mcp",
  [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

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

function Test-SecurityGroupRule {
  param(
    [string]$GroupId,
    [string]$ReferencedGroupId,
    [int]$Port,
    [bool]$Egress
  )

  $groupResult = Invoke-AwsJson @("ec2", "describe-security-groups", "--group-ids", $GroupId)
  $group = $groupResult.SecurityGroups[0]
  $rules = if ($Egress) { $group.IpPermissionsEgress } else { $group.IpPermissions }

  return @($rules | Where-Object {
    $_.IpProtocol -eq "tcp" `
      -and $_.FromPort -eq $Port `
      -and $_.ToPort -eq $Port `
      -and @($_.UserIdGroupPairs | Where-Object { $_.GroupId -eq $ReferencedGroupId }).Count -gt 0
  }).Count -gt 0
}

$vpcId = "vpc-0d5c8ea6e5be2ad0b"
$lambdaSgId = "sg-00c3d67ac62d92ae7"
$endpointGroupName = "ycc-bedrock-runtime-vpce"
$endpointServiceName = "com.amazonaws.$Region.bedrock-runtime"
$endpointSubnets = @("subnet-0d4aeff46b55c3760", "subnet-0c4a36f3966caa44c")
$policyPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\infra\ycc-phase45-bedrock-runtime-vpce-policy.json")).Path

$groups = Invoke-AwsJson @(
  "ec2", "describe-security-groups",
  "--filters", "Name=vpc-id,Values=$vpcId", "Name=group-name,Values=$endpointGroupName"
)
$endpointSg = $groups.SecurityGroups | Select-Object -First 1

if ($null -eq $endpointSg -or [string]::IsNullOrWhiteSpace($endpointSg.GroupId)) {
  $createdGroup = Invoke-AwsJson @(
    "ec2", "create-security-group",
    "--group-name", $endpointGroupName,
    "--description", "YCC Bedrock Runtime VPC endpoint access from Lambda",
    "--vpc-id", $vpcId
  )
  $endpointSgId = $createdGroup.GroupId
  $null = Invoke-AwsJson @(
    "ec2", "create-tags",
    "--resources", $endpointSgId,
    "--tags", "Key=Project,Value=YCC", "Key=ManagedBy,Value=CodexMCP", "Key=Environment,Value=prod"
  )
} else {
  $endpointSgId = $endpointSg.GroupId
}

$ingressPath = Join-Path $env:TEMP "ycc-bedrock-runtime-vpce-ingress.json"
$egressPath = Join-Path $env:TEMP "ycc-bedrock-runtime-vpce-egress.json"

@"
[
  {
    "IpProtocol": "tcp",
    "FromPort": 443,
    "ToPort": 443,
    "UserIdGroupPairs": [
      {
        "GroupId": "$lambdaSgId",
        "Description": "Allow Lambda to call Bedrock Runtime endpoint"
      }
    ]
  }
]
"@ | Set-Content -LiteralPath $ingressPath -Encoding ascii

@"
[
  {
    "IpProtocol": "tcp",
    "FromPort": 443,
    "ToPort": 443,
    "UserIdGroupPairs": [
      {
        "GroupId": "$endpointSgId",
        "Description": "Allow Lambda to reach Bedrock Runtime VPC endpoint"
      }
    ]
  }
]
"@ | Set-Content -LiteralPath $egressPath -Encoding ascii

if (-not (Test-SecurityGroupRule -GroupId $endpointSgId -ReferencedGroupId $lambdaSgId -Port 443 -Egress $false)) {
  $null = Invoke-AwsJson @(
    "ec2", "authorize-security-group-ingress",
    "--group-id", $endpointSgId,
    "--ip-permissions", "file://$ingressPath"
  )
}

if (-not (Test-SecurityGroupRule -GroupId $lambdaSgId -ReferencedGroupId $endpointSgId -Port 443 -Egress $true)) {
  $null = Invoke-AwsJson @(
    "ec2", "authorize-security-group-egress",
    "--group-id", $lambdaSgId,
    "--ip-permissions", "file://$egressPath"
  )
}

$endpoints = Invoke-AwsJson @(
  "ec2", "describe-vpc-endpoints",
  "--filters", "Name=vpc-id,Values=$vpcId", "Name=service-name,Values=$endpointServiceName"
)
$endpoint = $endpoints.VpcEndpoints | Where-Object { $_.State -ne "deleted" } | Select-Object -First 1

if ($null -eq $endpoint -or [string]::IsNullOrWhiteSpace($endpoint.VpcEndpointId)) {
  $endpointArgs = @(
    "ec2", "create-vpc-endpoint",
    "--vpc-id", $vpcId,
    "--vpc-endpoint-type", "Interface",
    "--service-name", $endpointServiceName,
    "--subnet-ids"
  )
  $endpointArgs += $endpointSubnets
  $endpointArgs += @(
    "--security-group-ids", $endpointSgId,
    "--private-dns-enabled",
    "--tag-specifications", "ResourceType=vpc-endpoint,Tags=[{Key=Project,Value=YCC},{Key=ManagedBy,Value=CodexMCP},{Key=Environment,Value=prod}]"
  )
  $createdEndpoint = Invoke-AwsJson $endpointArgs
  $endpoint = $createdEndpoint.VpcEndpoint
} else {
  $null = Invoke-AwsJson @(
    "ec2", "create-tags",
    "--resources", $endpoint.VpcEndpointId,
    "--tags", "Key=Project,Value=YCC", "Key=ManagedBy,Value=CodexMCP", "Key=Environment,Value=prod"
  )
}

$null = Invoke-AwsJson @(
  "ec2", "modify-vpc-endpoint",
  "--vpc-endpoint-id", $endpoint.VpcEndpointId,
  "--policy-document", "file://$policyPath"
)

[ordered]@{
  EndpointSecurityGroupId = $endpointSgId
  VpcEndpointId = $endpoint.VpcEndpointId
  ServiceName = $endpointServiceName
  State = $endpoint.State
  PolicyDocument = $policyPath
} | ConvertTo-Json
