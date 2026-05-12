param(
  [string]$Profile = "ycc-mcp",
  [string]$Region = "us-east-1",
  [string]$UserPoolId = "us-east-1_63U9PflAX",
  [string]$RoleName = "YccCognitoSmsRole",
  [string]$EnvironmentName = "prod"
)

$ErrorActionPreference = "Stop"

function Invoke-AwsCli {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  & uv tool run --from awscli aws @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "AWS CLI failed: aws $($Arguments -join ' ')"
  }
}

function ConvertTo-FileUriPath {
  param([string]$Path)

  return $Path.Replace("\", "/")
}

$accountId = (& uv tool run --from awscli aws --profile $Profile --region $Region sts get-caller-identity --query Account --output text).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($accountId)) {
  throw "Unable to resolve AWS account for profile '$Profile'."
}

$userPoolArn = (& uv tool run --from awscli aws --profile $Profile --region $Region cognito-idp describe-user-pool --user-pool-id $UserPoolId --query UserPool.Arn --output text).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($userPoolArn)) {
  throw "Unable to resolve Cognito user pool ARN for '$UserPoolId'."
}

$externalId = "ycc-cognito-sms-$accountId-$Region-$EnvironmentName"
$roleArn = "arn:aws:iam::$accountId`:role/$RoleName"
$tempDir = Join-Path $PWD "output\aws-cli-tmp"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$trustPath = Join-Path $tempDir "ycc-cognito-sms-role-trust-policy.json"
$publishPolicyPath = Join-Path $tempDir "ycc-cognito-sms-publish-policy.json"
$mfaConfigPath = Join-Path $tempDir "ycc-cognito-sms-mfa-config.json"

$trustPolicy = @{
  Version = "2012-10-17"
  Statement = @(
    @{
      Effect = "Allow"
      Principal = @{
        Service = "cognito-idp.amazonaws.com"
      }
      Action = "sts:AssumeRole"
      Condition = @{
        StringEquals = @{
          "sts:ExternalId" = $externalId
          "aws:SourceAccount" = $accountId
        }
        ArnLike = @{
          "aws:SourceArn" = $userPoolArn
        }
      }
    }
  )
} | ConvertTo-Json -Depth 12

$publishPolicy = @{
  Version = "2012-10-17"
  Statement = @(
    @{
      Effect = "Allow"
      Action = "sns:Publish"
      Resource = "*"
    }
  )
} | ConvertTo-Json -Depth 12

$mfaConfig = @{
  UserPoolId = $UserPoolId
  SmsMfaConfiguration = @{
    SmsAuthenticationMessage = "Your YCC sign-in code is {####}."
    SmsConfiguration = @{
      SnsCallerArn = $roleArn
      ExternalId = $externalId
      SnsRegion = $Region
    }
  }
  MfaConfiguration = "OPTIONAL"
} | ConvertTo-Json -Depth 12

[System.IO.File]::WriteAllText($trustPath, $trustPolicy, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText($publishPolicyPath, $publishPolicy, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText($mfaConfigPath, $mfaConfig, [System.Text.UTF8Encoding]::new($false))

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& uv tool run --from awscli aws --profile $Profile --region $Region iam get-role --role-name $RoleName *> $null
$roleLookupExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
$roleExists = $roleLookupExitCode -eq 0

if ($roleExists) {
  Invoke-AwsCli -Arguments @(
    "--profile", $Profile,
    "--region", $Region,
    "iam", "update-assume-role-policy",
    "--role-name", $RoleName,
    "--policy-document", "file://$(ConvertTo-FileUriPath $trustPath)"
  )
} else {
  Invoke-AwsCli -Arguments @(
    "--profile", $Profile,
    "--region", $Region,
    "iam", "create-role",
    "--role-name", $RoleName,
    "--description", "Allows the YCC Cognito user pool to send SMS MFA messages through Amazon SNS.",
    "--assume-role-policy-document", "file://$(ConvertTo-FileUriPath $trustPath)",
    "--tags", "Key=Project,Value=YCC", "Key=ManagedBy,Value=CodexMCP", "Key=Environment,Value=$EnvironmentName"
  )
}

Invoke-AwsCli -Arguments @(
  "--profile", $Profile,
  "--region", $Region,
  "iam", "put-role-policy",
  "--role-name", $RoleName,
  "--policy-name", "YccCognitoSmsPublishPolicy",
  "--policy-document", "file://$(ConvertTo-FileUriPath $publishPolicyPath)"
)

Start-Sleep -Seconds 10

Invoke-AwsCli -Arguments @(
  "--profile", $Profile,
  "--region", $Region,
  "cognito-idp", "set-user-pool-mfa-config",
  "--cli-input-json", "file://$(ConvertTo-FileUriPath $mfaConfigPath)"
)

Invoke-AwsCli -Arguments @(
  "--profile", $Profile,
  "--region", $Region,
  "cognito-idp", "get-user-pool-mfa-config",
  "--user-pool-id", $UserPoolId
)
