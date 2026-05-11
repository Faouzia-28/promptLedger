#!/bin/bash
set -e

echo "=== Frontend EC2 Init ===" >> /var/log/user-data.log
exec >> /var/log/user-data.log 2>&1

# Update system
apt-get update
apt-get upgrade -y
apt-get install -y curl git wget build-essential

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Clone/pull repo
if [ -z "${repo_clone_url}" ]; then
  echo "ERROR: repo_clone_url is empty. Set var.repo_clone_url in terraform.tfvars." >&2
  exit 1
fi

# Disable interactive git prompts
export GIT_TERMINAL_PROMPT=0

cd /opt
if [ ! -d promptledger ]; then
  echo "Cloning repository from ${repo_clone_url}..." | tee -a /var/log/user-data.log
  timeout 60 git clone "${repo_clone_url}" promptledger 2>&1 | tee -a /var/log/user-data.log || {
    echo "Failed to clone repository. Retrying with shallow clone..." | tee -a /var/log/user-data.log
    timeout 60 git clone --depth 1 "${repo_clone_url}" promptledger 2>&1 | tee -a /var/log/user-data.log || exit 1
  }
else
  cd promptledger && git pull origin main 2>&1 | tee -a /var/log/user-data.log
fi

cd /opt/promptledger/frontend

# Install dependencies
npm ci --prefer-offline --no-audit

# Build Next.js app
# backend_url already includes the scheme and port, so avoid prefixing http:// twice.
NEXT_PUBLIC_API_URL="${backend_url}/api/v1" npm run build

# Create a systemd service so the frontend stays up after cloud-init exits
cat > /etc/systemd/system/promptledger-frontend.service << EOF
[Unit]
Description=PromptLedger Frontend
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/promptledger/frontend
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start -- --hostname 0.0.0.0 --port 3000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now promptledger-frontend

echo "Frontend init completed at $(date)" >> /var/log/user-data.log
