param(
  [string]$SupabaseUrl = "https://bmnsaeqdudktftnacttk.supabase.co",
  [string]$SiteUrl = "https://shareplus-self.vercel.app"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $PSScriptRoot "process-pending-now.mjs"

function Read-Secret([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

Write-Host "Direct pending-article processor" -ForegroundColor Cyan
Write-Host "Values are used only for this run and are not saved." 

$serviceKey = Read-Secret "Supabase service_role key"
$geminiKey = Read-Secret "Gemini API key"
$firecrawlKey = Read-Secret "Firecrawl API key (optional; Enter to skip)"
$revalidateSecret = Read-Secret "Vercel revalidate secret (optional; Enter to skip)"

if ([string]::IsNullOrWhiteSpace($serviceKey)) { throw "Supabase service_role key is required" }
if ([string]::IsNullOrWhiteSpace($geminiKey)) { throw "Gemini API key is required" }

$env:SUPABASE_URL = $SupabaseUrl.Trim()
$env:SUPABASE_SERVICE_ROLE_KEY = $serviceKey.Trim()
$env:GEMINI_API_KEY = $geminiKey.Trim()
$env:FIRECRAWL_API_KEY = $firecrawlKey.Trim()
$env:NEXT_PUBLIC_SITE_URL = $SiteUrl.Trim()
$env:REVALIDATE_SECRET = $revalidateSecret.Trim()

node $scriptPath
