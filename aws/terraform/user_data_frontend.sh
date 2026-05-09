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

cd /opt
if [ ! -d promptledger ]; then
  git clone "${repo_clone_url}" promptledger
else
  cd promptledger && git pull origin main
fi

cd promptledger/frontend

# Install dependencies
npm ci --prefer-offline --no-audit

# Build Next.js app
NEXT_PUBLIC_API_URL="http://${backend_url}/api/v1" npm run build

# Start with PM2
pm2 start "npm start" --name "promptledger-frontend" --error /var/log/frontend-error.log --output /var/log/frontend.log

# Save PM2 process list
pm2 save
pm2 startup

echo "Frontend init completed at $(date)" >> /var/log/user-data.log
