param(
  [string]$Profile = "ycc-mcp",
  [string]$Region = "us-east-1",
  [string]$RegistrationId = "registration-8720a85d3f2c40d88dae52872699079a",
  [int]$SourceVersionNumber = 0,
  [string]$OptInAttachmentId = "",
  [switch]$Apply
)

$ErrorActionPreference = "Stop"

function Invoke-AwsJson {
  param([string[]]$Arguments)

  $output = & aws @Arguments --profile $Profile --region $Region --output json 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "aws $($Arguments -join ' ') failed: $output"
  }

  if (-not $output) {
    return $null
  }

  return $output | ConvertFrom-Json
}

function Put-TextField {
  param(
    [string]$FieldPath,
    [string]$TextValue
  )

  $args = @(
    "pinpoint-sms-voice-v2", "put-registration-field-value",
    "--registration-id", $RegistrationId,
    "--field-path", $FieldPath,
    "--text-value", $TextValue
  )

  if ($Apply) {
    Invoke-AwsJson -Arguments $args | Out-Null
    Write-Host "updated $FieldPath"
  } else {
    Write-Host "DRY RUN aws $($args -join ' ')"
  }
}

function Put-SelectField {
  param(
    [string]$FieldPath,
    [string[]]$Choices
  )

  $args = @(
    "pinpoint-sms-voice-v2", "put-registration-field-value",
    "--registration-id", $RegistrationId,
    "--field-path", $FieldPath,
    "--select-choices"
  )
  $args += @($Choices)

  if ($Apply) {
    Invoke-AwsJson -Arguments $args | Out-Null
    Write-Host "updated $FieldPath"
  } else {
    Write-Host "DRY RUN aws $($args -join ' ')"
  }
}

function Put-AttachmentField {
  param(
    [string]$FieldPath,
    [string]$RegistrationAttachmentId
  )

  if (-not $RegistrationAttachmentId) {
    throw "Missing attachment id for $FieldPath. Pass -OptInAttachmentId or keep the existing field in the console."
  }

  $args = @(
    "pinpoint-sms-voice-v2", "put-registration-field-value",
    "--registration-id", $RegistrationId,
    "--field-path", $FieldPath,
    "--registration-attachment-id", $RegistrationAttachmentId
  )

  if ($Apply) {
    Invoke-AwsJson -Arguments $args | Out-Null
    Write-Host "updated $FieldPath"
  } else {
    Write-Host "DRY RUN aws $($args -join ' ')"
  }
}

function Get-RegistrationFieldValues {
  param([int]$VersionNumber = 0)

  $args = @(
    "pinpoint-sms-voice-v2", "describe-registration-field-values",
    "--registration-id", $RegistrationId
  )

  if ($VersionNumber -gt 0) {
    $args += @("--version-number", [string]$VersionNumber)
  }

  return Invoke-AwsJson -Arguments $args
}

function Copy-RegistrationFieldValue {
  param([object]$FieldValue)

  if ($null -ne $FieldValue.TextValue) {
    Put-TextField -FieldPath $FieldValue.FieldPath -TextValue ([string]$FieldValue.TextValue)
    return
  }

  if ($FieldValue.SelectChoices -and @($FieldValue.SelectChoices).Count -gt 0) {
    Put-SelectField -FieldPath $FieldValue.FieldPath -Choices @($FieldValue.SelectChoices)
    return
  }

  if ($FieldValue.RegistrationAttachmentId) {
    Put-AttachmentField -FieldPath $FieldValue.FieldPath -RegistrationAttachmentId ([string]$FieldValue.RegistrationAttachmentId)
    return
  }

  Write-Host "skipped $($FieldValue.FieldPath): no copyable value"
}

function Test-HasMissingRequiredFields {
  param([object]$FieldValues)

  return [bool](@($FieldValues.RegistrationFieldValues | Where-Object {
    $_.DeniedReason -eq "MISSING_REQUIRED_FIELD"
  }) | Select-Object -First 1)
}

function Select-SourceVersion {
  param([object[]]$RegistrationVersions)

  if ($SourceVersionNumber -gt 0) {
    return $SourceVersionNumber
  }

  foreach ($version in @($RegistrationVersions | Sort-Object VersionNumber -Descending)) {
    $deniedReasons = @($version.DeniedReasons | ForEach-Object { $_.Reason })
    if ($deniedReasons -contains "Missing required field") {
      continue
    }

    $values = Get-RegistrationFieldValues -VersionNumber ([int]$version.VersionNumber)
    if (-not (Test-HasMissingRequiredFields -FieldValues $values)) {
      return [int]$version.VersionNumber
    }
  }

  throw "Could not find a source registration version without missing required fields. Pass -SourceVersionNumber explicitly after reviewing the registration in AWS."
}

$registrationSummary = Invoke-AwsJson -Arguments @(
  "pinpoint-sms-voice-v2", "describe-registrations"
)
$registration = @($registrationSummary.Registrations | Where-Object { $_.RegistrationId -eq $RegistrationId }) | Select-Object -First 1
if (-not $registration) {
  throw "Registration $RegistrationId was not found."
}

$versionsSummary = Invoke-AwsJson -Arguments @(
  "pinpoint-sms-voice-v2", "describe-registration-versions",
  "--registration-id", $RegistrationId
)
$sourceVersion = Select-SourceVersion -RegistrationVersions @($versionsSummary.RegistrationVersions)
$current = Get-RegistrationFieldValues -VersionNumber $sourceVersion

if ($Apply -and @("SUBMITTED", "REVIEWING") -contains $registration.RegistrationStatus) {
  throw "Registration $RegistrationId is already $($registration.RegistrationStatus) on version $($registration.CurrentVersionNumber). Wait for AWS review before creating another version."
}

if (Test-HasMissingRequiredFields -FieldValues $current) {
  throw "Source version $sourceVersion has missing required fields. Choose a complete source with -SourceVersionNumber."
}

$copyableFields = @($current.RegistrationFieldValues | Where-Object {
  $_.FieldPath -and (
    $null -ne $_.TextValue -or
    ($_.SelectChoices -and @($_.SelectChoices).Count -gt 0) -or
    $_.RegistrationAttachmentId
  )
})

if (-not $copyableFields.Count) {
  throw "Source version $sourceVersion has no copyable registration field values."
}

if (-not $OptInAttachmentId) {
  $optInField = @($current.RegistrationFieldValues | Where-Object { $_.FieldPath -eq "messagingUseCase.optInImage" }) | Select-Object -First 1
  $OptInAttachmentId = [string]$optInField.RegistrationAttachmentId
}

$useCaseDetails = "Internal operational alerts for Company Quon LLC administrators only. Messages notify a designated company admin about account confirmation events and fulfillment-review tasks in the private admin console. No public customer recipients, marketing, promotions, product offers, age-restricted content, or shopping links."
$optInDescription = "A Company Quon LLC owner or authorized admin opts in through a private admin settings workflow after signing in. The unchecked SMS opt-in box states: Company Quon LLC admin operational alerts; low-volume alerts; message frequency varies; message and data rates may apply; reply STOP to opt out; reply HELP for help; support@yuzucigarclub.com; and links to public Terms and Privacy pages."
$sample1 = "Company Quon LLC admin alert: Account confirmed for [email]. Status: [status]. Open the private admin console. Reply STOP to opt out."
$sample2 = "Company Quon LLC admin alert: Fulfillment review task [task id] for [email]. Open the private admin console. Reply STOP to opt out."

$overrideFields = @(
  "messagingUseCase.useCaseCategory",
  "messagingUseCase.monthlyMessageVolume",
  "messagingUseCase.optInType",
  "messagingUseCase.useCaseDetails",
  "messagingUseCase.optInDescription",
  "messagingUseCase.optInImage",
  "messageSamples.messageSample1",
  "messageSamples.messageSample2"
)
$copyableNonOverrideFieldCount = @($copyableFields | Where-Object { $overrideFields -notcontains $_.FieldPath }).Count

Write-Host "Registration: $RegistrationId"
Write-Host "Current AWS status: $($registration.RegistrationStatus); current version: $($registration.CurrentVersionNumber); latest denied version: $($registration.LatestDeniedVersionNumber)"
Write-Host "Profile/region: $Profile/$Region"
Write-Host "Source version: $sourceVersion"
Write-Host "Copyable source fields: $($copyableFields.Count)"
Write-Host "Apply mode: $($Apply.IsPresent)"

if ($Apply) {
  $created = Invoke-AwsJson -Arguments @(
    "pinpoint-sms-voice-v2", "create-registration-version",
    "--registration-id", $RegistrationId
  )
  Write-Host "created registration draft version $($created.VersionNumber)"

  foreach ($fieldValue in $copyableFields) {
    if ($overrideFields -contains $fieldValue.FieldPath) {
      continue
    }

    Copy-RegistrationFieldValue -FieldValue $fieldValue
  }
  Write-Host "copied existing non-messaging registration fields from version $sourceVersion"
} else {
  Write-Host "DRY RUN aws pinpoint-sms-voice-v2 create-registration-version --registration-id $RegistrationId"
  Write-Host "DRY RUN copy $copyableNonOverrideFieldCount existing registration fields from version $sourceVersion before applying messaging overrides"
}

Put-SelectField -FieldPath "messagingUseCase.useCaseCategory" -Choices @("ACCOUNT_NOTIFICATIONS")
Put-SelectField -FieldPath "messagingUseCase.monthlyMessageVolume" -Choices @("10")
Put-SelectField -FieldPath "messagingUseCase.optInType" -Choices @("DIGITAL_FORM")
Put-TextField -FieldPath "messagingUseCase.useCaseDetails" -TextValue $useCaseDetails
Put-TextField -FieldPath "messagingUseCase.optInDescription" -TextValue $optInDescription
Put-AttachmentField -FieldPath "messagingUseCase.optInImage" -RegistrationAttachmentId $OptInAttachmentId
Put-TextField -FieldPath "messageSamples.messageSample1" -TextValue $sample1
Put-TextField -FieldPath "messageSamples.messageSample2" -TextValue $sample2

if ($Apply) {
  $submitted = Invoke-AwsJson -Arguments @(
    "pinpoint-sms-voice-v2", "submit-registration-version",
    "--registration-id", $RegistrationId,
    "--aws-review"
  )
  Write-Host "submitted registration version $($submitted.VersionNumber) with status $($submitted.RegistrationVersionStatus)"
} else {
  Write-Host "DRY RUN aws pinpoint-sms-voice-v2 submit-registration-version --registration-id $RegistrationId --aws-review"
  Write-Host "Re-run with -Apply using an admin-capable profile that can call sms-voice registration mutation APIs after the current AWS review is no longer pending."
}
