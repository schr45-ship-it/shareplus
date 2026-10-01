#!/usr/bin/env bash
# Deploy ai-shareplus frontend to Vercel
# Usage: bash scripts/deploy-vercel.sh

set -e

cd "$(dirname "$0")/../frontend"

ENV_FILE=".env.local"

echo "==================================="
echo " ai-shareplus Vercel Deploy Script"
echo "==================================="

# Verify Vercel login
if ! npx vercel whoami >/dev/null 2>&1; then
  echo "❌ Not logged in to Vercel. Run: npx vercel login"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ $ENV_FILE not found in frontend/"
  echo "Create it from env.example and fill in real values first."
  exit 1
fi

echo "Pushing environment variables to Vercel Production..."

# Read non-empty lines, skip comments, push to Vercel production env
while IFS='=' read -r key value || [ -n "$key" ]; do
  # Skip comments and empty lines
  case "$key" in
    ""|\#*) continue ;;
  esac

  # Remove surrounding quotes from value if present
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"

  # Skip empty values
  if [ -z "$value" ]; then
    echo "⚠️  Skipping empty variable: $key"
    continue
  fi

  # Only push NEXT_PUBLIC_* and REVALIDATE_SECRET to frontend
  case "$key" in
    NEXT_PUBLIC_*|REVALIDATE_SECRET)
      echo "  → Setting $key"
      printf "%s" "$value" | npx vercel env add "$key" production >/dev/null 2>&1 || true
      ;;
    *)
      echo "  ⏭ Skipping $key (n8n/backend secret — do not push to Vercel)"
      ;;
  esac
done < "$ENV_FILE"

echo ""
echo "Building & deploying to Vercel Production..."
npx vercel --prod

echo ""
echo "✅ Deployment complete!"
echo "Remember to verify environment variables in Vercel Dashboard if needed."
