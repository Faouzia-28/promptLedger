#!/bin/bash
set -e

echo "=== Logs EC2 Docker Init ===" >> /var/log/user-data.log
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

# Create .env file for ELK stack
cat > .elk.env << EOF
ELASTIC_PASSWORD=changeme
ELASTICSEARCH_HOSTS=http://elasticsearch:9200
EOF

# Build and start ELK services with docker-compose
docker-compose -f docker-compose.logs.yml up -d

echo "ELK services started at $(date)" >> /var/log/user-data.log
docker-compose -f docker-compose.logs.yml ps >> /var/log/user-data.log

echo "Waiting for Kibana to be ready..." >> /var/log/user-data.log
for i in {1..60}; do
  if curl -f http://localhost:5601/api/status 2>/dev/null; then
    echo "Kibana is ready!" >> /var/log/user-data.log
    break
  fi
  echo "Waiting... ($i/60)" >> /var/log/user-data.log
  sleep 2
done

echo "Logs init completed successfully at $(date)" >> /var/log/user-data.log
