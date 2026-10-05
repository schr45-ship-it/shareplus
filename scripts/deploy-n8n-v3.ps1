param(
  [string]$N8nUrl = "http://localhost:5678",
  [string]$ApiKey = "",
  [switch]$SkipVariables,
  [switch]$SkipRun
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$workflowDir = Join-Path $root "n8n\workflows"
$files = @(
  "rss-ingestion-v3.json",
  "youtube-ingestion-v3.json",
  "ai-processing-v3.json"
)

function Read-Secret([string]$Prompt, [string]$Default = "") {
  $display = if ($Default) { "$Prompt [$Default]" } else { $Prompt }
  $secure = Read-Host $display -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
  if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
  return $value.Trim()
}

function Invoke-N8nCall {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Path,
    $Body = $null,
    [switch]$InternalOnly
  )

  $base = $N8nUrl.TrimEnd('/')
  $attempts = @()
  if (-not $InternalOnly) {
    $attempts += @{ Uri = "$base/api/v1$Path"; Auth = 'api-key' }
    $attempts += @{ Uri = "$base/api/v1$Path"; Auth = 'bearer' }
  }
  $attempts += @{ Uri = "$base/rest$Path"; Auth = 'session' }

  $lastError = $null
  foreach ($attempt in $attempts) {
    $params = @{
      Method = $Method
      Uri = $attempt.Uri
      ContentType = "application/json"
      TimeoutSec = 90
      UseBasicParsing = $true
    }
    if ($script:Session) { $params.WebSession = $script:Session }
    if ($script:ApiKey -and $attempt.Auth -eq 'api-key') {
      $params.Headers = @{ 'X-N8N-API-KEY' = $script:ApiKey }
    } elseif ($script:ApiKey -and $attempt.Auth -eq 'bearer') {
      $params.Headers = @{ Authorization = "Bearer $($script:ApiKey)" }
    }
    if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Depth 100 -Compress) }

    try {
      return Invoke-RestMethod @params
    } catch {
      $lastError = $_
      Write-Verbose "Failed $($attempt.Uri): $($_.Exception.Message)"
    }
  }
  throw $lastError
}

function Get-ListItems($Response) {
  if ($null -eq $Response) { return @() }
  if ($Response -is [array]) { return $Response }
  if ($Response.data -is [array]) { return $Response.data }
  if ($Response.data -and $Response.data.data -is [array]) { return $Response.data.data }
  if ($Response.items -is [array]) { return $Response.items }
  return @($Response)
}

function Save-N8nVariable([string]$Key, [string]$Value, $Existing) {
  $payload = @{ key = $Key; value = $Value }
  if ($Existing -and $Existing.id) {
    try {
      Invoke-N8nCall -Method PATCH -Path "/variables/$($Existing.id)" -Body $payload | Out-Null
    } catch {
      Invoke-N8nCall -Method PUT -Path "/variables/$($Existing.id)" -Body $payload | Out-Null
    }
    Write-Host "$Key`: updated"
  } else {
    Invoke-N8nCall -Method POST -Path "/variables" -Body $payload | Out-Null
    Write-Host "$Key`: created"
  }
}

function Save-N8nWorkflow($Workflow, $Existing) {
  $payload = @{
    name = $Workflow.name
    nodes = $Workflow.nodes
    connections = $Workflow.connections
    settings = $Workflow.settings
  }

  if ($Existing -and $Existing.id) {
    try {
      $saved = Invoke-N8nCall -Method PATCH -Path "/workflows/$($Existing.id)" -Body $payload
    } catch {
      $saved = Invoke-N8nCall -Method PUT -Path "/workflows/$($Existing.id)" -Body $payload
    }
    Write-Host "Updated: $($Workflow.name)"
    return $saved
  }

  $saved = Invoke-N8nCall -Method POST -Path "/workflows" -Body $payload
  Write-Host "Created: $($Workflow.name)"
  return $saved
}

function Get-ItemId($Item) {
  if ($null -eq $Item) { return $null }
  if ($Item.id) { return $Item.id }
  if ($Item.data -and $Item.data.id) { return $Item.data.id }
  return $null
}

function Activate-N8nWorkflow([string]$WorkflowId, $Workflow) {
  $versionId = $null
  try {
    $current = Invoke-N8nCall -Method GET -Path "/workflows/$WorkflowId"
    if ($current.versionId) { $versionId = $current.versionId }
    if (-not $versionId -and $current.data -and $current.data.versionId) { $versionId = $current.data.versionId }
  } catch {}

  $attempts = @(
    @{ Method = 'POST'; Path = "/workflows/$WorkflowId/activate"; Body = @{ versionId = $versionId } },
    @{ Method = 'PATCH'; Path = "/workflows/$WorkflowId"; Body = @{ active = $true } },
    @{ Method = 'PUT'; Path = "/workflows/$WorkflowId"; Body = @{ name = $Workflow.name; nodes = $Workflow.nodes; connections = $Workflow.connections; settings = $Workflow.settings; active = $true } }
  )

  foreach ($attempt in $attempts) {
    try {
      Invoke-N8nCall -Method $attempt.Method -Path $attempt.Path -Body $attempt.Body | Out-Null
      return $true
    } catch {}
  }
  return $false
}

Write-Host "n8n automated setup" -ForegroundColor Cyan
Write-Host "Connecting through: $N8nUrl"

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
  $ApiKey = Read-Secret "n8n API key (optional; Enter to use owner login)"
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
  $email = Read-Host "n8n owner email"
  $password = Read-Secret "n8n owner password"

  $login = Invoke-WebRequest -UseBasicParsing -Method Post `
    -Uri "$($N8nUrl.TrimEnd('/'))/rest/login" `
    -ContentType "application/json" `
    -Body (@{ emailOrLdapLoginId = $email; password = $password } | ConvertTo-Json) `
    -SessionVariable Session `
    -TimeoutSec 30

  if ($login.StatusCode -ne 200) { throw "n8n login failed" }
  $script:Session = $Session
  Write-Host "Logged in to n8n." -ForegroundColor Green
} else {
  $script:ApiKey = $ApiKey
  Write-Host "Using n8n API key." -ForegroundColor Green
}

if (-not $SkipVariables) {
  Write-Host "`nSet n8n Variables (values are not printed)" -ForegroundColor Cyan
  $variables = @(
    @{ Key = "SUPABASE_URL"; Prompt = "Supabase URL"; Default = "https://bmnsaeqdudktftnacttk.supabase.co"; Secret = $false },
    @{ Key = "SUPABASE_SERVICE_ROLE_KEY"; Prompt = "Supabase service_role key"; Secret = $true; Required = $true },
    @{ Key = "GEMINI_API_KEY"; Prompt = "Gemini API key"; Secret = $true; Required = $true },
    @{ Key = "YOUTUBE_DATA_API_KEY"; Prompt = "YouTube Data API key"; Secret = $true; Required = $false },
    @{ Key = "FIRECRAWL_API_KEY"; Prompt = "Firecrawl API key"; Secret = $true; Required = $false },
    @{ Key = "NEXT_PUBLIC_SITE_URL"; Prompt = "Site URL"; Default = "https://shareplus-self.vercel.app"; Secret = $false },
    @{ Key = "REVALIDATE_SECRET"; Prompt = "Vercel revalidate secret"; Secret = $true; Required = $false }
  )

  $existingVariables = @{}
  try {
    $response = Invoke-N8nCall -Method GET -Path "/variables?limit=250"
    foreach ($item in (Get-ListItems $response)) {
      if ($item.key) { $existingVariables[$item.key] = $item }
    }
  } catch {
    Write-Warning "Could not list variables: $($_.Exception.Message)"
  }

  foreach ($variable in $variables) {
    $existing = $existingVariables[$variable.Key]
    if ($existing -and -not $variable.Required) {
      Write-Host "$($variable.Key): already set; press Enter to keep it" -ForegroundColor DarkGray
    }
    $value = if ($variable.Secret) {
      Read-Secret $variable.Prompt $variable.Default
    } else {
      $inputValue = Read-Host "$($variable.Prompt)$(if ($variable.Default) { " [$($variable.Default)]" })"
      if ([string]::IsNullOrWhiteSpace($inputValue)) { $variable.Default } else { $inputValue.Trim() }
    }

    if ([string]::IsNullOrWhiteSpace($value) -and $existing) { continue }
    if ([string]::IsNullOrWhiteSpace($value)) {
      if ($variable.Required) { throw "$($variable.Key) is required" }
      continue
    }

    Save-N8nVariable -Key $variable.Key -Value $value -Existing $existing
  }
}

Write-Host "`nDeploying workflows" -ForegroundColor Cyan
$workflowsResponse = Invoke-N8nCall -Method GET -Path "/workflows?limit=250"
$existingWorkflows = @{}
foreach ($item in (Get-ListItems $workflowsResponse)) {
  if ($item.name) { $existingWorkflows[$item.name] = $item }
}

$deployed = @{}
foreach ($file in $files) {
  $json = Get-Content -Raw (Join-Path $workflowDir $file) | ConvertFrom-Json
  $existing = $existingWorkflows[$json.name]
  $saved = Save-N8nWorkflow -Workflow $json -Existing $existing
  $id = Get-ItemId $saved
  if (-not $id) { $id = Get-ItemId $existing }
  if (-not $id) { throw "Could not determine workflow ID for $($json.name)" }
  $deployed[$json.name] = $id

  if (Activate-N8nWorkflow -WorkflowId $id -Workflow $json) {
    Write-Host "Activated: $($json.name)" -ForegroundColor Green
  } else {
    Write-Warning "Could not activate $($json.name). Open it in n8n and press Publish."
  }
}

if (-not $SkipRun) {
  Write-Host "`nStarting immediate processing run" -ForegroundColor Cyan
  foreach ($hook in @('shareplus-rss-v3', 'shareplus-youtube-v3', 'shareplus-ai-v3')) {
    try {
      Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$($N8nUrl.TrimEnd('/'))/webhook/$hook" -TimeoutSec 600 | Out-Null
      Write-Host "$hook`: completed" -ForegroundColor Green
    } catch {
      Write-Warning "$hook`: $($_.Exception.Message)"
    }
  }
}

Write-Host "`nDone. Verify Supabase:" -ForegroundColor Green
Write-Host "  articles: pending -> published"
Write-Host "  article_translations: en, he, es, ar"
Write-Host "Site: https://shareplus-self.vercel.app/he"
