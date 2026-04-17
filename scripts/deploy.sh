#!/usr/bin/env bash
# =============================================================================
# Manual deploy — run from your laptop when GitHub Actions is down or you
# need a quick push. Does the same thing as deploy.yml.
#
# Usage: ./scripts/deploy.sh
# =============================================================================
set -euo pipefail

VPS_HOST="${VPS_HOST:-72.62.52.246}"
VPS_USER="${VPS_USER:-kodo}"
REPO_DIR="/opt/kodo"

echo "══════════════════════════════════════════════════════════"
echo " Deploying to $VPS_USER@$VPS_HOST"
echo "══════════════════════════════════════════════════════════"

ssh "$VPS_USER@$VPS_HOST" bash <<DEPLOY
  set -euo pipefail
  cd $REPO_DIR

  echo "→ Pulling latest code..."
  git pull origin main

  echo "→ Building and starting containers..."
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

  echo "→ Running migrations..."
  docker compose exec -T kodo-api npx prisma migrate deploy 2>/dev/null || true

  echo "→ Health checks..."
  sleep 5
  for endpoint in "http://localhost:3002/api/v1/health" "http://localhost:3004/health" "http://localhost:3001/health"; do
    if curl -fsS "\$endpoint" > /dev/null 2>&1; then
      echo "  ✓ \$endpoint"
    else
      echo "  ✗ \$endpoint FAILED"
      exit 1
    fi
  done

  echo ""
  echo "✅ Deploy complete"
DEPLOY
