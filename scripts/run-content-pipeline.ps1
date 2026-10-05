param(
  [string]$SupabaseUrl = "https://bmnsaeqdudktftnacttk.supabase.co",
  [string]$SiteUrl = "https://shareplus-self.vercel.app",
  [int]$ProcessLimit = 10
)

$ErrorActionPreference = "Stop"
$fetchScript = Join-Path $PSScriptRoot "fetch-sources-now.mjs"
$processScript = Join-Path $PSScriptRoot "process-pending-now.mjs"

function Read-Secret([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

Write-Host "ai-shareplus content pipeline" -ForegroundColor Cyan
Write-Host "Values are used only for this run and are not saved."

$serviceKey = Read-Secret "Supabase service_role key"
$geminiKey = Read-Secret "Gemini API key"
$youtubeKey = Read-Secret "YouTube Data API key (optional; Enter to skip)"
$firecrawlKey = Read-Secret "Firecrawl API key (optional; Enter to skip)"
$revalidateSecret = Read-Secret "Vercel revalidate secret (optional; Enter to skip)"

if ([string]::IsNullOrWhiteSpace($serviceKey)) { throw "Supabase service_role key is required" }
if ([string]::IsNullOrWhiteSpace($geminiKey)) { throw "Gemini API key is required" }

$env:SUPABASE_URL = $SupabaseUrl.Trim()
$env:SUPABASE_SERVICE_ROLE_KEY = $serviceKey.Trim()
$env:GEMINI_API_KEY = $geminiKey.Trim()
$env:YOUTUBE_DATA_API_KEY = $youtubeKey.Trim()
$env:FIRECRAWL_API_KEY = $firecrawlKey.Trim()
$env:NEXT_PUBLIC_SITE_URL = $SiteUrl.Trim()
$env:REVALIDATE_SECRET = $revalidateSecret.Trim()
$env:PROCESS_LIMIT = "$ProcessLimit"

Write-Host "`n[1/2] Fetching new content from sources..." -ForegroundColor Cyan
node $fetchScript
if ($LASTEXITCODE -ne 0) { throw "Source ingestion failed" }

Write-Host "`n[2/2] Processing pending articles with Gemini..." -ForegroundColor Cyan
node $processScript
if ($LASTEXITCODE -ne 0) { throw "Article processing failed" }

Write-Host "`nPipeline completed. Open https://shareplus-self.vercel.app/he" -ForegroundColor Green
