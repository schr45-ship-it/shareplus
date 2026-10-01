# PowerShell script: push ai-shareplus to GitHub (master branch)
# Usage: .\scripts\push-to-github.ps1
# Requires: PowerShell 5.1+ (run as Administrator if Git needs installation)

param(
    [string]$RepoUrl = "https://github.com/schr45-ship-it/shareplus.git"
)

$ProjectDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location -Path $ProjectDir

function Test-CommandExists {
    param([string]$Command)
    return [bool](Get-Command -Name $Command -ErrorAction SilentlyContinue)
}

function Install-Git {
    Write-Host "Git not found. Attempting to install via winget..."
    if (Test-CommandExists "winget") {
        try {
            winget install --id Git.Git -e --source winget --accept-source-agreements --accept-package-agreements
            Write-Host "Git installed. Please restart this PowerShell session and re-run the script."
            exit 0
        } catch {
            Write-Host "winget installation failed. Falling back to manual download."
        }
    }

    $GitUrl = "https://github.com/git-for-windows/git/releases/download/v2.45.2.windows.1/Git-2.45.2-64-bit.exe"
    $Installer = "$env:TEMP\Git-Installer.exe"
    Write-Host "Downloading Git installer..."
    Invoke-WebRequest -Uri $GitUrl -OutFile $Installer -UseBasicParsing
    Write-Host "Running installer. Follow the prompts."
    Start-Process -FilePath $Installer -ArgumentList "/VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS /COMPONENTS=icons,ext,ext\shellhere,ext\guihere,assoc,assoc_sh" -Wait
    Write-Host "Git installed. Please restart this PowerShell session as Administrator if needed, then re-run the script."
    exit 0
}

Write-Host "==================================="
Write-Host " ai-shareplus GitHub Push Script"
Write-Host "==================================="
Write-Host "Project directory: $ProjectDir"

# Check / install Git
if (-not (Test-CommandExists "git")) {
    Install-Git
}

# Prompt for repo URL if not provided
if ([string]::IsNullOrWhiteSpace($RepoUrl)) {
    $RepoUrl = Read-Host "Enter your GitHub repository URL (e.g., https://github.com/username/ai-shareplus.git)"
}

if ([string]::IsNullOrWhiteSpace($RepoUrl)) {
    Write-Host "❌ Repository URL is required."
    exit 1
}

# Validate URL format
if (-not ($RepoUrl -match '^https?://.+\.git$')) {
    Write-Host "⚠️ URL does not end with .git. Checking anyway..."
}

# Initialize repo if needed
if (-not (Test-Path -Path ".git" -PathType Container)) {
    Write-Host "Initializing Git repository..."
    git init
    git branch -M master
    git remote add origin $RepoUrl
} else {
    Write-Host "Git repository already initialized."
    $existingRemote = git remote get-url origin 2>$null
    if (-not $existingRemote) {
        Write-Host "Adding remote origin..."
        git remote add origin $RepoUrl
    } elseif ($existingRemote -ne $RepoUrl) {
        Write-Host "Updating remote origin..."
        git remote set-url origin $RepoUrl
    }
}

# Configure safe defaults if not set
if (-not (git config user.name 2>$null)) {
    git config user.name "ai-shareplus deployer"
}
if (-not (git config user.email 2>$null)) {
    git config user.email "deploy@ai-shareplus.local"
}

# Add and commit
Write-Host "Adding files..."
git add .

$hasChanges = git status --short
if ([string]::IsNullOrWhiteSpace($hasChanges)) {
    Write-Host "✅ No changes to commit."
} else {
    Write-Host "Committing changes..."
    git commit -m "Initial deploy: ai-shareplus frontend + n8n workflows`n`nGenerated project ready for Vercel deployment."
}

# Push
Write-Host "Pushing to master branch..."
git push -u origin master

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Push successful!"
    Write-Host "Repository: $RepoUrl"
    Write-Host ""
    Write-Host "Next: if Vercel is connected to this repo, deployment should start automatically."
    Write-Host "Otherwise run: cd frontend && npx vercel --prod"
} else {
    Write-Host ""
    Write-Host "❌ Push failed. Common causes:"
    Write-Host "  - You are not authenticated with GitHub (run: gh auth login, or use HTTPS with token)"
    Write-Host "  - The remote URL is incorrect"
    Write-Host "  - The repository does not exist yet"
}
