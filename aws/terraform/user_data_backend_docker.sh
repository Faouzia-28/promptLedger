#!/bin/bash
set -e

echo "=== Backend EC2 Docker Init ===" >> /var/log/user-data.log
exec >> /var/log/user-data.log 2>&1

# Update system
apt-get update
apt-get upgrade -y

# Install Docker
apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Start Docker daemon
systemctl enable docker
systemctl start docker

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
    echo "Failed to clone repository. Checking if public clone works..." | tee -a /var/log/user-data.log
    timeout 60 git clone --depth 1 "${repo_clone_url}" promptledger 2>&1 | tee -a /var/log/user-data.log || exit 1
  }
else
  cd promptledger && git pull origin main 2>&1 | tee -a /var/log/user-data.log
fi

cd /opt/promptledger

# Create .env file for backend services
cat > .env << EOF
DATABASE_URL=postgresql+asyncpg://promptledger:promptledger@postgres:5432/promptledger_db
SECRET_KEY=$(openssl rand -hex 32)
JWT_EXPIRATION_HOURS=24
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2
AWS_REGION=${aws_region}
AWS_S3_BUCKET=${s3_bucket_name}
GITHUB_CLIENT_ID=${github_client_id}
GITHUB_CLIENT_SECRET=${github_client_secret}
ELASTICSEARCH_HOST=${logs_host}
ELASTICSEARCH_PORT=9200
LOGSTASH_HOST=${logs_host}
LOGSTASH_PORT=5000
OPENAI_API_KEY=sk-xxxxx
PROMETHEUS_ENABLED=true
ENABLE_REDIS_RATE_LIMITING=true
EOF

# Build and start services with docker-compose
docker-compose -f docker-compose.prod.yml up -d

echo "Backend services started at $(date)" >> /var/log/user-data.log
docker-compose -f docker-compose.prod.yml ps >> /var/log/user-data.log

echo "Waiting for API to be ready..." >> /var/log/user-data.log
for i in {1..30}; do
  if curl -f http://localhost:8000/health 2>/dev/null; then
    echo "API is ready!" >> /var/log/user-data.log
    break
  fi
  echo "Waiting... ($i/30)" >> /var/log/user-data.log
  sleep 2
done

echo "Backend init completed successfully at $(date)" >> /var/log/user-data.log
