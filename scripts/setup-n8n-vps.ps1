# ai-shareplus: Automated n8n VPS setup
# This script SSHs into your VPS, installs n8n, configures environment, and starts it.
# Usage: .\scripts\setup-n8n-vps.ps1

param(
    [string]$VpsIp = "157.180.83.77",
    [string]$SshUser = "root",
    [string]$SshPort = "22",
    [string]$N8nDomain = ""
)

$ProjectDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "==================================="
Write-Host " ai-shareplus n8n VPS Setup"
Write-Host "==================================="
Write-Host "VPS: ${SshUser}@${VpsIp}:${SshPort}"
Write-Host ""

# Check for ssh
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] ssh is not available. Please enable OpenSSH Client in Windows Optional Features."
    exit 1
}
if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] scp is not available."
    exit 1
}

# Prompt for domain if not provided
if ([string]::IsNullOrWhiteSpace($N8nDomain)) {
    $N8nDomain = Read-Host "Enter the domain for n8n (e.g., n8n.yourdomain.com, or press Enter to use IP)"
    if ([string]::IsNullOrWhiteSpace($N8nDomain)) {
        $N8nDomain = $VpsIp
        Write-Host "Using IP as domain: $N8nDomain"
    }
}

# Collect secrets securely
Write-Host ""
Write-Host "Enter API keys and secrets. Leave empty to skip (you can edit .env on VPS later)."
Write-Host ""

function Read-Secret([string]$Prompt) {
    $secure = Read-Host -AsSecureString $Prompt
    if ([string]::IsNullOrWhiteSpace((New-Object PSCredential("u", $secure)).GetNetworkCredential().Password)) {
        return ""
    }
    return [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    )
}

$SupabaseUrl = Read-Secret "SUPABASE_URL (e.g., https://xxxx.supabase.co)"
$SupabaseServiceKey = Read-Secret "SUPABASE_SERVICE_ROLE_KEY"
$GeminiKey = Read-Secret "GEMINI_API_KEY"
$DeeplKey = Read-Secret "DEEPL_API_KEY (optional)"
$FirecrawlKey = Read-Secret "FIRECRAWL_API_KEY (optional)"
$YouTubeKey = Read-Secret "YOUTUBE_DATA_API_KEY (optional)"
$NextPublicSiteUrl = Read-Secret "NEXT_PUBLIC_SITE_URL (e.g., https://shareplus-self.vercel.app)"
$RevalidateSecret = Read-Secret "REVALIDATE_SECRET"

# Generate encryption key locally using .NET crypto
Write-Host ""
Write-Host "Generating encryption key locally..."
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$EncryptionKey = [Convert]::ToBase64String($bytes)

# Build .env content
$envContent = @"
N8N_HOST=$N8nDomain
GENERIC_TIMEZONE=Asia/Jerusalem
N8N_ENCRYPTION_KEY=$EncryptionKey

SUPABASE_URL=$SupabaseUrl
SUPABASE_SERVICE_ROLE_KEY=$SupabaseServiceKey
GEMINI_API_KEY=$GeminiKey
DEEPL_API_KEY=$DeeplKey
FIRECRAWL_API_KEY=$FirecrawlKey
YOUTUBE_DATA_API_KEY=$YouTubeKey
NEXT_PUBLIC_SITE_URL=$NextPublicSiteUrl
REVALIDATE_SECRET=$RevalidateSecret
"@

# Test SSH connection
Write-Host ""
Write-Host "Testing SSH connection to $VpsIp..."
ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -p $SshPort "${SshUser}@${VpsIp}" "echo 'SSH connection OK'" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Could not connect via SSH. Check IP, user, port, and that SSH is enabled."
    exit 1
}
Write-Host "SSH connection successful."
Write-Host ""

# Create temp directory on VPS
Write-Host "Creating workspace on VPS..."
ssh -p $SshPort "${SshUser}@${VpsIp}" "mkdir -p ~/n8n && cd ~/n8n && pwd"

# Copy files
Write-Host "Copying installation files to VPS..."
scp -P $SshPort "$ProjectDir\n8n\vps-install.sh" "${SshUser}@${VpsIp}:/root/n8n/"
scp -P $SshPort "$ProjectDir\n8n\docker-compose.yml" "${SshUser}@${VpsIp}:/root/n8n/"
scp -P $SshPort "$ProjectDir\n8n\Caddyfile" "${SshUser}@${VpsIp}:/root/n8n/"
scp -P $SshPort "$ProjectDir\n8n\.env.example" "${SshUser}@${VpsIp}:/root/n8n/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to copy files. Check permissions."
    exit 1
}

# Generate .env locally (temp file), SCP to VPS, then delete
Write-Host "Generating .env locally..."
$TempEnvFile = Join-Path $env:TEMP "n8n.env"
$envContent | Out-File -FilePath $TempEnvFile -Encoding utf8 -Force
Write-Host "Temp .env created: $TempEnvFile"

Write-Host "Copying .env to VPS..."
scp -P $SshPort $TempEnvFile "${SshUser}@${VpsIp}:/root/n8n/.env"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to copy .env file."
    Remove-Item $TempEnvFile -Force -ErrorAction SilentlyContinue
    exit 1
}
Remove-Item $TempEnvFile -Force -ErrorAction SilentlyContinue
Write-Host ".env copied to VPS and local temp deleted."

# Run install script
Write-Host ""
Write-Host "Running n8n installer on VPS..."
ssh -p $SshPort "${SshUser}@${VpsIp}" "cd ~/n8n && bash vps-install.sh '$N8nDomain'"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Installation script failed. Check output above."
    exit 1
}

# Start n8n
Write-Host "Starting n8n..."
ssh -p $SshPort "${SshUser}@${VpsIp}" "cd ~/n8n && docker-compose up -d"

Write-Host ""
Write-Host "==================================="
Write-Host " Setup Complete"
Write-Host "==================================="
Write-Host ""
Write-Host "n8n should be available at:"
Write-Host "  https://$N8nDomain  (if DNS is set up)"
Write-Host "  or http://${VpsIp}:5678 (direct, less secure)"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Create owner account in n8n UI"
Write-Host "  2. Set environment variables in n8n Settings -> Variables"
Write-Host "  3. Create credential 'supabase-service-role'"
Write-Host "  4. Import workflows from n8n/workflows/"
Write-Host "  5. Activate workflows"
Write-Host ""
