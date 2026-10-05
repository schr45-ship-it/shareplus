#!/usr/bin/env bash
# One-command n8n installer for ai-shareplus on Ubuntu/Debian VPS
# Usage: bash vps-install.sh

set -e

echo "=================================="
echo " ai-shareplus n8n VPS Installer"
echo "=================================="
echo ""

# Prompt for domain (or accept as first argument)
if [ -n "$1" ]; then
  N8N_DOMAIN="$1"
else
  read -rp "Enter the domain for n8n (e.g., n8n.yourdomain.com): " N8N_DOMAIN
fi

if [ -z "$N8N_DOMAIN" ]; then
  echo "❌ Domain is required."
  exit 1
fi

# Update system
echo "Updating system packages..."
apt-get update && apt-get upgrade -y

# Install Docker
if ! command -v docker &> /dev/null; then
  echo "Installing Docker..."
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
else
  echo "Docker already installed."
fi

# Install docker-compose standalone if not present
if ! command -v docker-compose &> /dev/null; then
  echo "Installing docker-compose..."
  curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
fi

# Install Caddy
if ! command -v caddy &> /dev/null; then
  echo "Installing Caddy..."
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
  apt-get update
  apt-get install -y caddy
else
  echo "Caddy already installed."
fi

# Create n8n directory
N8N_DIR="$HOME/n8n"
mkdir -p "$N8N_DIR"
cd "$N8N_DIR"

# Generate encryption key
ENCRYPTION_KEY=$(openssl rand -base64 48)

# Write .env file
if [ ! -f ".env" ]; then
  echo "Creating .env file..."
  cat > .env <<EOF
N8N_HOST=$N8N_DOMAIN
GENERIC_TIMEZONE=Asia/Jerusalem
N8N_ENCRYPTION_KEY=$ENCRYPTION_KEY

SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
GEMINI_API_KEY=YOUR_GEMINI_KEY
DEEPL_API_KEY=YOUR_DEEPL_KEY
FIRECRAWL_API_KEY=YOUR_FIRECRAWL_API_KEY
YOUTUBE_DATA_API_KEY=YOUR_YOUTUBE_KEY
NEXT_PUBLIC_SITE_URL=https://your-vercel-site.com
REVALIDATE_SECRET=YOUR_VERCEL_REVALIDATE_SECRET
EOF
  echo "✅ .env created. Edit it with your real secrets before starting n8n."
else
  echo "⚠️  .env already exists. Keeping existing file."
fi

# Download docker-compose.yml and Caddyfile from project (or write inline)
if [ -f "docker-compose.yml" ]; then
  echo "docker-compose.yml already exists. Keeping existing file."
else
  echo "Writing docker-compose.yml..."
  cat > docker-compose.yml <<'EOF'
version: "3"

services:
  n8n:
    image: n8nio/n8n:latest
    restart: always
    ports:
      - "127.0.0.1:5678:5678"
    env_file:
      - .env
    environment:
      - N8N_PROTOCOL=https
      - N8N_LOG_LEVEL=info
      - EXECUTIONS_MODE=regular
      - N8N_BASIC_AUTH_ACTIVE=false
    volumes:
      - ~/.n8n:/home/node/.n8n
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--spider", "http://localhost:5678/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
EOF
fi

# Write Caddyfile
echo "Writing Caddyfile..."
cat > Caddyfile <<EOF
$N8N_DOMAIN {
    reverse_proxy 127.0.0.1:5678
}
EOF

# Copy Caddyfile to Caddy config dir
cp Caddyfile /etc/caddy/Caddyfile

# Firewall
if command -v ufw &> /dev/null; then
  echo "Configuring UFW firewall..."
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
else
  echo "UFW not found. Skipping firewall setup."
fi

# Reload Caddy
echo "Reloading Caddy..."
systemctl reload caddy || systemctl restart caddy

echo ""
echo "=================================="
echo " Installation Complete"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Edit $N8N_DIR/.env with your real secrets."
echo "2. Start n8n with: cd $N8N_DIR && docker-compose up -d"
echo "3. Open https://$N8N_DOMAIN and create the owner account."
echo "4. Import workflows from ai-shareplus/n8n/workflows/"
echo "5. Set n8n environment variables (Settings → Variables) from .env"
echo ""
