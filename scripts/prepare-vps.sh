#!/usr/bin/env bash
# =============================================================================
# One-time VPS bootstrap — run on a fresh Ubuntu 22/24 VPS
# Usage: ssh root@72.62.52.246 "bash -s" < scripts/prepare-vps.sh
# =============================================================================
set -euo pipefail

REPO_URL="https://github.com/Tarboucha/CommMobile.git"
REPO_DIR="/opt/kodo"
DEPLOY_USER="kodo"

echo "══════════════════════════════════════════════════════════"
echo " KoDo VPS Bootstrap"
echo "══════════════════════════════════════════════════════════"

# ── 1. System updates ───────────────────────────────────────
echo "→ Updating system..."
apt update -qq && apt upgrade -y -qq

# ── 2. Essentials ───────────────────────────────────────────
echo "→ Installing essentials..."
apt install -y -qq git curl ufw fail2ban

# ── 3. Docker ───────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "→ Installing Docker..."
  curl -fsSL https://get.docker.com | sh
else
  echo "→ Docker OK: $(docker --version)"
fi

if ! docker compose version &>/dev/null; then
  echo "→ Installing Docker Compose plugin..."
  apt install -y -qq docker-compose-plugin
else
  echo "→ Docker Compose OK: $(docker compose version --short)"
fi

# ── 4. Deploy user ──────────────────────────────────────────
if ! id "$DEPLOY_USER" &>/dev/null; then
  echo "→ Creating '$DEPLOY_USER' user..."
  useradd -m -s /bin/bash "$DEPLOY_USER"
  usermod -aG docker "$DEPLOY_USER"
  mkdir -p /home/$DEPLOY_USER/.ssh
  cp /root/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/ 2>/dev/null || true
  chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
  chmod 700 /home/$DEPLOY_USER/.ssh
  chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys 2>/dev/null || true
else
  echo "→ User '$DEPLOY_USER' exists"
fi

# ── 5. Firewall (skipped — enable when going to production)
# When ready, run on VPS:
#   ufw allow 22/tcp
#   ufw allow 80/tcp
#   ufw allow 443/tcp
#   ufw --force enable
echo "→ Firewall skipped (all ports open for now)"

# ── 6. SSH hardening (skipped — enable when all devices have SSH keys)
# When ready, uncomment and run on VPS:
#   sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
#   sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
#   systemctl reload sshd
echo "→ SSH hardening skipped (password login stays enabled)"

# ── 7. Clone repo ──────────────────────────────────────────
if [ ! -d "$REPO_DIR" ]; then
  echo "→ Cloning repo..."
  git clone "$REPO_URL" "$REPO_DIR"
  chown -R $DEPLOY_USER:$DEPLOY_USER "$REPO_DIR"
else
  echo "→ Repo exists at $REPO_DIR"
fi

# ── 8. .env placeholder ────────────────────────────────────
if [ ! -f "$REPO_DIR/.env" ]; then
  cp "$REPO_DIR/.env.example" "$REPO_DIR/.env" 2>/dev/null || touch "$REPO_DIR/.env"
  chmod 600 "$REPO_DIR/.env"
  chown $DEPLOY_USER:$DEPLOY_USER "$REPO_DIR/.env"
fi

echo ""
echo "══════════════════════════════════════════════════════════"
echo " Done! Next steps:"
echo ""
echo "  1. nano $REPO_DIR/.env     ← fill production secrets"
echo "  2. cd $REPO_DIR"
echo "  3. docker compose -f docker-compose.yml \\"
echo "       -f docker-compose.prod.yml up --build -d"
echo "  4. Issue TLS cert (see docs/ci-cd-pipeline.md)"
echo "══════════════════════════════════════════════════════════"
