# ai-shareplus: Fix n8n permissions + configure env on VPS
# This script fixes the EACCES permission error and sets up everything.
# It asks for your VPS password ONCE, then does everything automatically.
# Usage: .\scripts\fix-n8n-vps.ps1

param(
    [string]$VpsIp = "157.180.83.77",
    [string]$SshUser = "root",
    [string]$SshPort = "22"
)

$ProjectDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "=========================================="
Write-Host " ai-shareplus - Fix & Configure n8n on VPS"
Write-Host "=========================================="
Write-Host ""

# Prompt for SSH password
$SecurePassword = Read-Host -AsSecureString "Enter VPS root password"
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
$VpsPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# Download plink if not available (supports -pw flag for password auth)
$PlinkPath = Join-Path $env:TEMP "plink.exe"
if (-not (Test-Path $PlinkPath)) {
    Write-Host "Downloading plink.exe (PuTTY CLI) for password authentication..."
    try {
        Invoke-WebRequest -Uri "https://the.earth.li/~sgtatham/putty/latest/w64/plink.exe" -OutFile $PlinkPath -UseBasicParsing -TimeoutSec 30
    } catch {
        Write-Host "[WARN] Could not download plink. Will try ssh (may need password multiple times)..."
        $PlinkPath = $null
    }
}

function Run-Remote {
    param([string]$Command)
    if ($PlinkPath) {
        $result = & $PlinkPath -ssh -pw "$VpsPassword" -batch -P $SshPort "${SshUser}@${VpsIp}" "$Command" 2>&1
        return $result
    } else {
        $result = ssh -p $SshPort -o StrictHostKeyChecking=accept-new "${SshUser}@${VpsIp}" "$Command" 2>&1
        return $result
    }
}

function Write-Remote {
    param([string]$LocalFile, [string]$RemotePath)
    if ($PlinkPath) {
        & $PlinkPath -scp -pw "$VpsPassword" -batch -P $SshPort $LocalFile "${SshUser}@${VpsIp}:$RemotePath" 2>&1 | Out-Null
        return $LASTEXITCODE
    } else {
        scp -P $SshPort -o StrictHostKeyChecking=accept-new $LocalFile "${SshUser}@${VpsIp}:$RemotePath" 2>&1 | Out-Null
        return $LASTEXITCODE
    }
}

# Test connection
Write-Host ""
Write-Host "Testing connection to ${VpsIp}..."
$test = Run-Remote "echo 'CONNECTION_OK'"
if ($test -notmatch "CONNECTION_OK") {
    Write-Host "[ERROR] Could not connect. Check IP, user, port, password."
    exit 1
}
Write-Host "[OK] Connected to VPS"
Write-Host ""

# ==========================================
# STEP 1: Fix n8n permissions (EACCES fix)
# ==========================================
Write-Host "Step 1: Fixing n8n data directory permissions..."
$fixCmd = @'
cd /root/n8n && docker-compose down 2>/dev/null; mkdir -p /root/.n8n; chown -R 1000:1000 /root/.n8n; echo "PERMISSIONS_FIXED"
'@
$fixResult = Run-Remote $fixCmd
Write-Host $fixResult

# ==========================================
# STEP 2: Collect secrets
# ==========================================
Write-Host ""
Write-Host "Enter API keys and secrets (press Enter to skip):"
Write-Host ""

function Read-Secret([string]$Prompt) {
    $secure = Read-Host -AsSecureString $Prompt
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    return $plain
}

$SupabaseUrl = Read-Secret "SUPABASE_URL (e.g., https://xxxx.supabase.co)"
$SupabaseServiceKey = Read-Secret "SUPABASE_SERVICE_ROLE_KEY"
$GeminiKey = Read-Secret "GEMINI_API_KEY"
$DeeplKey = Read-Secret "DEEPL_API_KEY (optional)"
$FirecrawlKey = Read-Secret "FIRECRAWL_API_KEY (optional)"
$YouTubeKey = Read-Secret "YOUTUBE_DATA_API_KEY (optional)"
$NextPublicSiteUrl = Read-Secret "NEXT_PUBLIC_SITE_URL (e.g., https://shareplus-self.vercel.app)"
$RevalidateSecret = Read-Secret "REVALIDATE_SECRET"

# ==========================================
# STEP 3: Generate encryption key
# ==========================================
Write-Host ""
Write-Host "Generating encryption key..."
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$EncryptionKey = [Convert]::ToBase64String($bytes)

# ==========================================
# STEP 4: Build .env content
# ==========================================
$envContent = @"
N8N_HOST=$VpsIp
GENERIC_TIMEZONE=Asia/Jerusalem
N8N_ENCRYPTION_KEY=$EncryptionKey
N8N_PROTOCOL=http
WEBHOOK_URL=http://${VpsIp}:5678/
N8N_BASIC_AUTH_ACTIVE=false

SUPABASE_URL=$SupabaseUrl
SUPABASE_SERVICE_ROLE_KEY=$SupabaseServiceKey
GEMINI_API_KEY=$GeminiKey
DEEPL_API_KEY=$DeeplKey
FIRECRAWL_API_KEY=$FirecrawlKey
YOUTUBE_DATA_API_KEY=$YouTubeKey
NEXT_PUBLIC_SITE_URL=$NextPublicSiteUrl
REVALIDATE_SECRET=$RevalidateSecret
"@

# Save to temp file and SCP
$TempEnvFile = Join-Path $env:TEMP "n8n.env"
$envContent | Out-File -FilePath $TempEnvFile -Encoding utf8 -Force

Write-Host ""
Write-Host "Writing .env to VPS..."
$scpResult = Write-Remote $TempEnvFile "/root/n8n/.env"
Remove-Item $TempEnvFile -Force -ErrorAction SilentlyContinue

if ($scpResult -ne 0) {
    Write-Host "[ERROR] Failed to write .env"
    exit 1
}
Write-Host "[OK] .env written"

# ==========================================
# STEP 5: Expose n8n on 0.0.0.0 via sed
# ==========================================
Write-Host ""
Write-Host "Updating docker-compose to expose n8n on all interfaces..."
$sedCmd = @'
cd /root/n8n && sed -i "s|127.0.0.1:5678:5678|0.0.0.0:5678:5678|" docker-compose.yml && grep "5678" docker-compose.yml
'@
$sedResult = Run-Remote $sedCmd
Write-Host $sedResult

# ==========================================
# STEP 6: Restart n8n
# ==========================================
Write-Host ""
Write-Host "Restarting n8n..."
$restartCmd = @'
cd /root/n8n && docker-compose down 2>/dev/null; docker-compose up -d; sleep 8; docker-compose ps
'@
$restartResult = Run-Remote $restartCmd
Write-Host $restartResult

# ==========================================
# STEP 7: Verify n8n is running
# ==========================================
Write-Host ""
Write-Host "Verifying n8n is running..."
$verifyCmd = @'
ss -tlnp | grep 5678 && echo "PORT_5678_OPEN" || echo "PORT_5678_NOT_OPEN"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
docker logs --tail 15 n8n-n8n-1 2>&1 || docker logs --tail 15 n8n 2>&1
'@
$verifyResult = Run-Remote $verifyCmd
Write-Host $verifyResult

Write-Host ""
Write-Host "=========================================="
Write-Host " Setup Complete!"
Write-Host "=========================================="
Write-Host ""
Write-Host "n8n should now be accessible at:"
Write-Host "  http://$VpsIp`:5678"
Write-Host ""
Write-Host "Open it in your browser and:"
Write-Host "  1. Create owner account"
Write-Host "  2. Settings -> Variables -> set env vars"
Write-Host "  3. Credentials -> Add 'supabase-service-role'"
Write-Host "  4. Import workflows from n8n/workflows/"
Write-Host "  5. Activate workflows"
Write-Host ""
