# PowerShell script: deploy ai-shareplus frontend to Vercel directly
# This does NOT require Git. It uses the Vercel CLI and local .env.local.
# Usage: .\scripts\deploy-live.ps1

$ProjectDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location -Path "$ProjectDir\frontend"

Write-Host "==================================="
Write-Host " ai-shareplus Live Deploy Script"
Write-Host "==================================="

# Check Vercel CLI
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    Write-Host "❌ npx is not available. Install Node.js first: https://nodejs.org"
    exit 1
}

# Check login
Write-Host "Checking Vercel login status..."
$whoami = npx vercel whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "You are not logged in to Vercel."
    Write-Host "Please run: npx vercel login"
    Write-Host "Then re-run this script."
    exit 1
}

Write-Host "Logged in as: $whoami"

# Check env file
$EnvFile = ".env.local"
if (-not (Test-Path $EnvFile)) {
    Write-Host "❌ $EnvFile not found."
    Write-Host "Create it from env.example and fill in real values first."
    exit 1
}

# Push env vars to Vercel Production
Write-Host "Pushing environment variables to Vercel Production..."
Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }

    $idx = $line.IndexOf("=")
    if ($idx -lt 0) { return }

    $key = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()

    # Remove surrounding quotes
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }

    if ([string]::IsNullOrWhiteSpace($value)) {
        Write-Host "⚠️  Skipping empty variable: $key"
        return
    }

    # Only push frontend-safe variables
    if ($key -like "NEXT_PUBLIC_*" -or $key -eq "REVALIDATE_SECRET") {
        Write-Host "  → Setting $key"
        $value | npx vercel env add $key production 2>&1 | Out-Null
    } else {
        Write-Host "  ⏭ Skipping $key (backend/n8n secret - do not push to Vercel)"
    }
}

# Deploy
Write-Host ""
Write-Host "Deploying to Vercel Production..."
npx vercel --prod

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deployment complete!"
    Write-Host "Check your Vercel Dashboard for the live URL."
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed. Check the error above."
}
