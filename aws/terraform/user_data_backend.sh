#!/bin/bash
set -e

echo "=== Backend EC2 Init ===" >> /var/log/user-data.log
exec >> /var/log/user-data.log 2>&1

# Update system
apt-get update
apt-get upgrade -y
apt-get install -y curl git wget build-essential python3-dev python3-venv python3-pip

# Install Redis
apt-get install -y redis-server
systemctl enable redis-server
systemctl start redis-server

# Install PostgreSQL client (database runs separately or on this instance)
apt-get install -y postgresql-client

# Install PM2 for Node.js process management (if needed for auxiliaries)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
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
    echo "Failed to clone repository. Checking if public clone works..." | tee -a /var/log/user-data.log
    timeout 60 git clone --depth 1 "${repo_clone_url}" promptledger 2>&1 | tee -a /var/log/user-data.log || exit 1
  }
else
  cd promptledger && git pull origin main 2>&1 | tee -a /var/log/user-data.log
fi

cd /opt/promptledger/backend

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip setuptools wheel

# Install backend dependencies
pip install -r requirements.txt

# Create .env file for backend (customize with actual secrets)
cat > .env << EOF
# API Configuration
SECRET_KEY=$(openssl rand -hex 32)
JWT_EXPIRATION_HOURS=24

# Database
DATABASE_URL=postgresql+asyncpg://promptledger:password@localhost:5432/promptledger_db
SQLALCHEMY_ECHO=false

# Redis (for rate limiting - optional)
REDIS_URL=redis://localhost:6379/0
ENABLE_REDIS_RATE_LIMITING=true

# Celery
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

# Observability
PROMETHEUS_ENABLED=true

# AWS S3 for uploads
AWS_REGION=${aws_region}
AWS_S3_BUCKET=${s3_bucket_name}

# GitHub OAuth
GITHUB_CLIENT_ID=${github_client_id}
GITHUB_CLIENT_SECRET=${github_client_secret}

# Logs/Observability
ELASTICSEARCH_HOST=${logs_url}
ELASTICSEARCH_PORT=9200
LOGSTASH_HOST=${logs_url}
LOGSTASH_PORT=5000

# LLM Provider (add your keys)
OPENAI_API_KEY=sk-xxxxx
EOF

# Initialize database (if running PostgreSQL on this instance)
# Otherwise, point DATABASE_URL to managed instance
# createdb -h localhost -U postgres promptledger_db || true
# alembic upgrade head

# Start FastAPI with PM2
pm2 start "bash -c 'source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4'" --name "promptledger-api" --error /var/log/api-error.log --output /var/log/api.log

# Start Celery worker with PM2
pm2 start "bash -c 'source venv/bin/activate && celery -A app.workers.celery_app worker --loglevel=info'" --name "promptledger-celery" --error /var/log/celery-error.log --output /var/log/celery.log

# Start Celery beat (scheduler) with PM2
pm2 start "bash -c 'source venv/bin/activate && celery -A app.workers.celery_app beat --loglevel=info'" --name "promptledger-beat" --error /var/log/beat-error.log --output /var/log/beat.log

pm2 save
pm2 startup

echo "Backend init completed at $(date)" >> /var/log/user-data.log
