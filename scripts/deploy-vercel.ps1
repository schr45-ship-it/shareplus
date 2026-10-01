# Deploy ai-shareplus frontend to Vercel
# Usage: .\scripts\deploy-vercel.ps1

Set-Location -Path "$PSScriptRoot\..\frontend"

$ENV_FILE = ".env.local"

Write-Host "==================================="
Write-Host " ai-shareplus Vercel Deploy Script"
Write-Host "==================================="

# Verify Vercel login
try {
    $null = npx vercel whoami 2>&1
} catch {
    Write-Host "❌ Not logged in to Vercel. Run: npx vercel login"
    exit 1
}

if (-Not (Test-Path $ENV_FILE)) {
    Write-Host "❌ $ENV_FILE not found in frontend/"
    Write-Host "Create it from env.example and fill in real values first."
    exit 1
}

Write-Host "Pushing environment variables to Vercel Production..."

Get-Content $ENV_FILE | ForEach-Object {
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

    # Only push NEXT_PUBLIC_* and REVALIDATE_SECRET to frontend
    if ($key -like "NEXT_PUBLIC_*" -or $key -eq "REVALIDATE_SECRET") {
        Write-Host "  → Setting $key"
        $value | npx vercel env add $key production 2>&1 | Out-Null
    } else {
        Write-Host "  ⏭ Skipping $key (n8n/backend secret — do not push to Vercel)"
    }
}

Write-Host ""
Write-Host "Building & deploying to Vercel Production..."
npx vercel --prod

Write-Host ""
Write-Host "✅ Deployment complete!"
Write-Host "Remember to verify environment variables in Vercel Dashboard if needed."
