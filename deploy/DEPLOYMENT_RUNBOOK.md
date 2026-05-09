# AWS Deployment Runbook (3-Instance Architecture)

## Prerequisites

1. **AWS Account**: Must be free-tier eligible (new account or within free-tier window)
2. **Terraform**: `terraform >= 1.0` installed locally
3. **AWS CLI**: Configured with credentials (`aws configure`)
4. **Git**: Your repo pushed to GitHub (public or private with deploy keys)
5. **GitHub OAuth App**: Created (see `GITHUB_OAUTH_SETUP.md`)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       AWS VPC (10.0.0.0/16)                 │
│                     ap-southeast-1 (Singapore)              │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────┐  │
│  │  Frontend EC2    │  │  Backend EC2     │  │Logs EC2  │  │
│  │   t2.micro       │  │   t2.micro       │  │t2.micro  │  │
│  │  (Port 3000)     │──│  (Port 8000)     │──│(5601)    │  │
│  │                  │  │  + Redis:6379    │  │          │  │
│  │  Next.js         │  │  + PostgreSQL    │  │ELK Stack │  │
│  │                  │  │    (local)       │  │          │  │
│  └──────────────────┘  └──────────────────┘  └──────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           S3 Bucket (File Uploads)                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Step 1: Prepare Terraform Configuration

```bash
cd aws/terraform

# Copy example variables
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars with your values:
# - github_client_id and github_client_secret (from GitHub OAuth setup)
# - ssh_cidr_blocks (your IP for SSH access)
# - instance_type (keep t2.micro for free-tier)
```

## Step 2: Initialize Terraform

```bash
terraform init

# Verify the plan
terraform plan -out=tfplan
```

## Step 3: Deploy Infrastructure

```bash
# Apply the plan (this will create all 3 instances)
terraform apply tfplan

# Terraform will output:
# - frontend_ip
# - frontend_url
# - backend_ip
# - backend_url
# - logs_ip
# - kibana_url
# - s3_bucket_name
```

**Deployment time**: ~10-15 minutes for all instances to initialize.

## Step 4: Verify Instances Are Running

```bash
# Wait 5-10 minutes for user_data scripts to complete
# Then check each instance:

# Frontend
curl http://<frontend_ip>:3000

# Backend health check
curl http://<backend_ip>:8000/health

# Kibana (logs)
open http://<logs_ip>:5601
```

## Step 5: Configure Frontend Environment

SSH into frontend instance:
```bash
ssh -i your-key.pem ubuntu@<frontend_ip>

# Edit the Next.js environment
cd /opt/promptledger/frontend
nano .env.local

# Add:
NEXT_PUBLIC_API_URL=http://<backend_ip>:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://<backend_ip>:8000

# Rebuild
npm run build
pm2 restart promptledger-frontend
```

## Step 6: Configure Backend Database

SSH into backend instance:
```bash
ssh -i your-key.pem ubuntu@<backend_ip>

# Option A: Use managed RDS (recommended for prod)
# Update DATABASE_URL in .env to point to RDS

# Option B: Run PostgreSQL locally (for dev/testing)
sudo apt-get install -y postgresql-15
sudo systemctl start postgresql
sudo -u postgres createdb promptledger_db
sudo -u postgres psql -c "ALTER ROLE postgres PASSWORD 'password';"

# Edit .env
nano backend/.env
# Update DATABASE_URL=postgresql://postgres:password@localhost:5432/promptledger_db

# Run migrations
source venv/bin/activate
alembic upgrade head

# Restart API
pm2 restart promptledger-api
```

## Step 7: Verify End-to-End Flow

1. **Frontend**: Open http://<frontend_ip>:3000
2. **Login**: Click "Sign in with GitHub" (you configured this earlier)
3. **Create Unit**: Click "New Unit" and create a behavior unit
4. **View Metrics**: Check dashboard and alerts

## Step 8: Monitor Logs

```bash
# SSH into logs instance
ssh -i your-key.pem ubuntu@<logs_ip>

# View ELK stack status
docker-compose -f /opt/elk/docker-compose.yml logs -f

# Open Kibana in browser
# http://<logs_ip>:5601
# Create index pattern "logs-*"
# View structured logs from backend
```

## Troubleshooting

### Frontend won't load
```bash
ssh -i your-key.pem ubuntu@<frontend_ip>
pm2 logs promptledger-frontend
```

### Backend health check fails
```bash
ssh -i your-key.pem ubuntu@<backend_ip>
pm2 logs promptledger-api
# Check DATABASE_URL and other env vars
source venv/bin/activate
python -c "from app.core.config import settings; print(settings.database_url)"
```

### Elasticsearch/Logstash issues
```bash
ssh -i your-key.pem ubuntu@<logs_ip>
docker-compose -f /opt/elk/docker-compose.yml restart
docker-compose -f /opt/elk/docker-compose.yml logs elasticsearch
```

### Database connection refused
- Ensure PostgreSQL is running on backend or RDS is accessible
- Check security group allows port 5432 (if using RDS)
- Verify DATABASE_URL format is correct

## Scaling & Next Steps

### Add Custom Domain
1. Register domain (Route53 or external registrar)
2. Point to frontend instance IP
3. (Optional) Add SSL certificate via ACM and ALB

### Add Load Balancing
1. Create Application Load Balancer (ALB)
2. Attach frontend and backend security groups
3. Add HTTPS listener
4. Update DNS to point to ALB

### Add CDN
1. Create CloudFront distribution
2. Point to frontend instance or ALB
3. Cache static Next.js assets

### Add Backup & Disaster Recovery
1. Enable EBS snapshots for data persistence
2. Set up cross-region replication for RDS
3. Daily backup to S3 (via `backup_restore.ps1` script)

## Cost Monitoring

```bash
# View monthly charges (free-tier should be $0)
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity DAILY \
  --metrics "UnblendedCost"

# Set up billing alerts
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget BudgetName=FreeTierAlert,BudgetLimit='{Amount=1,Unit=USD}',BudgetType=COST
```

## Cleanup (To Avoid Charges)

```bash
# Destroy all infrastructure
terraform destroy

# Confirm destruction
# All EC2 instances, VPC, S3 bucket, and security groups will be deleted
```

## CI/CD Integration (Optional)

See `.github/workflows/deploy.yml` for automated deployments on push to main branch.

---

**Need help?** Check `OPERATIONS.md` for backup/restore, debugging, and monitoring procedures.
